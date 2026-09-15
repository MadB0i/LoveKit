package app.lovekit.bridge.store

import app.lovekit.bridge.pack.LoveKitManifest
import app.lovekit.bridge.pack.ManifestSticker
import app.lovekit.bridge.pack.MiniJson
import app.lovekit.bridge.pack.JsonParseException
import app.lovekit.bridge.pack.arr
import app.lovekit.bridge.pack.num
import app.lovekit.bridge.pack.obj
import app.lovekit.bridge.pack.str
import java.io.File

/** One imported pack as kept in app-internal storage. */
data class StoredPack(
    val identifier: String,
    val name: String,
    val author: String,
    val description: String,
    val trayFile: String,
    val stickers: List<StoredSticker>,
    val dataVersion: Long,
    val dir: File,
)

data class StoredSticker(
    val file: String,
    val emoji: List<String>,
    val name: String,
)

/**
 * Internal-storage pack registry (`filesDir/packs/<identifier>/`).
 * No database, no network — a tiny index.json per pack.
 */
class PackStore(private val root: File) {

    fun packsDir(): File = File(root, "packs").apply { mkdirs() }

    fun list(): List<StoredPack> =
        packsDir().listFiles { f -> f.isDirectory }.orEmpty()
            .mapNotNull { readIndex(it) }
            .sortedByDescending { it.dataVersion }

    fun get(identifier: String): StoredPack? {
        val dir = packDir(identifier)
        return if (dir.isDirectory) readIndex(dir) else null
    }

    fun packDir(identifier: String): File = File(packsDir(), safeId(identifier))

    /** Directory-safe identifier (WhatsApp identifiers are ours to choose). */
    fun safeId(identifier: String): String {
        val s = identifier.lowercase().replace(Regex("[^a-z0-9._-]"), "").take(64)
        return s.ifEmpty { "pack" }
    }

    fun save(manifest: LoveKitManifest, trayFile: String, stickers: List<StoredSticker>): StoredPack {
        val dir = packDir(manifest.identifier)
        if (!dir.isDirectory && list().size >= app.lovekit.bridge.pack.PackValidator.MAX_PACKS_PER_APP) {
            throw IllegalStateException("This app holds at most ${app.lovekit.bridge.pack.PackValidator.MAX_PACKS_PER_APP} packs (WhatsApp limit). Delete one first.")
        }
        dir.mkdirs()
        val pack = StoredPack(
            manifest.identifier, manifest.name, manifest.author, manifest.description,
            trayFile, stickers, System.currentTimeMillis() / 1000, dir,
        )
        File(dir, "index.json").writeText(indexJson(pack))
        return pack
    }

    fun delete(identifier: String): Boolean = packDir(identifier).deleteRecursively()

    private fun readIndex(dir: File): StoredPack? {
        return try {
            val root = MiniJson.parse(File(dir, "index.json").readText())
            val m = root.obj() ?: return null
            StoredPack(
                identifier = m["identifier"]?.str() ?: return null,
                name = m["name"]?.str().orEmpty(),
                author = m["author"]?.str().orEmpty(),
                description = m["description"]?.str().orEmpty(),
                trayFile = m["trayFile"]?.str() ?: "tray_icon.png",
                stickers = m["stickers"]?.arr().orEmpty().mapNotNull { s ->
                    val o = s.obj() ?: return@mapNotNull null
                    val file = o["file"]?.str() ?: return@mapNotNull null
                    StoredSticker(file, o["emoji"]?.arr()?.mapNotNull { it.str() } ?: emptyList(), o["name"]?.str().orEmpty())
                },
                dataVersion = m["dataVersion"]?.num()?.toLong() ?: 0L,
                dir = dir,
            )
        } catch (e: Exception) {
            null // corrupt index → pack invisible, never a crash (import can redo it)
        }
    }

    private fun indexJson(p: StoredPack): String {
        fun esc(s: String) = s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")
        val stickers = p.stickers.joinToString(",") { s ->
            val emoji = s.emoji.joinToString(",") { "\"${esc(it)}\"" }
            "{\"file\":\"${esc(s.file)}\",\"emoji\":[$emoji],\"name\":\"${esc(s.name)}\"}"
        }
        return "{\"identifier\":\"${esc(p.identifier)}\",\"name\":\"${esc(p.name)}\"," +
            "\"author\":\"${esc(p.author)}\",\"description\":\"${esc(p.description)}\"," +
            "\"trayFile\":\"${esc(p.trayFile)}\",\"dataVersion\":${p.dataVersion}," +
            "\"stickers\":[$stickers]}"
    }
}
