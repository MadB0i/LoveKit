package app.lovekit.bridge.pack

/**
 * Pure validation rules for LoveKit sticker packs — no Android classes, so
 * every rule is a plain JVM unit test. Mirrors the web `validatePackManifest`
 * contract (frozen schema v1) plus the file-level checks WhatsApp requires.
 */
object PackValidator {
    const val SCHEMA_FORMAT = "lovekit-sticker-pack"
    const val SCHEMA_VERSION = 1

    const val MANIFEST_NAME = "pack.json"
    const val TRAY_NAME = "tray_icon.png"

    /** Canonical sticker file names: sticker_01.png … sticker_30.webp */
    val STICKER_FILE = Regex("^sticker_\\d{2}\\.(png|webp)$")

    const val MIN_STICKERS = 3
    const val MAX_STICKERS = 30

    /** …and WhatsApp allows 1–10 packs per provider app. */
    const val MAX_PACKS_PER_APP = 10

    // Official WhatsApp sticker requirements (verified against the
    // WhatsApp/stickers sample app + Android README).
    const val STICKER_PX = 512
    const val STICKER_MAX_BYTES = 100 * 1024
    const val TRAY_PX = 96
    const val TRAY_MAX_BYTES = 50 * 1024

    /** Copy/parse budget per file: rejects zip-bombs long before OOM. */
    const val MAX_COPY_BYTES = 2 * 1024 * 1024
    const val MAX_TOTAL_BYTES = 12 * 1024 * 1024

    /** True only for canonical names. Rejects "..", "/", "\", absolute paths. */
    fun isCanonicalStickerName(name: String): Boolean = STICKER_FILE.matches(name)

    fun isCanonicalTrayName(name: String): Boolean = name == TRAY_NAME

    /** Any path separator or parent reference → reject the whole entry. */
    fun isPathSafe(name: String): Boolean =
        name.isNotEmpty() && '/' !in name && '\\' !in name && !name.startsWith(".") && ".." !in name

    /** Manifest-level checks (names, counts, schema) — mirrors web validator. */
    fun validateManifest(m: LoveKitManifest): List<String> {
        val errors = ArrayList<String>()
        if (m.name.isBlank()) errors.add("Pack needs a name.")
        if (m.author.isBlank()) errors.add("Pack needs an author.")
        if (m.stickers.size < MIN_STICKERS || m.stickers.size > MAX_STICKERS) {
            errors.add("Pack needs $MIN_STICKERS–$MAX_STICKERS stickers (has ${m.stickers.size}).")
        }
        m.stickers.forEachIndexed { i, s ->
            if (!isCanonicalStickerName(s.file)) {
                errors.add("Sticker #${i + 1} has a bad file name (want sticker_NN.png).")
            }
            if (s.emoji.isEmpty()) errors.add("Sticker #${i + 1} needs at least one emoji.")
        }
        val dupes = m.stickers.groupBy { it.file }.filterValues { it.size > 1 }.keys
        if (dupes.isNotEmpty()) errors.add("Duplicate file entries: ${dupes.joinToString()}.")
        return errors
    }

    /** One probed image file → spec errors (probe with BitmapFactory on device). */
    fun validateStickerAsset(a: AssetInfo): List<String> {
        val errors = ArrayList<String>()
        if (a.width != STICKER_PX || a.height != STICKER_PX) {
            errors.add("${a.name}: must be ${STICKER_PX}×${STICKER_PX}px (is ${a.width}×${a.height}).")
        }
        if (a.sizeBytes > STICKER_MAX_BYTES) {
            errors.add("${a.name}: ${a.sizeBytes / 1024} KB exceeds the 100 KB WhatsApp limit.")
        }
        if (a.magic != Magic.PNG && a.magic != Magic.WEBP) {
            errors.add("${a.name}: not a real PNG/WebP file (magic bytes mismatch).")
        }
        return errors
    }

    fun validateTrayAsset(a: AssetInfo): List<String> {
        val errors = ArrayList<String>()
        if (a.width != TRAY_PX || a.height != TRAY_PX) {
            errors.add("Tray icon must be ${TRAY_PX}×${TRAY_PX}px (is ${a.width}×${a.height}).")
        }
        if (a.sizeBytes > TRAY_MAX_BYTES) {
            errors.add("Tray icon exceeds the 50 KB limit.")
        }
        if (a.magic != Magic.PNG) errors.add("Tray icon must be a real PNG file.")
        return errors
    }

    /** Byte-identical sticker files → reject as duplicates. */
    fun findDuplicateContent(assets: List<AssetInfo>): List<String> {
        return assets.groupBy { it.sha256 }.filterValues { it.size > 1 }.values
            .map { group -> "Identical images: ${group.joinToString { it.name }}." }
    }

    fun sha256Hex(bytes: ByteArray): String {
        val md = java.security.MessageDigest.getInstance("SHA-256")
        return md.digest(bytes).joinToString("") { "%02x".format(it) }
    }

    /** Stable pack identifier for WhatsApp (authority + identifier pair). */
    fun slugify(text: String): String {
        val s = text.lowercase()
            .replace(Regex("[^a-z0-9]+"), "")
            .take(24)
        return s.ifEmpty { "pack" }
    }
}

/** File magic sniffed from the first bytes — never trust the extension. */
enum class Magic { PNG, WEBP, UNKNOWN }

/** One imported image, already probed. Produced on-device, validated purely. */
data class AssetInfo(
    val name: String,
    val sizeBytes: Long,
    val width: Int,
    val height: Int,
    val magic: Magic,
    val sha256: String,
)
