package app.lovekit.bridge.provider

import android.content.ContentProvider
import android.content.ContentValues
import android.content.UriMatcher
import android.content.res.AssetFileDescriptor
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import app.lovekit.bridge.BuildConfig
import app.lovekit.bridge.store.PackStore
import app.lovekit.bridge.store.StoredPack
import java.io.File
import java.io.FileNotFoundException

/**
 * The official WhatsApp third-party sticker contract, adapted to LoveKit's
 * imported packs (see the WhatsApp/stickers sample app: StickerContentProvider).
 *
 * Four endpoints — the strings below MUST NOT change, WhatsApp depends on them:
 *  <authority>/metadata
 *  <authority>/metadata/<pack_identifier>
 *  <authority>/stickers/<pack_identifier>
 *  <authority>/stickers_asset/<pack_identifier>/<file>
 *
 * Files are served from app-internal storage and resolved ONLY against the
 * stored index (never from raw request paths).
 */
class StickerContentProvider : ContentProvider() {

    companion object {
        // Do not change: used by WhatsApp.
        const val STICKER_PACK_IDENTIFIER = "sticker_pack_identifier"
        const val STICKER_PACK_NAME = "sticker_pack_name"
        const val STICKER_PACK_PUBLISHER = "sticker_pack_publisher"
        const val STICKER_PACK_ICON = "sticker_pack_icon"
        const val ANDROID_APP_DOWNLOAD_LINK = "android_play_store_link"
        const val IOS_APP_DOWNLOAD_LINK = "ios_app_download_link"
        const val PUBLISHER_EMAIL = "sticker_pack_publisher_email"
        const val PUBLISHER_WEBSITE = "sticker_pack_website"
        const val PRIVACY_POLICY_WEBSITE = "sticker_pack_privacy_policy_website"
        const val LICENSE_AGREEMENT_WEBSITE = "sticker_pack_license_agreement_website"
        const val IMAGE_DATA_VERSION = "image_data_version"
        const val AVOID_CACHE = "whatsapp_will_not_cache_stickers"
        const val ANIMATED_PACK = "animated_sticker_pack"

        const val STICKER_FILE_NAME = "sticker_file_name"
        const val STICKER_FILE_EMOJI = "sticker_emoji"
        const val STICKER_FILE_ACCESSIBILITY = "sticker_accessibility_text"

        private const val METADATA = "metadata"
        private const val STICKERS = "stickers"
        private const val STICKERS_ASSET = "stickers_asset"

        private const val CODE_METADATA = 1
        private const val CODE_METADATA_ONE = 2
        private const val CODE_STICKERS = 3
        private const val CODE_ASSET = 4
    }

    private val matcher = UriMatcher(UriMatcher.NO_MATCH)
    private lateinit var store: PackStore

    override fun onCreate(): Boolean {
        val ctx = context ?: return false
        val authority = BuildConfig.CONTENT_PROVIDER_AUTHORITY
        check(authority.startsWith(ctx.packageName)) {
            "Provider authority ($authority) must start with package name ${ctx.packageName}."
        }
        store = PackStore(ctx.filesDir)
        matcher.addURI(authority, METADATA, CODE_METADATA)
        matcher.addURI(authority, "$METADATA/*", CODE_METADATA_ONE)
        matcher.addURI(authority, "$STICKERS/*", CODE_STICKERS)
        matcher.addURI(authority, "$STICKERS_ASSET/*/*", CODE_ASSET)
        return true
    }

    private fun packs(): List<StoredPack> = try {
        store.list()
    } catch (e: Exception) {
        emptyList()
    }

    private fun packOf(identifier: String?): StoredPack? {
        if (identifier.isNullOrEmpty()) return null
        return packs().firstOrNull { it.identifier == identifier }
    }

    override fun query(
        uri: Uri, projection: Array<out String>?, selection: String?,
        selectionArgs: Array<out String>?, sortOrder: String?,
    ): Cursor? {
        return when (matcher.match(uri)) {
            CODE_METADATA -> metadataCursor(uri, packs())
            CODE_METADATA_ONE -> metadataCursor(uri, packOf(uri.lastPathSegment)?.let { listOf(it) }.orEmpty())
            CODE_STICKERS -> stickersCursor(packOf(uri.lastPathSegment))
            else -> throw IllegalArgumentException("Unknown URI: $uri")
        }
    }

    private fun metadataCursor(uri: Uri, packs: List<StoredPack>): Cursor {
        val cursor = MatrixCursor(
            arrayOf(
                STICKER_PACK_IDENTIFIER, STICKER_PACK_NAME, STICKER_PACK_PUBLISHER,
                STICKER_PACK_ICON, ANDROID_APP_DOWNLOAD_LINK, IOS_APP_DOWNLOAD_LINK,
                PUBLISHER_EMAIL, PUBLISHER_WEBSITE, PRIVACY_POLICY_WEBSITE,
                LICENSE_AGREEMENT_WEBSITE, IMAGE_DATA_VERSION, AVOID_CACHE, ANIMATED_PACK,
            ),
        )
        for (p in packs) {
            cursor.newRow()
                .add(STICKER_PACK_IDENTIFIER, p.identifier)
                .add(STICKER_PACK_NAME, p.name)
                .add(STICKER_PACK_PUBLISHER, p.author)
                .add(STICKER_PACK_ICON, p.trayFile)
                .add(ANDROID_APP_DOWNLOAD_LINK, "")
                .add(IOS_APP_DOWNLOAD_LINK, "")
                .add(PUBLISHER_EMAIL, "")
                .add(PUBLISHER_WEBSITE, "")
                .add(PRIVACY_POLICY_WEBSITE, "")
                .add(LICENSE_AGREEMENT_WEBSITE, "")
                .add(IMAGE_DATA_VERSION, p.dataVersion.toString())
                .add(AVOID_CACHE, 0)
                .add(ANIMATED_PACK, 0) // LoveKit V1 packs are static-only.
        }
        cursor.setNotificationUri(context?.contentResolver, uri)
        return cursor
    }

    private fun stickersCursor(pack: StoredPack?): Cursor {
        val cursor = MatrixCursor(arrayOf(STICKER_FILE_NAME, STICKER_FILE_EMOJI, STICKER_FILE_ACCESSIBILITY))
        for (s in pack?.stickers.orEmpty()) {
            cursor.newRow()
                .add(STICKER_FILE_NAME, s.file)
                .add(STICKER_FILE_EMOJI, s.emoji.joinToString(","))
                .add(STICKER_FILE_ACCESSIBILITY, s.name.ifEmpty { pack?.name.orEmpty() })
        }
        return cursor
    }

    override fun getType(uri: Uri): String? {
        val authority = BuildConfig.CONTENT_PROVIDER_AUTHORITY
        return when (matcher.match(uri)) {
            CODE_METADATA -> "vnd.android.cursor.dir/vnd.$authority.$METADATA"
            CODE_METADATA_ONE -> "vnd.android.cursor.item/vnd.$authority.$METADATA"
            CODE_STICKERS -> "vnd.android.cursor.dir/vnd.$authority.$STICKERS"
            CODE_ASSET -> {
                val file = uri.lastPathSegment.orEmpty()
                if (file.endsWith(".webp", ignoreCase = true)) "image/webp" else "image/png"
            }
            else -> throw IllegalArgumentException("Unknown URI: $uri")
        }
    }

    override fun openAssetFile(uri: Uri, mode: String): AssetFileDescriptor? {
        if (matcher.match(uri) != CODE_ASSET) return null
        val segs = uri.pathSegments
        if (segs.size != 3) throw FileNotFoundException("Bad asset URI.")
        val pack = packOf(segs[1]) ?: throw FileNotFoundException("Unknown pack.")
        val file = segs[2]
        // Whitelist: only files registered in the stored index are servable.
        val known = pack.stickers.any { it.file == file } || file == pack.trayFile
        if (!known) throw FileNotFoundException("Unknown file.")
        val target = File(pack.dir, file)
        // Canonical-path check: the file must really live inside the pack dir.
        if (!target.canonicalPath.startsWith(pack.dir.canonicalPath + File.separator)) {
            throw FileNotFoundException("Invalid file.")
        }
        if (!target.isFile) throw FileNotFoundException("Missing file.")
        return AssetFileDescriptor(
            ParcelFileDescriptor.open(target, ParcelFileDescriptor.MODE_READ_ONLY),
            0, AssetFileDescriptor.UNKNOWN_LENGTH,
        )
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = throw UnsupportedOperationException()
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = throw UnsupportedOperationException()
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int =
        throw UnsupportedOperationException()
}
