package app.lovekit.bridge

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.lovekit.bridge.importer.ImportResult
import app.lovekit.bridge.importer.PackImporter
import app.lovekit.bridge.provider.StickerContentProvider
import app.lovekit.bridge.whatsapp.WhatsApp
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream

/**
 * True on-device end-to-end: web-shaped export bytes → import → validate →
 * persist → ContentProvider queries → asset serving → WhatsApp absence path.
 * Runs on the emulator via connectedDebugAndroidTest. Everything EXCEPT the
 * WhatsApp app itself is exercised for real (no WhatsApp on test devices —
 * that path asserts the honest "not installed" outcome).
 */
@RunWith(AndroidJUnit4::class)
class BridgeEndToEndTest {

    private val ctx: Context = ApplicationProvider.getApplicationContext()

    private fun paintSticker(seed: Int): ByteArray {
        val bmp = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(Color.rgb(40 + seed * 30, 26, 34))
        val p = Paint().apply { color = Color.rgb(248, 236, 221); isAntiAlias = true }
        c.drawCircle(256f, 220f, 90f, p)
        c.drawCircle(200f, 200f, 60f, p)
        c.drawCircle(312f, 200f, 60f, p)
        val out = ByteArrayOutputStream()
        assertTrue(bmp.compress(Bitmap.CompressFormat.PNG, 100, out))
        return out.toByteArray()
    }

    private fun paintTray(): ByteArray {
        // Web contract: tray arrives exactly 96×96 (web exporter renders it).
        val bmp = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(Color.rgb(74, 36, 54))
        val out = ByteArrayOutputStream()
        assertTrue(bmp.compress(Bitmap.CompressFormat.PNG, 100, out))
        return out.toByteArray()
    }

    private fun packJson(n: Int): String {
        val stickers = (1..n).joinToString(",") {
            "{\"file\":\"sticker_${it.toString().padStart(2, '0')}.png\",\"emoji\":[\"❤️\"],\"name\":\"S$it\"}"
        }
        return "{\"format\":\"lovekit-sticker-pack\",\"version\":1," +
            "\"android\":{\"identifier\":\"lovekit.e2edev\",\"publisher\":\"E2E\",\"trayImageFile\":\"tray_icon.png\"}," +
            "\"name\":\"E2E Pack\",\"author\":\"E2E\",\"description\":\"device test\"," +
            "\"stickers\":[$stickers]}"
    }

    private fun webExport(n: Int): Map<String, ByteArray> {
        val files = HashMap<String, ByteArray>()
        files["pack.json"] = packJson(n).toByteArray(Charsets.UTF_8)
        files["tray_icon.png"] = paintTray()
        for (i in 1..n) {
            files["sticker_${i.toString().padStart(2, '0')}.png"] = paintSticker(i)
        }
        return files
    }

    @Test
    fun importValidateServe_realPipeline() {
        val importer = PackImporter(ctx)
        val result = importer.importFromMemory(webExport(3))
        assertTrue("expected success, got: ${(result as? ImportResult.Failure)?.errors}", result is ImportResult.Success)
        val pack = (result as ImportResult.Success).pack
        assertEquals(3, pack.stickers.size)
        assertTrue("PNG inputs should convert to WebP", result.convertedToWebp == 3)
        assertTrue(pack.stickers.all { it.file.endsWith(".webp") })

        val cr = ctx.contentResolver
        val authority = "app.lovekit.bridge.stickerprovider"

        // metadata: all packs
        cr.query(Uri.parse("content://$authority/metadata"), null, null, null, null)!!.use { c ->
            assertTrue(c.moveToFirst())
            val idIdx = c.getColumnIndex(StickerContentProvider.STICKER_PACK_IDENTIFIER)
            var found = false
            do {
                if (c.getString(idIdx) == pack.identifier) found = true
            } while (c.moveToNext())
            assertTrue("provider must list the imported pack", found)
        }
        // metadata: single pack
        cr.query(Uri.parse("content://$authority/metadata/${pack.identifier}"), null, null, null, null)!!.use { c ->
            assertTrue(c.moveToFirst())
            assertEquals("E2E Pack", c.getString(c.getColumnIndex(StickerContentProvider.STICKER_PACK_NAME)))
            assertEquals(1, c.count)
        }
        // stickers list
        cr.query(Uri.parse("content://$authority/stickers/${pack.identifier}"), null, null, null, null)!!.use { c ->
            assertEquals(3, c.count)
            assertTrue(c.moveToFirst())
        }
        // asset bytes: must be real WebP (RIFF....WEBP), served read-only
        val first = pack.stickers.first().file
        val afd = cr.openAssetFileDescriptor(Uri.parse("content://$authority/stickers_asset/${pack.identifier}/$first"), "r")!!
        afd.use {
            val bytes = it.createInputStream().readBytes()
            assertTrue(bytes.size < 100 * 1024)
            assertEquals('R'.code.toByte(), bytes[0])
            assertEquals('W'.code.toByte(), bytes[8])
        }
        // tray asset serves as PNG
        val tray = cr.openAssetFileDescriptor(Uri.parse("content://$authority/stickers_asset/${pack.identifier}/tray_icon.png"), "r")!!
        tray.use {
            val bytes = it.createInputStream().readBytes()
            assertEquals(0x89.toByte(), bytes[0])
            assertEquals('P'.code.toByte(), bytes[1])
        }
        // unknown pack/file → empty cursor / no descriptor, never a crash.
        // (Whether the stack surfaces null or FileNotFoundException is an
        // implementation detail — the property we assert is: nothing leaks.)
        cr.query(Uri.parse("content://$authority/metadata/nope"), null, null, null, null)!!.use { c ->
            assertEquals(0, c.count)
        }
        var leaked = false
        try {
            cr.openAssetFileDescriptor(Uri.parse("content://$authority/stickers_asset/${pack.identifier}/../../x"), "r")?.use {
                leaked = true
            }
        } catch (e: Exception) {
            leaked = false
        }
        assertFalse("traversal asset must not resolve", leaked)
    }

    @Test
    fun invalidPacksFailWithReasons_notCrashes() {
        val importer = PackImporter(ctx)
        // Only 2 stickers (< 3 minimum).
        val r1 = importer.importFromMemory(webExport(2))
        assertTrue(r1 is ImportResult.Failure)
        assertTrue((r1 as ImportResult.Failure).errors.any { it.contains("3–30") })
        // Missing manifest.
        val files = webExport(3).toMutableMap()
        files.remove("pack.json")
        val r2 = importer.importFromMemory(files)
        assertTrue(r2 is ImportResult.Failure)
        // Traversal entry poisons the whole import.
        val evil = webExport(3).toMutableMap()
        evil["../evil.png"] = ByteArray(10)
        val r3 = importer.importFromMemory(evil)
        assertTrue(r3 is ImportResult.Failure)
        assertTrue((r3 as ImportResult.Failure).errors.any { it.contains("Unsafe") })
    }

    @Test
    fun whatsappAbsence_isHonest() {
        // No WhatsApp on the test emulator: presence false, whitelist unknown.
        val presence = WhatsApp.presence(ctx.packageManager)
        assertFalse(presence.any)
        val importer = PackImporter(ctx)
        val result = importer.importFromMemory(webExport(3))
        val pack = (result as ImportResult.Success).pack
        val status = WhatsApp.whitelistStatus(ctx, pack.identifier)
        assertTrue(status.values.all { it == null || it == false })
    }
}
