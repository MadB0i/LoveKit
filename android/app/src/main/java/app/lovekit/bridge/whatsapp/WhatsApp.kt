package app.lovekit.bridge.whatsapp

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import app.lovekit.bridge.BuildConfig

/**
 * Thin facade over WhatsApp's OFFICIAL third-party sticker mechanism
 * (verified against the WhatsApp/stickers sample app):
 * - enable intent: action ENABLE_STICKER_PACK + pack id/authority/name extras
 * - whitelist check providers for consumer + Business apps
 *
 * Never reports success it didn't see: results come from
 * startActivityForResult codes and the whitelist query only.
 */
object WhatsApp {
    const val CONSUMER_PKG = "com.whatsapp"
    const val BUSINESS_PKG = "com.whatsapp.w4b"

    const val ACTION_ENABLE = "com.whatsapp.intent.action.ENABLE_STICKER_PACK"
    const val EXTRA_ID = "sticker_pack_id"
    const val EXTRA_AUTHORITY = "sticker_pack_authority"
    const val EXTRA_NAME = "sticker_pack_name"

    const val ADD_REQUEST_CODE = 200

    data class Presence(val consumer: Boolean, val business: Boolean) {
        val any: Boolean get() = consumer || business
    }

    fun presence(pm: PackageManager): Presence = Presence(has(pm, CONSUMER_PKG), has(pm, BUSINESS_PKG))

    private fun has(pm: PackageManager, pkg: String): Boolean = try {
        @Suppress("DEPRECATION")
        pm.getPackageInfo(pkg, 0)
        true
    } catch (e: PackageManager.NameNotFoundException) {
        false
    }

    fun addIntent(identifier: String, name: String): Intent = Intent().apply {
        action = ACTION_ENABLE
        putExtra(EXTRA_ID, identifier)
        putExtra(EXTRA_AUTHORITY, BuildConfig.CONTENT_PROVIDER_AUTHORITY)
        putExtra(EXTRA_NAME, name)
    }

    /** Fire the official enable flow. Returns false only if nothing handled it. */
    fun requestAdd(activity: Activity, identifier: String, name: String): Boolean {
        return try {
            activity.startActivityForResult(addIntent(identifier, name), ADD_REQUEST_CODE)
            true
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(activity, "WhatsApp isn't installed on this device.", Toast.LENGTH_LONG).show()
            false
        }
    }

    /**
     * Query WhatsApp's whitelist providers. Returns per-app status, or null
     * when the query itself is invalid (WhatsApp too old / provider absent).
     */
    fun whitelistStatus(context: Context, identifier: String): Map<String, Boolean?> {
        val cr: ContentResolver = context.contentResolver
        val authority = BuildConfig.CONTENT_PROVIDER_AUTHORITY
        fun query(waAuthority: String): Boolean? {
            val uri = Uri.parse(
                "content://$waAuthority/is_whitelisted?authority=$authority&identifier=$identifier",
            )
            return try {
                cr.query(uri, null, null, null, null)?.use { c ->
                    if (!c.moveToFirst()) return null
                    val idx = c.getColumnIndex("result")
                    if (idx < 0) return null
                    c.getInt(idx) == 1
                }
            } catch (e: Exception) {
                null // provider missing, permission hiccup — not "added", just unknown
            }
        }
        return mapOf(
            CONSUMER_PKG to query("com.whatsapp.provider.sticker_whitelist_check"),
            BUSINESS_PKG to query("com.whatsapp.w4b.provider.sticker_whitelist_check"),
        )
    }
}
