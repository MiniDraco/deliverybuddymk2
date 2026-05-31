package com.deliverybuddy.mk2

import androidx.compose.ui.graphics.Color
import kotlin.math.roundToInt

/** Shared palette + tiny formatters, ported from the PWA's CSS vars / helpers. */
object Ui {
    val BG = Color(0xFF0C0C0F)
    val CARD = Color(0xFF17171C)
    val MUTED = Color(0xFF9CA3AF)
    val FAINT = Color(0xFF6B7280)
    val ORANGE = Color(0xFFFF7A18)
    val GREEN = Color(0xFF4ADE80)
    val YELLOW = Color(0xFFFBBF24)
    val RED = Color(0xFFF87171)
    val BLUE = Color(0xFF60A5FA)
    val PURPLE = Color(0xFFC084FC)
    val TEXT = Color(0xFFE5E7EB)
    val BORDER = Color(0x14FFFFFF)
}

/** PLAT map from the PWA. */
data class Platform(val key: String, val name: String, val color: Color)

val PLATFORMS = listOf(
    Platform("uber", "Uber", Color(0xFFCBD5E1)),       // #ffffff displayed as light slate on dark
    Platform("doordash", "DoorDash", Color(0xFFFF3008)),
    Platform("grubhub", "Grubhub", Color(0xFFF63440)),
    Platform("other", "Other", Color(0xFF9CA3AF)),
)

fun platformOf(key: String?): Platform =
    PLATFORMS.firstOrNull { it.key == key } ?: PLATFORMS.last()

// const f2 = n => (Number(n)||0).toFixed(2)
fun f2(n: Double): String = String.format("%.2f", if (n.isFinite()) n else 0.0)

// const fMin = m => m<1 ? Math.round(m*60)+'s' : (Math.round(m*10)/10)+'m'
fun fMin(m: Double): String =
    if (m < 1) "${(m * 60).roundToInt()}s" else "${(m * 10).roundToInt() / 10.0}m"

// const payoutOf = r => Number(r.actualP!=null ? r.actualP : (r.p!=null ? r.p : 0))||0
fun payoutOf(r: Ride): Double = r.actualP ?: r.p ?: 0.0

// function todayStart(){ const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }
fun todayStart(): Long {
    val c = java.util.Calendar.getInstance()
    c.set(java.util.Calendar.HOUR_OF_DAY, 0)
    c.set(java.util.Calendar.MINUTE, 0)
    c.set(java.util.Calendar.SECOND, 0)
    c.set(java.util.Calendar.MILLISECOND, 0)
    return c.timeInMillis
}

// function winStart(w){ today | week(7d) | all(0) }
fun winStart(w: String): Long = when (w) {
    "today" -> todayStart()
    "week" -> System.currentTimeMillis() - 7L * 86400000L
    else -> 0L
}

// function fmtTime(ts) — short month/day + hh:mm
fun fmtTime(ts: Long): String =
    java.text.SimpleDateFormat("MMM d, h:mm a", java.util.Locale.getDefault()).format(java.util.Date(ts))
