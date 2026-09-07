package com.music.vivi.jett

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import com.music.vivi.MainActivity

class JettImportActivity : Activity() {
    companion object { private const val PICK_FILE = 701 }
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); intent?.data?.let(::importUri) ?: openPicker() }
    @Deprecated("Legacy result API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) { super.onActivityResult(requestCode,resultCode,data); if(requestCode==PICK_FILE&&resultCode==RESULT_OK&&data?.data!=null) importUri(data.data!!) else finishToMain("Importazione annullata") }
    private fun openPicker(){ startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply{ addCategory(Intent.CATEGORY_OPENABLE); type="text/*"; putExtra(Intent.EXTRA_MIME_TYPES,arrayOf("text/plain","text/csv","text/markdown","application/csv"))},PICK_FILE) }
    private fun importUri(uri:Uri){ runCatching { val text=contentResolver.openInputStream(uri)?.bufferedReader()?.use{it.readText()}.orEmpty(); val rows=parseRows(text); val engine=JettTasteEngine(this); rows.forEach(engine::trainPositive); engine.persist(); val prefs=getSharedPreferences("jett_taste",MODE_PRIVATE); val existing=prefs.getStringSet("seed_rows",emptySet()).orEmpty(); prefs.edit().putStringSet("seed_rows",(existing+rows).take(10000).toSet()).apply(); finishToMain("Importate ${rows.size} preferenze in Jettmusic") }.onFailure{finishToMain("Importazione non riuscita: ${it.message ?: "file non valido"}")} }
    private fun parseRows(text:String):List<String>{ val lines=text.lineSequence().map{it.trim()}.filter{it.isNotBlank()}.toList(); if(lines.isEmpty())return emptyList(); val first=lines.first().lowercase(); val csv=first.contains(',')&&(first.contains("title")||first.contains("artist")||first.contains("track")||first.contains("song")); if(!csv)return lines.map{it.replace(Regex("^[-*+•\\d.\\)\\s]+"),"").trim()}.filter{it.length>2}.distinct().take(10000); val h=splitCsv(lines.first()).map{it.lowercase().trim()}; val ti=h.indexOfFirst{it=="title"||it=="track"||it=="song"||it=="name"}; val ai=h.indexOfFirst{it=="artist"||it=="artists"||it=="author"}; return lines.drop(1).mapNotNull{ val c=splitCsv(it); val t=c.getOrNull(ti)?.trim().orEmpty(); val a=c.getOrNull(ai)?.trim().orEmpty(); "$t $a".trim().takeIf{x->x.length>2}}.distinct().take(10000) }
    private fun splitCsv(line:String):List<String>{ val o=mutableListOf<String>(); val b=StringBuilder(); var q=false; var i=0; while(i<line.length){val c=line[i]; when{c=='"'&&q&&i+1<line.length&&line[i+1]=='"'->{b.append('"');i++};c=='"'->q=!q;c==','&&!q->{o+=b.toString();b.clear()};else->b.append(c)};i++};o+=b.toString();return o }
    private fun finishToMain(m:String){Toast.makeText(this,m,Toast.LENGTH_LONG).show();startActivity(Intent(this,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP));finish()}
}
