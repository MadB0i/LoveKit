package app.lovekit.bridge.pack

/** A parsed LoveKit `pack.json` (schema v1). */
data class ManifestSticker(
    val file: String,
    val emoji: List<String>,
    val name: String,
)

data class LoveKitManifest(
    val name: String,
    val author: String,
    val description: String,
    /** WhatsApp pack identifier: manifest's android.identifier, or derived. */
    val identifier: String,
    val trayFile: String,
    val stickers: List<ManifestSticker>,
)

class ManifestException(message: String) : Exception(message)

/**
 * Parse + schema-check a LoveKit pack.json. Pure JVM (MiniJson) — fully
 * unit-testable. Deeper file checks happen in [PackValidator].
 */
object ManifestParser {
    fun parse(json: String): LoveKitManifest {
        val root = try {
            MiniJson.parse(json)
        } catch (e: JsonParseException) {
            throw ManifestException("Invalid JSON: ${e.message}")
        }
        val m = root.obj() ?: throw ManifestException("Manifest must be an object.")
        val format = m["format"]?.str() ?: throw ManifestException("Missing format.")
        if (format != PackValidator.SCHEMA_FORMAT) {
            throw ManifestException("Unknown format \"$format\" (want \"${PackValidator.SCHEMA_FORMAT}\").")
        }
        val version = m["version"]?.num()?.toInt()
            ?: throw ManifestException("Missing version.")
        if (version != PackValidator.SCHEMA_VERSION) {
            throw ManifestException("Unsupported version $version (want ${PackValidator.SCHEMA_VERSION}).")
        }
        val name = m["name"]?.str()?.trim().orEmpty()
        val author = m["author"]?.str()?.trim().orEmpty()
        if (name.isEmpty()) throw ManifestException("Pack needs a name.")
        if (author.isEmpty()) throw ManifestException("Pack needs an author.")
        val description = m["description"]?.str().orEmpty().take(500)
        val identifier = m["android"]?.obj()?.get("identifier")?.str()
            ?.filter { it.isLetterOrDigit() or (it == '.') }
            ?.take(64)
            ?.takeIf { it.isNotBlank() }
            ?: "lovekit.${PackValidator.slugify(name)}${PackValidator.slugify(author)}".take(64)
        val stickersRaw = m["stickers"]?.arr()
            ?: throw ManifestException("Missing stickers array.")
        val stickers = stickersRaw.mapIndexed { i, s ->
            val o = s.obj() ?: throw ManifestException("Sticker #${i + 1} must be an object.")
            val file = o["file"]?.str().orEmpty()
            val emoji = o["emoji"]?.arr()?.mapNotNull { it.str()?.takeIf(String::isNotEmpty) } ?: emptyList()
            val sname = o["name"]?.str().orEmpty().take(80)
            ManifestSticker(file, emoji, sname)
        }
        val trayFile = m["trayImageFile"]?.str()?.takeIf { it.isNotBlank() }
            ?: PackValidator.TRAY_NAME
        return LoveKitManifest(name, author, description, identifier, trayFile, stickers)
    }
}
