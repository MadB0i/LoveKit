package app.lovekit.bridge.pack

import org.junit.Assert.*
import org.junit.Test

class PackValidatorTest {

    private fun asset(
        name: String = "sticker_01.webp",
        size: Long = 40_000,
        w: Int = 512,
        h: Int = 512,
        magic: Magic = Magic.WEBP,
        sha: String = "aaa",
    ) = AssetInfo(name, size, w, h, magic, sha)

    @Test
    fun `canonical names only — traversal and odd names rejected`() {
        assertTrue(PackValidator.isCanonicalStickerName("sticker_01.png"))
        assertTrue(PackValidator.isCanonicalStickerName("sticker_30.webp"))
        assertFalse(PackValidator.isCanonicalStickerName("sticker_1.png"))
        assertFalse(PackValidator.isCanonicalStickerName("sticker_01.jpg"))
        assertFalse(PackValidator.isCanonicalStickerName("../../evil.png"))
        assertFalse(PackValidator.isCanonicalStickerName("/abs/sticker_01.png"))
        assertFalse(PackValidator.isCanonicalStickerName("sticker_01.png\u0000"))
        assertFalse(PackValidator.isPathSafe("../x"))
        assertFalse(PackValidator.isPathSafe("a/b"))
        assertFalse(PackValidator.isPathSafe(".hidden"))
        assertTrue(PackValidator.isPathSafe("pack.json"))
    }

    @Test
    fun `sticker assets must be 512px, small and honestly typed`() {
        assertTrue(PackValidator.validateStickerAsset(asset()).isEmpty())
        assertTrue(PackValidator.validateStickerAsset(asset(w = 511)).any { it.contains("512") })
        assertTrue(PackValidator.validateStickerAsset(asset(size = 101 * 1024)).any { it.contains("100 KB") })
        assertTrue(PackValidator.validateStickerAsset(asset(magic = Magic.UNKNOWN)).any { it.contains("magic") })
        // Extension says png but bytes say otherwise → still rejected.
        assertTrue(PackValidator.validateStickerAsset(asset(name = "sticker_02.png", magic = Magic.UNKNOWN)).isNotEmpty())
    }

    @Test
    fun `tray must be a real 96px PNG under 50 KB`() {
        val tray = asset(name = "tray_icon.png", size = 9_000, w = 96, h = 96, magic = Magic.PNG)
        assertTrue(PackValidator.validateTrayAsset(tray).isEmpty())
        assertTrue(PackValidator.validateTrayAsset(tray.copy(width = 100)).any { it.contains("96") })
        assertTrue(PackValidator.validateTrayAsset(tray.copy(sizeBytes = 60_000)).any { it.contains("50 KB") })
        assertTrue(PackValidator.validateTrayAsset(tray.copy(magic = Magic.WEBP)).any { it.contains("PNG") })
    }

    @Test
    fun `counts, duplicates and sha256 work`() {
        assertEquals(64, PackValidator.sha256Hex("abc".toByteArray()).length)
        val dupes = PackValidator.findDuplicateContent(
            listOf(asset("sticker_01.webp", sha = "same"), asset("sticker_02.webp", sha = "same"), asset("sticker_03.webp", sha = "diff")),
        )
        assertEquals(1, dupes.size)
        assertTrue(dupes[0].contains("sticker_01.webp") && dupes[0].contains("sticker_02.webp"))
        assertTrue(PackValidator.findDuplicateContent(listOf(asset(sha = "a"))).isEmpty())
    }

    @Test
    fun `manifest counts enforced`() {
        fun m(n: Int) = LoveKitManifest("N", "A", "", "lovekit.na", "tray_icon.png",
            (1..n).map { ManifestSticker("sticker_${it.toString().padStart(2, '0')}.png", listOf("❤️"), "S") })
        assertTrue(PackValidator.validateManifest(m(2)).any { it.contains("3–30") })
        assertTrue(PackValidator.validateManifest(m(3)).isEmpty())
        assertTrue(PackValidator.validateManifest(m(31)).any { it.contains("3–30") })
    }

    @Test
    fun `identifiers slugify safely`() {
        assertEquals("usdev", PackValidator.slugify("Us ❤️ Dev!"))
        assertEquals("pack", PackValidator.slugify("❤️❤️"))
    }
}
