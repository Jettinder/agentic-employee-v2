/** Jettmusic: NewPipe-first search, Vivi UI/models. */
package com.music.vivi.viewmodels

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.music.innertube.NewPipeExtractor
import com.music.innertube.YouTube
import com.music.innertube.YouTube.SearchFilter.Companion.FILTER_SONG
import com.music.innertube.models.filterExplicit
import com.music.innertube.models.filterVideoSongs
import com.music.innertube.models.filterYoutubeShorts
import com.music.innertube.pages.SearchSummary
import com.music.innertube.pages.SearchSummaryPage
import com.music.vivi.constants.HideExplicitKey
import com.music.vivi.constants.HideVideoSongsKey
import com.music.vivi.constants.HideYoutubeShortsKey
import com.music.vivi.models.ItemsPage
import com.music.vivi.utils.dataStore
import com.music.vivi.utils.get
import com.music.vivi.utils.reportException
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URLDecoder
import javax.inject.Inject

@HiltViewModel
class OnlineSearchViewModel @Inject constructor(@ApplicationContext val context:Context,savedStateHandle:SavedStateHandle):ViewModel(){
 val query=try{URLDecoder.decode(savedStateHandle.get<String>("query")!!,"UTF-8")}catch(e:IllegalArgumentException){savedStateHandle.get<String>("query")!!}
 val filter=MutableStateFlow<YouTube.SearchFilter?>(null); var summaryPage by mutableStateOf<SearchSummaryPage?>(null); val viewStateMap=mutableStateMapOf<String,ItemsPage?>()
 init{viewModelScope.launch{filter.collect{f->if(f==null){if(summaryPage==null)loadSummary()}else if(viewStateMap[f.value]==null){if(f==FILTER_SONG)loadSongs(f) else loadInnertube(f)}}}}
 private suspend fun loadSummary(){val np=withContext(Dispatchers.IO){NewPipeExtractor.searchSongs(query,60).getOrNull().orEmpty()};if(np.isNotEmpty()){val songs=np.distinctBy{it.id}.filterExplicit(context.dataStore.get(HideExplicitKey,false)).filterVideoSongs(context.dataStore.get(HideVideoSongsKey,false));summaryPage=SearchSummaryPage(summaries=listOf(SearchSummary(title="Brani",items=songs)));return};YouTube.searchSummary(query).onSuccess{summaryPage=it.filterExplicit(context.dataStore.get(HideExplicitKey,false)).filterVideoSongs(context.dataStore.get(HideVideoSongsKey,false)).filterYoutubeShorts(context.dataStore.get(HideYoutubeShortsKey,false))}.onFailure{reportException(it)}}
 private suspend fun loadSongs(f:YouTube.SearchFilter){val np=withContext(Dispatchers.IO){NewPipeExtractor.searchSongs(query,80).getOrNull().orEmpty()};if(np.isNotEmpty()){viewStateMap[f.value]=ItemsPage(np.distinctBy{it.id}.filterExplicit(context.dataStore.get(HideExplicitKey,false)).filterVideoSongs(context.dataStore.get(HideVideoSongsKey,false)),continuation=null);return};loadInnertube(f)}
 private suspend fun loadInnertube(f:YouTube.SearchFilter){YouTube.search(query,f).onSuccess{r->viewStateMap[f.value]=ItemsPage(r.items.distinctBy{it.id}.filterExplicit(context.dataStore.get(HideExplicitKey,false)).filterVideoSongs(context.dataStore.get(HideVideoSongsKey,false)).filterYoutubeShorts(context.dataStore.get(HideYoutubeShortsKey,false)),r.continuation)}.onFailure{reportException(it)}}
 fun loadMore(){val f=filter.value?:return;if(f==FILTER_SONG)return;viewModelScope.launch{val state=viewStateMap[f.value]?:return@launch;val c=state.continuation?:return@launch;val r=YouTube.searchContinuation(c).getOrNull()?:return@launch;val items=r.items.filterExplicit(context.dataStore.get(HideExplicitKey,false)).filterVideoSongs(context.dataStore.get(HideVideoSongsKey,false)).filterYoutubeShorts(context.dataStore.get(HideYoutubeShortsKey,false));viewStateMap[f.value]=ItemsPage((state.items+items).distinctBy{it.id},r.continuation)}}
}
