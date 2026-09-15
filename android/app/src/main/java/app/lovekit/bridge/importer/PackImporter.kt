package app.lovekit.bridge.importer

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import app.lovekit.bridge.pack.AssetInfo
import app.lovekit.bridge.pack.ImageProbe
import app.lovekit.bridge.pack.Magic
import app.lovekit.bridge.pack.ManifestException
import app.lovekit.bridge.pack.ManifestParser
import app.lovekit.bridge.pack.PackValidator
import app.lovekit.bridge.pack.WebpConverter
import app.lovekit.bridge.store.PackStore
import app.lovekit.bridge.store.StoredPack
import app.lovekit.bridge.store.StoredSticker
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.util.zip.ZipInputStream

sealed interface ImportResult {
    data class Success(val pack: StoredPack, val convertedToWebp: Int) : ImportResult
    data class Failure(val errors: List<String>) : ImportResult
}

/**
 * Imports a LoveKit web export (folder via Storage Access Framework, or a
 * .zip of the same folder) into app-internal storage. Treats everything as
 * hostile: names, JSON, magic bytes, dimensions, sizes, duplicates, bombs.
 */
class PackImporter(private val context: Context) {
    private val resolver = context.contentResolver
    private val store = PackStore(context.filesDir)

    fun importFromTree(treeUri: Uri): ImportResult {
        val appCtx = context.applicationContext
        val root = try {
            DocumentFile.fromTreeUri(appCtx, treeUri)
        } catch (e: Exception) {
            null
        } ?: return ImportResult.Failure(listOf("Could not open that folder."))
        return try {
            val files = root.listFiles().filter { it.isFile && it.name != null }
            if (files.isEmpty()) return ImportResult.Failure(listOf("That folder is empty."))
            importEntries(files.map { doc ->
                RawEntry(doc.name!!) { resolver.openInputStream(doc.uri) }
            })
        } catch (e: Exception) {
            ImportResult.Failure(listOf("Could not read that folder: ${e.message}"))
        }
    }

    /**
     * In-memory entry point (instrumented tests + future share-intent flows).
     * Same pipeline as folder/zip imports — names mapped to raw file bytes.
     */
    internal fun importFromMemory(files: Map<String, ByteArray>): ImportResult {
        if (files.isEmpty()) return ImportResult.Failure(listOf("Nothing to import."))
        return try {
            importEntries(files.map { (name, bytes) -> RawEntry(name, bytes) })
        } catch (e: Exception) {
            ImportResult.Failure(listOf("Import failed: ${e.message}"))
        }
    }

    fun importFromZip(zipUri: Uri): ImportResult {        return try {
            val entries = ArrayList<RawEntry>()
            resolver.openInputStream(zipUri)?.use { raw ->
                ZipInputStream(raw).use { zip ->
                    while (true) {
                        val e = zip.nextEntry ?: break
                        if (!e.isDirectory) {
                            val bytes = readCapped(zip, PackValidator.MAX_COPY_BYTES + 1)
                            entries.add(RawEntry(e.name, bytes))
                        }
                        zip.closeEntry()
                    }
                }
            } ?: return ImportResult.Failure(listOf("Could not open that file."))
            if (entries.isEmpty()) return ImportResult.Failure(listOf("That ZIP is empty."))
            importEntries(entries)
        } catch (e: Exception) {
            ImportResult.Failure(listOf("Could not read that ZIP: ${e.message}"))
        }
    }

    /** One candidate file: bare name + lazy bytes (tree) or eager bytes (zip). */
    private class RawEntry(val name: String, val eager: ByteArray? = null, val opener: (() -> InputStream?)? = null) {
        fun bytes(): ByteArray {
            eager?.let { return it }
            val stream = opener?.invoke() ?: throw IllegalArgumentException("$name is unreadable.")
            return stream.use { readCappedFile(it, PackValidator.MAX_COPY_BYTES + 1) }
        }
    }

    private fun importEntries(all: List<RawEntry>): ImportResult {
        // 0. Hostile names anywhere → reject the whole import, loudly.
        val hostile = all.map { it.name }.filter { !PackValidator.isPathSafe(it) }.distinct()
        if (hostile.isNotEmpty()) {
            return ImportResult.Failure(
                listOf("Unsafe file names rejected: ${hostile.take(3).joinToString()}${if (hostile.size > 3) "…" else ""}."),
            )
        }
        // 1. Locate pack.json at root (or exactly one folder down — the
        // "I zipped the folder itself" case). Anything else is an error.
        val roots = all.filter { it.name == PackValidator.MANIFEST_NAME }
        val nested = all.mapNotNull { e ->
            Regex("^[^/]+/${PackValidator.MANIFEST_NAME}$").matchEntire(e.name)?.let { e.name.substringBefore('/') }
        }.distinct()
        val entries: List<RawEntry>
        when {
            roots.size == 1 && nested.isEmpty() -> {
                entries = all
            }
            roots.isEmpty() && nested.size == 1 -> {
                val prefix = nested.first() + "/"
                entries = all.filter { it.name.startsWith(prefix) }
                    .map { RawEntry(it.name.removePrefix(prefix), it.eager, it.opener) }
            }
            else -> return ImportResult.Failure(
                listOf("No pack.json found. Export the pack from LoveKit Web first (pack.json + tray_icon.png + sticker_01.png … in one folder)."),
            )
        }

        val manifest = try {
            val raw = entries.first { it.name == PackValidator.MANIFEST_NAME }.bytes().toString(Charsets.UTF_8)
            ManifestParser.parse(raw)
        } catch (e: ManifestException) {
            return ImportResult.Failure(listOf(e.message ?: "Invalid pack.json."))
        } catch (e: Exception) {
            return ImportResult.Failure(listOf("Could not read pack.json: ${e.message}"))
        }
        val errors = ArrayList(PackValidator.validateManifest(manifest))
        if (errors.isNotEmpty()) return ImportResult.Failure(errors)

        // 2. Load declared assets only (extras in the folder are ignored).
        val byName = entries.associateBy { it.name }
        fun load(declared: String): ByteArray? {
            val hit = byName[declared]
            if (hit == null) {
                errors.add("Missing file: $declared.")
                return null
            }
            return try {
                hit.bytes()
            } catch (e: Exception) {
                errors.add("$declared: unreadable (${e.message}).")
                null
            }
        }
        val trayBytes = load(manifest.trayFile)
        val stickerBytes = manifest.stickers.map { it.file to load(it.file) }
        if (errors.isNotEmpty()) return ImportResult.Failure(errors)

        val total = (trayBytes?.size ?: 0) + stickerBytes.sumOf { it.second?.size ?: 0 }
        if (total > PackValidator.MAX_TOTAL_BYTES) {
            return ImportResult.Failure(listOf("Pack is ${total / 1048576} MB — far too large. Something is wrong with this export."))
        }

        // 3. Probe + spec-check each asset.
        fun probe(name: String, bytes: ByteArray): AssetInfo {
            if (bytes.size > PackValidator.MAX_COPY_BYTES) throw IllegalArgumentException("$name is too large.")
            val p = ImageProbe.probe(bytes)
            if (p.width <= 0 || p.height <= 0) throw IllegalArgumentException("$name is not a readable image.")
            if (p.animated) throw IllegalArgumentException("$name looks animated — V1 packs must be static.")
            return AssetInfo(name, bytes.size.toLong(), p.width, p.height, p.magic, PackValidator.sha256Hex(bytes))
        }
        val trayInfo = try {
            probe(manifest.trayFile, trayBytes!!)
        } catch (e: Exception) {
            return ImportResult.Failure(listOf(e.message ?: "Bad tray icon."))
        }
        errors += PackValidator.validateTrayAsset(trayInfo).map { "Tray: $it" }

        val writes = LinkedHashMap<String, ByteArray>()
        val stored = ArrayList<StoredSticker>()
        val seenContent = HashMap<String, String>()
        var converted = 0
        for ((declared, bytes) in stickerBytes) {
            if (bytes == null) continue // already recorded above
            try {
                val info = probe(declared, bytes)
                val clash = seenContent[info.sha256]
                if (clash != null) {
                    errors.add("$declared is byte-identical to $clash — duplicates are rejected.")
                    continue
                }
                seenContent[info.sha256] = declared
                // WhatsApp requires WebP: convert PNG inputs, pass WebP through.
                val (outName, outBytes) = if (info.magic == Magic.PNG) {
                    converted++
                    declared.substringBeforeLast('.') + ".webp" to WebpConverter.toStickerWebp(bytes)
                } else {
                    declared to bytes
                }
                errors += PackValidator.validateStickerAsset(info.copy(name = outName, sizeBytes = outBytes.size.toLong()))
                val meta = manifest.stickers.first { it.file == declared }
                stored.add(StoredSticker(outName, meta.emoji, meta.name))
                writes[outName] = outBytes
            } catch (e: Exception) {
                errors.add(e.message ?: "$declared failed validation.")
            }
        }
        if (errors.isNotEmpty()) return ImportResult.Failure(errors)

        // 4. Persist tray (normalised 96px PNG) + stickers + index.
        // Wipe first: a re-import of the same identifier must not leave
        // stale files (e.g. previous .png generations) beside the new set.
        // The provider only ever serves index-listed names, but tidiness
        // avoids confusion and wasted bytes.
        val packDir = store.packDir(manifest.identifier)
        return try {
            packDir.deleteRecursively()
            packDir.mkdirs()
            File(packDir, PackValidator.TRAY_NAME).writeBytes(WebpConverter.toTrayPng(trayBytes))
            for ((name, bytes) in writes) File(packDir, name).writeBytes(bytes)
            val pack = store.save(manifest, PackValidator.TRAY_NAME, stored)
            ImportResult.Success(pack, converted)
        } catch (e: Exception) {
            packDir.deleteRecursively()
            ImportResult.Failure(listOf("Could not save pack: ${e.message}"))
        }
    }

    private fun readCapped(stream: InputStream, cap: Int): ByteArray = readCappedFile(stream, cap)
}

/** File-level helper so nested entry holders can cap reads without an outer reference. */
private fun readCappedFile(stream: InputStream, cap: Int): ByteArray {
    val out = ByteArrayOutputStream()
    val buf = ByteArray(8192)
    var total = 0
    while (true) {
        val n = stream.read(buf)
        if (n < 0) break
        total += n
        if (total > cap) throw IllegalArgumentException("File too large.")
        out.write(buf, 0, n)
    }
    return out.toByteArray()
}
