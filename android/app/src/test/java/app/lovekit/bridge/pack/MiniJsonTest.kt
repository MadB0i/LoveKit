package app.lovekit.bridge.pack

import org.junit.Assert.*
import org.junit.Test

class MiniJsonTest {

    @Test
    fun `parses the real LoveKit manifest shape`() {
        val json = """
        {"format":"lovekit-sticker-pack","version":1,
         "android":{"identifier":"lovekit.usdev","publisher":"Dev","trayImageFile":"tray_icon.png"},
         "name":"Us ❤️","author":"Dev","description":"For Maya",
         "stickers":[{"file":"sticker_01.png","emoji":["❤️"],"name":"Miss You"}],
         "whatsappSpecs":{"stickerPx":512}}
        """.trimIndent()
        val root = MiniJson.parse(json)
        val m = root.obj()!!
        assertEquals("lovekit-sticker-pack", m["format"]!!.str())
        assertEquals(1.0, m["version"]!!.num())
        assertEquals("Us ❤️", m["name"]!!.str())
        assertEquals(1, m["stickers"]!!.arr()!!.size)
    }

    @Test
    fun `rejects garbage, truncation, trailing junk and deep nesting`() {
        assertThrows(JsonParseException::class.java) { MiniJson.parse("") }
        assertThrows(JsonParseException::class.java) { MiniJson.parse("{bad") }
        assertThrows(JsonParseException::class.java) { MiniJson.parse("{\"a\":1} trailing") }
        assertThrows(JsonParseException::class.java) { MiniJson.parse("[1,2,]") }
        assertThrows(JsonParseException::class.java) { MiniJson.parse("{\"a\":NaN}") }
        var deep = "0"
        repeat(64) { deep = "[$deep]" }
        assertThrows(JsonParseException::class.java) { MiniJson.parse(deep) }
    }

    @Test
    fun `handles escapes, unicode and empties`() {
        val v = MiniJson.parse("{\"e\":\"a\\\"b\\n\\u2764\",\"n\":-12.5e2,\"t\":true,\"f\":false,\"z\":null,\"o\":{},\"a\":[]}")
        val m = v.obj()!!
        assertEquals("a\"b\n❤", m["e"]!!.str())
        assertEquals(-1250.0, m["n"]!!.num())
        assertTrue((m["o"]!!.obj()!!.isEmpty()))
    }

    @Test
    fun `rejects oversized input`() {
        assertThrows(JsonParseException::class.java) { MiniJson.parse("[" + "1,".repeat(200_000) + "]") }
    }
}
