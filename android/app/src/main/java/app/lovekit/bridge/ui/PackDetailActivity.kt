package app.lovekit.bridge.ui

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.GridLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import app.lovekit.bridge.R
import app.lovekit.bridge.pack.AssetInfo
import app.lovekit.bridge.pack.ImageProbe
import app.lovekit.bridge.pack.PackValidator
import app.lovekit.bridge.store.PackStore
import app.lovekit.bridge.store.StoredPack
import app.lovekit.bridge.whatsapp.WhatsApp
import java.io.File

/**
 * Pack preview + validation checklist + the genuine "Add to WhatsApp" flow.
 * Success is reported ONLY from the activity result + whitelist re-check.
 */
class PackDetailActivity : AppCompatActivity() {

    companion object {
        private const val EXTRA_ID = "pack_id"
        fun open(ctx: Context, identifier: String) {
            ctx.startActivity(Intent(ctx, PackDetailActivity::class.java).putExtra(EXTRA_ID, identifier))
        }
    }

    private lateinit var store: PackStore
    private var pack: StoredPack? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pack_detail)
        store = PackStore(filesDir)
        val id = intent.getStringExtra(EXTRA_ID).orEmpty()
        pack = store.get(id)
        if (pack == null) {
            Toast.makeText(this, R.string.pack_gone, Toast.LENGTH_LONG).show()
            finish()
            return
        }
        render()
        findViewById<Button>(R.id.btn_add).setOnClickListener { onAdd() }
        findViewById<Button>(R.id.btn_delete).setOnClickListener { onDelete() }
    }

    override fun onResume() {
        super.onResume()
        refreshWhitelist()
    }

    private fun render() {
        val p = pack ?: return
        findViewById<TextView>(R.id.detail_name).text = p.name
        findViewById<TextView>(R.id.detail_meta).text = getString(R.string.pack_meta_long, p.author, p.stickers.size, p.description)

        // Re-validate the stored files (defence in depth: storage may change).
        val checks = validateStored(p)
        val list = findViewById<LinearLayout>(R.id.checks)
        list.removeAllViews()
        for ((ok, text) in checks) {
            val row = TextView(this)
            row.text = getString(R.string.check_row, if (ok) "✓" else "❌", text)
            row.textSize = 14f
            list.addView(row)
        }
        val add = findViewById<Button>(R.id.btn_add)
        add.isEnabled = checks.all { it.first }

        // Tray + sticker grid from internal files (never from request paths).
        val trayFile = File(p.dir, p.trayFile)
        if (trayFile.isFile) {
            findViewById<ImageView>(R.id.tray).setImageBitmap(BitmapFactory.decodeFile(trayFile.absolutePath))
        }
        val grid = findViewById<GridLayout>(R.id.grid)
        grid.removeAllViews()
        grid.columnCount = 3
        for (s in p.stickers) {
            val f = File(p.dir, s.file)
            if (!f.isFile) continue
            val iv = ImageView(this)
            val bmp = BitmapFactory.decodeFile(f.absolutePath)
            iv.setImageBitmap(bmp)
            iv.contentDescription = s.name.ifEmpty { s.file }
            val size = resources.displayMetrics.widthPixels / 3 - 32
            iv.layoutParams = GridLayout.LayoutParams().apply {
                width = size
                height = size
                setMargins(8, 8, 8, 8)
                setGravity(Gravity.CENTER)
            }
            iv.scaleType = ImageView.ScaleType.FIT_CENTER
            grid.addView(iv)
        }
        refreshWhitelist()
    }

    /** Re-probe stored bytes and rebuild the checklist shown to the user. */
    private fun validateStored(p: StoredPack): List<Pair<Boolean, String>> {
        val out = ArrayList<Pair<Boolean, String>>()
        fun fileOk(name: String): AssetInfo? {
            val f = File(p.dir, name)
            if (!f.isFile) return null
            val bytes = f.readBytes()
            val probed = ImageProbe.probe(bytes)
            return AssetInfo(name, bytes.size.toLong(), probed.width, probed.height, probed.magic, PackValidator.sha256Hex(bytes))
        }
        val tray = fileOk(p.trayFile)
        out.add(Pair(tray != null && PackValidator.validateTrayAsset(tray).isEmpty(), getString(R.string.check_tray)))
        var okStickers = 0
        val seen = HashSet<String>()
        var dupes = 0
        for (s in p.stickers) {
            val a = fileOk(s.file) ?: continue
            if (!seen.add(a.sha256)) {
                dupes++
                continue
            }
            if (PackValidator.validateStickerAsset(a).isEmpty()) okStickers++
        }
        out.add(Pair(okStickers == p.stickers.size && dupes == 0, getString(R.string.check_stickers, okStickers, p.stickers.size)))
        out.add(Pair(p.stickers.size in PackValidator.MIN_STICKERS..PackValidator.MAX_STICKERS, getString(R.string.check_count, p.stickers.size)))
        out.add(Pair(true, getString(R.string.check_manifest)))
        return out
    }

    private fun refreshWhitelist() {
        val p = pack ?: return
        val view = findViewById<TextView>(R.id.whitelist)
        val presence = WhatsApp.presence(packageManager)
        if (!presence.any) {
            view.text = getString(R.string.no_whatsapp)
            return
        }
        val status = try {
            WhatsApp.whitelistStatus(this, p.identifier)
        } catch (e: Exception) {
            null
        }
        view.text = when {
            status == null -> getString(R.string.whitelist_unknown)
            status.values.any { it == true } -> getString(R.string.whitelist_added)
            else -> getString(R.string.whitelist_not_added)
        }
    }

    private fun onAdd() {
        val p = pack ?: return
        val presence = WhatsApp.presence(packageManager)
        if (!presence.any) {
            Toast.makeText(this, R.string.no_whatsapp, Toast.LENGTH_LONG).show()
            return
        }
        if (!WhatsApp.requestAdd(this, p.identifier, p.name)) {
            Toast.makeText(this, R.string.no_whatsapp, Toast.LENGTH_LONG).show()
        }
        // Result arrives in onActivityResult below — never assume success here.
    }

    @Deprecated("Required for the official WhatsApp enable flow.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != WhatsApp.ADD_REQUEST_CODE) return
        val p = pack ?: return
        if (resultCode == RESULT_CANCELED) {
            Toast.makeText(this, R.string.add_cancelled, Toast.LENGTH_LONG).show()
            return
        }
        // RESULT_OK from WhatsApp's confirm screen — re-check the whitelist
        // before celebrating, so we never show fake success.
        val status = try {
            WhatsApp.whitelistStatus(this, p.identifier)
        } catch (e: Exception) {
            null
        }
        if (status?.values?.any { it == true } == true) {
            Toast.makeText(this, getString(R.string.added_ok), Toast.LENGTH_LONG).show()
        } else {
            Toast.makeText(this, R.string.add_unconfirmed, Toast.LENGTH_LONG).show()
        }
        refreshWhitelist()
    }

    private fun onDelete() {
        val p = pack ?: return
        store.delete(p.identifier)
        Toast.makeText(this, R.string.deleted, Toast.LENGTH_SHORT).show()
        finish()
    }
}
