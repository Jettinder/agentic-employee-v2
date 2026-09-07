package com.music.vivi.jett

import android.content.Context
import com.music.innertube.NewPipeExtractor
import com.music.innertube.models.SongItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

class JettRecommendations(private val context:Context){
 private val prefs=context.getSharedPreferences("jett_taste",Context.MODE_PRIVATE); private val model=JettTasteEngine(context)
 fun seedCount():Int=prefs.getStringSet("seed_rows",emptySet())?.size?:0
 suspend fun get(limit:Int=32):List<SongItem> = coroutineScope { val seeds=prefs.getStringSet("seed_rows",emptySet()).orEmpty().filter{it.isNotBlank()}.shuffled().take(6); if(seeds.isEmpty())return@coroutineScope emptyList(); val candidates=seeds.map{seed->async(Dispatchers.IO){NewPipeExtractor.searchSongs(seed,18).getOrDefault(emptyList())}}.awaitAll().flatten().distinctBy{it.id}; val ns=seeds.map(::normalize).toSet(); candidates.filterNot{song->val text=normalize(song.title+" "+song.artists.joinToString(" "){it.name});ns.any{seed->text==seed||text.contains(seed)}}.sortedByDescending{song->model.score(song.title+" "+song.artists.joinToString(" "){it.name})+.08f}.take(limit) }
 private fun normalize(v:String)=v.lowercase().replace(Regex("[^\\p{L}\\p{N}]+")," ").trim()
}
