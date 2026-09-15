package app.lovekit.bridge.ui

import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import app.lovekit.bridge.R
import app.lovekit.bridge.importer.ImportResult
import app.lovekit.bridge.importer.PackImporter
import app.lovekit.bridge.store.PackStore

/**
 * Home: import a LoveKit web export, see recent packs, open one.
 * Deliberately small — the web app is the studio; this is the bridge.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var store: PackStore
    private lateinit var importer: PackImporter
    private lateinit var packsList: LinearLayout
    private lateinit var status: TextView
    private lateinit var empty: TextView

    private val pickFolder = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri: Uri? ->
        if (uri == null) return@registerForActivityResult
        contentResolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        runImport { importer.importFromTree(uri) }
    }
    private val pickZip = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        if (uri == null) return@registerForActivityResult
        runImport { importer.importFromZip(uri) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        store = PackStore(filesDir)
        importer = PackImporter(this)

        packsList = findViewById(R.id.packs_list)
        status = findViewById(R.id.status)
        empty = findViewById(R.id.empty)
        findViewById<Button>(R.id.btn_folder).setOnClickListener { pickFolder.launch(null) }
        findViewById<Button>(R.id.btn_zip).setOnClickListener { pickZip.launch(arrayOf("application/zip")) }
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun runImport(block: () -> ImportResult) {
        status.visibility = View.VISIBLE
        status.text = getString(R.string.importing)
        // Import is fast (<1s for normal packs); keep it on the UI thread but
        // never let an exception escape as a crash.
        val result = try {
            block()
        } catch (e: Exception) {
            ImportResult.Failure(listOf("Import failed: ${e.message}"))
        }
        when (result) {
            is ImportResult.Success -> {
                status.text = getString(R.string.imported_ok, result.pack.name)
                PackDetailActivity.open(this, result.pack.identifier)
            }
            is ImportResult.Failure -> {
                status.text = getString(R.string.status_error, result.errors.joinToString("\n"))
            }
        }
        render()
    }

    private fun render() {
        val packs = try {
            store.list()
        } catch (e: Exception) {
            emptyList()
        }
        packsList.removeAllViews()
        empty.visibility = if (packs.isEmpty()) View.VISIBLE else View.GONE
        for (p in packs) {
            val row = layoutInflater.inflate(R.layout.item_pack, packsList, false)
            row.findViewById<TextView>(R.id.pack_name).text = p.name
            row.findViewById<TextView>(R.id.pack_meta).text =
                getString(R.string.pack_meta, p.author, p.stickers.size)
            row.setOnClickListener { PackDetailActivity.open(this, p.identifier) }
            packsList.addView(row)
        }
    }
}
