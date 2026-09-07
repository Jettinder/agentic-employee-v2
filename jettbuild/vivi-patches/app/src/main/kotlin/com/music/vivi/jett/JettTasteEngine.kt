package com.music.vivi.jett

import android.content.Context
import kotlin.math.exp
import kotlin.math.sqrt

class JettTasteEngine(context: Context) {
    private val prefs=context.getSharedPreferences("jett_taste",Context.MODE_PRIVATE); private val input=32; private val hidden=16; private val lr=.025f
    private var w1=load("w1",input*hidden){i->(((i*1103515245L+12345L) ushr 16)%2001/10000f)-.10f}; private var b1=load("b1",hidden){0f}; private var w2=load("w2",hidden){i->(((i*1664525L+1013904223L) ushr 16)%2001/10000f)-.10f}; private var b2=prefs.getFloat("b2",0f)
    private fun load(k:String,n:Int,init:(Int)->Float):FloatArray{val raw=prefs.getString(k,null);if(raw!=null){val p=raw.split(',');if(p.size==n)return FloatArray(n){p[it].toFloatOrNull()?:init(it)}};return FloatArray(n){init(it)}}
    private fun vector(text:String):FloatArray{val o=FloatArray(input);val tokens=text.lowercase().replace(Regex("[^\\p{L}\\p{N}]+")," ").trim().split(Regex("\\s+")).filter{it.length>1};for(t in tokens){val h=t.hashCode();val idx=(h and Int.MAX_VALUE)%input;val sign=if(((h ushr 5) and 1)==0)1f else -1f;o[idx]+=sign};var n=0f;for(v in o)n+=v*v;n=sqrt(n).coerceAtLeast(1f);for(i in o.indices)o[i]/=n;return o}
    private fun forward(x:FloatArray):Pair<FloatArray,Float>{val h=FloatArray(hidden);for(j in 0 until hidden){var z=b1[j];for(i in 0 until input)z+=x[i]*w1[i*hidden+j];h[j]=if(z>0)z else 0f};var z=b2;for(j in 0 until hidden)z+=h[j]*w2[j];return h to (1.0/(1.0+exp(-z.toDouble()))).toFloat()}
    fun score(text:String)=forward(vector(text)).second
    @Synchronized fun trainPositive(text:String)=train(text,1f); @Synchronized fun trainNegative(text:String)=train(text,0f)
    private fun train(text:String,label:Float){val x=vector(text);val(h,y)=forward(x);val dz2=y-label;val old=w2.copyOf();for(j in 0 until hidden)w2[j]-=lr*dz2*h[j];b2-=lr*dz2;for(j in 0 until hidden){if(h[j]<=0)continue;val dz1=dz2*old[j];for(i in 0 until input)w1[i*hidden+j]-=lr*dz1*x[i];b1[j]-=lr*dz1}}
    fun persist(){prefs.edit().putString("w1",w1.joinToString(",")).putString("b1",b1.joinToString(",")).putString("w2",w2.joinToString(",")).putFloat("b2",b2).apply()}
}
