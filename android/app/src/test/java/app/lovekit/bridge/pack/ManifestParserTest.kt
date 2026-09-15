package app.lovekit.bridge.pack

import org.junit.Assert.*
import org.junit.Test

class ManifestParserTest {

    private fun manifest(
        format: Any = "lovekit-sticker-pack",
        version: Any = 1,
        name: Any = "Us",
        author: Any = "Dev",
        stickers: String = (1..3).joinToString(",") {
            "{\"file\":\"sticker_${it.toString().padStart(2, '0')}.png\",\"emoji\":[\"❤️\"],\"name\":\"S$it\"}"
        },
    ): String {
        fun v(x: Any) = if (x is String) "\"$x\"" else x.toString()
        return "{\"format\":${v(format)},\"version\":${v(version)}," +
            "\"android\":{\"identifier\":\"lovekit.usdev\",\"publisher\":\"Dev\",\"trayImageFile\":\"tray_icon.png\"}," +
            "\"name\":${v(name)},\"author\":${v(author)},\"description\":\"d\"," +
            "\"stickers\":[$stickers]}"
    }

    @Test
    fun `parses a valid manifest and keeps the bridge identifier`() {
        val m = ManifestParser.parse(manifest())
        assertEquals("Us", m.name)
        assertEquals("lovekit.usdev", m.identifier)
        assertEquals(3, m.stickers.size)
        assertEquals("sticker_01.png", m.stickers[0].file)
        assertEquals(listOf("❤️"), m.stickers[0].emoji)
    }

    @Test
    fun `rejects wrong format, version, names`() {
        assertThrows(ManifestException::class.java) { ManifestParser.parse(manifest(format = "other")) }
        assertThrows(ManifestException::class.java) { ManifestParser.parse(manifest(version = 999)) }
        assertThrows(ManifestException::class.java) { ManifestParser.parse(manifest(name = "  ")) }
        assertThrows(ManifestException::class.java) { ManifestParser.parse(manifest(author = "")) }
        assertThrows(ManifestException::class.java) { ManifestParser.parse("not json") }
        assertThrows(ManifestException::class.java) { ManifestParser.parse("[1,2]") }
    }

    @Test
    fun `derives a safe identifier when android block is absent`() {
        val json = manifest().replace("\"android\":\\{[^}]+\\},".toRegex(), "")
        val m = ManifestParser.parse(json)
        assertTrue(m.identifier.startsWith("lovekit."))
        assertTrue(m.identifier.all { it.isLetterOrDigit() || it == '.' })
    }

    @Test
    fun `keeps hostile sticker entries as data for the validator`() {
        val m = ManifestParser.parse(
            manifest(stickers = "{\"file\":\"../../evil.png\",\"emoji\":[],\"name\":\"x\"}," +
                "{\"file\":\"sticker_02.png\",\"emoji\":[\"❤️\"],\"name\":\"y\"}," +
                "{\"file\":\"sticker_03.png\",\"emoji\":[\"❤️\"],\"name\":\"z\"}"),
        )
        val errors = PackValidator.validateManifest(m)
        assertTrue(errors.any { it.contains("#1") && it.contains("file name") })
        assertTrue(errors.any { it.contains("#1") && it.contains("emoji") })
    }
}
