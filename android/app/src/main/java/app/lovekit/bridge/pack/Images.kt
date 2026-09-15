package app.lovekit.bridge.pack

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream

/** Probes + converts sticker images on-device. Android-only (Bitmap). */
object ImageProbe {

    data class Probed(val width: Int, val height: Int, val magic: Magic, val animated: Boolean)

    fun probe(bytes: ByteArray): Probed {
        val magic = sniff(bytes)
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
        return Probed(opts.outWidth, opts.outHeight, magic, isAnimatedWebp(bytes))
    }

    fun sniff(bytes: ByteArray): Magic {
        if (bytes.size >= 8 &&
            bytes[0] == 0x89.toByte() && bytes[1] == 'P'.code.toByte() &&
            bytes[2] == 'N'.code.toByte() && bytes[3] == 'G'.code.toByte()
        ) return Magic.PNG
        if (bytes.size >= 12 &&
            bytes[0] == 'R'.code.toByte() && bytes[1] == 'I'.code.toByte() &&
            bytes[2] == 'F'.code.toByte() && bytes[3] == 'F'.code.toByte() &&
            bytes[8] == 'W'.code.toByte() && bytes[9] == 'E'.code.toByte() &&
            bytes[10] == 'B'.code.toByte() && bytes[11] == 'P'.code.toByte()
        ) return Magic.WEBP
        return Magic.UNKNOWN
    }

    /** ANMF chunk = animation. LoveKit V1 packs are static-only. */
    fun isAnimatedWebp(bytes: ByteArray): Boolean {
        if (sniff(bytes) != Magic.WEBP) return false
        // Scan RIFF chunks for "ANMF" (bounded scan, cheap).
        var i = 12
        while (i + 8 <= bytes.size && i < 200_000) {
            val tag = String(bytes, i, 4, Charsets.US_ASCII)
            val size = ((bytes[i + 4].toInt() and 0xFF)) or
                ((bytes[i + 5].toInt() and 0xFF) shl 8) or
                ((bytes[i + 6].toInt() and 0xFF) shl 16) or
                ((bytes[i + 7].toInt() and 0xFF) shl 24)
            if (tag == "ANMF") return true
            if (size < 0 || size > bytes.size) return false
            i += 8 + size + (size and 1)
        }
        return false
    }
}

/**
 * Converts sticker PNGs to WhatsApp-ready lossy WebP (alpha preserved),
 * stepping quality down until the 100 KB limit holds. Throws with a humane
 * message when even the floor doesn't fit (user must simplify the sticker).
 */
object WebpConverter {
    fun toStickerWebp(pngBytes: ByteArray): ByteArray {
        val bmp = BitmapFactory.decodeByteArray(pngBytes, 0, pngBytes.size)
            ?: throw IllegalArgumentException("Could not decode image.")
        // WhatsApp serves 512×512; scale down larger inputs (never upscale).
        val scaled = if (bmp.width > PackValidator.STICKER_PX || bmp.height > PackValidator.STICKER_PX) {
            val f = minOf(
                PackValidator.STICKER_PX / bmp.width.toFloat(),
                PackValidator.STICKER_PX / bmp.height.toFloat(),
            )
            Bitmap.createScaledBitmap(bmp, (bmp.width * f).toInt(), (bmp.height * f).toInt(), true)
        } else bmp
        var quality = 92
        while (true) {
            val out = ByteArrayOutputStream()
            // Bitmap.CompressFormat.WEBP is lossy-with-alpha on all supported APIs.
            @Suppress("DEPRECATION")
            scaled.compress(Bitmap.CompressFormat.WEBP, quality, out)
            val bytes = out.toByteArray()
            if (bytes.size <= PackValidator.STICKER_MAX_BYTES || quality <= 60) {
                if (scaled !== bmp) scaled.recycle()
                if (bytes.size > PackValidator.STICKER_MAX_BYTES) {
                    throw IllegalArgumentException(
                        "Sticker still ${(bytes.size / 1024)} KB as WebP — simplify it (fewer photos, flatter art).",
                    )
                }
                return bytes
            }
            quality -= 8
        }
    }

    fun toTrayPng(source: ByteArray): ByteArray {
        val bmp = BitmapFactory.decodeByteArray(source, 0, source.size)
            ?: throw IllegalArgumentException("Could not decode tray image.")
        val scaled = Bitmap.createScaledBitmap(bmp, PackValidator.TRAY_PX, PackValidator.TRAY_PX, true)
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.PNG, 100, out)
        if (scaled !== bmp) scaled.recycle()
        val bytes = out.toByteArray()
        if (bytes.size > PackValidator.TRAY_MAX_BYTES) {
            throw IllegalArgumentException("Tray icon exceeds 50 KB even at 96×96.")
        }
        return bytes
    }
}
