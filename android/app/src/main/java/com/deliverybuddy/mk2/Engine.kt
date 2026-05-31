package com.deliverybuddy.mk2

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * DeliveryBuddy engine — a faithful Kotlin port of the calc/grade/score/parse
 * logic from the PWA's index.html (the version validated by 320 JS tests).
 *
 * Keep this in lock-step with the JS. EngineTest.kt pins the parity values.
 */

/** Mirrors the PWA `cfg` object (numeric + grading fields only). */
data class Config(
    var targetHourly: Double = 20.0,
    var dailyGoal: Double = 150.0,
    var platform: String = "uber",
    var gradeOnNet: Boolean = true,
    var avgSpeed: Double = 20.0,
    var idleMin: Double = 0.0,
    var firstWait: Double = 6.0,
    var extraWait: Double = 4.0,
    var mpg: Double = 25.0,
    var gasPrice: Double = 3.50,
    var irsRate: Double = 0.67,
    var returnFactor: Double = 0.4,
    var taxPct: Double = 0.25,
    var shiftGoalHours: Double = 8.0,
    var speakVerdict: Boolean = false,
    var drivingMode: Boolean = false,
)

/** Mirrors the object returned by JS `calc()`. */
data class CalcResult(
    val driveMin: Double,
    val foodWait: Double,
    val cycleMin: Double,
    val cycleHr: Double,
    val fuel: Double,
    val net: Double,
    val totalMiles: Double,
    val grossEff: Double,
    val netEff: Double,
    val eff: Double,
    val minPay: Double,
    val surplus: Double,
)

enum class Verdict(val label: String, val icon: String, val color: Long) {
    GREAT("GREAT", "🔥", 0xFF4ADE80),
    WORTH_IT("WORTH IT", "✅", 0xFFA3E635),
    BORDERLINE("BORDERLINE", "⚠️", 0xFFFBBF24),
    SKIP_IT("SKIP IT", "❌", 0xFFF87171),
}

/** Mirrors JS `parseOffer()` return. */
data class ParsedOffer(
    val payout: Double? = null,
    val miles: Double? = null,
    val stops: Int? = null,
)

object Engine {

    // const cpm = () => (gasPrice>0 && mpg>0) ? gasPrice/mpg : 0
    fun cpm(cfg: Config): Double =
        if (cfg.gasPrice > 0 && cfg.mpg > 0) cfg.gasPrice / cfg.mpg else 0.0

    // const realMiles = m => (m||0) * (1 + Math.max(0, returnFactor||0))
    fun realMiles(cfg: Config, miles: Double): Double =
        (if (miles.isFinite()) miles else 0.0) * (1 + max(0.0, cfg.returnFactor))

    // function calc(payout, miles, s)
    fun calc(cfg: Config, payout: Double, miles: Double, s: Int): CalcResult {
        val mpm = if (cfg.avgSpeed > 0) 60.0 / cfg.avgSpeed else 3.0
        val totalMiles = realMiles(cfg, miles)
        val driveMin = totalMiles * mpm
        val foodWait = if (s > 0) cfg.firstWait + (s - 1) * cfg.extraWait else 0.0
        val cycleMin = driveMin + foodWait + cfg.idleMin
        val cycleHr = cycleMin / 60.0
        val fuel = totalMiles * cpm(cfg)
        val net = payout - fuel
        val grossEff = if (cycleHr > 0) payout / cycleHr else 0.0
        val netEff = if (cycleHr > 0) net / cycleHr else 0.0
        val eff = if (cfg.gradeOnNet) netEff else grossEff
        val minPay = (if (cfg.targetHourly > 0) cfg.targetHourly else 0.0) * cycleHr +
            (if (cfg.gradeOnNet) fuel else 0.0)
        return CalcResult(
            driveMin = driveMin,
            foodWait = foodWait,
            cycleMin = cycleMin,
            cycleHr = cycleHr,
            fuel = fuel,
            net = net,
            totalMiles = totalMiles,
            grossEff = grossEff,
            netEff = netEff,
            eff = eff,
            minPay = minPay,
            surplus = payout - minPay,
        )
    }

    // function grade(eff)
    fun grade(cfg: Config, eff: Double): Verdict {
        val r = if (cfg.targetHourly > 0) eff / cfg.targetHourly else (if (eff > 0) 2.0 else 0.0)
        return when {
            r >= 1.3 -> Verdict.GREAT
            r >= 1.0 -> Verdict.WORTH_IT
            r >= 0.85 -> Verdict.BORDERLINE
            else -> Verdict.SKIP_IT
        }
    }

    // function scoreOffer(r, payout, miles, s)
    fun scoreOffer(cfg: Config, r: CalcResult, payout: Double, miles: Double, s: Int): Int {
        val ratio = if (cfg.targetHourly > 0) r.eff / cfg.targetHourly else 0.0
        val effScore = min(70.0, max(0.0, ratio * 55))
        val perMile = if (miles > 0) payout / miles else 0.0
        val pmScore = min(20.0, max(0.0, (perMile / 2) * 20))
        val stopScore = max(0.0, 10 - s * 2.0)
        return min(100.0, max(0.0, effScore + pmScore + stopScore)).roundToInt()
    }

    fun scoreColor(sc: Int): Long = when {
        sc >= 80 -> 0xFF4ADE80
        sc >= 60 -> 0xFFA3E635
        sc >= 45 -> 0xFFFBBF24
        else -> 0xFFF87171
    }

    private val MONEY = Regex("""\$\s?(\d{1,3}(?:\.\d{1,2})?)""")
    private val MILES = Regex("""(\d{1,3}(?:\.\d{1,2})?)\s*(?:mi\b|miles?)""", RegexOption.IGNORE_CASE)
    private val STOPS = Regex("""(\d)\s*(?:stops?|orders?|deliver)""", RegexOption.IGNORE_CASE)

    /**
     * function parseOffer(text) — pulls payout (largest $ under 500), miles, and
     * stop count out of raw OCR/notification text.
     */
    fun parseOffer(text: String?): ParsedOffer {
        val t = (text ?: "").replace(",", "")
        val money = MONEY.findAll(t)
            .mapNotNull { it.groupValues[1].toDoubleOrNull() }
            .filter { it > 0 && it < 500 }
            .toList()
        val payout = if (money.isNotEmpty()) money.max() else null
        val miles = MILES.find(t)?.groupValues?.get(1)?.toDoubleOrNull()
        val stops = STOPS.find(t)?.groupValues?.get(1)?.toIntOrNull()?.takeIf { it in 1..4 }
        return ParsedOffer(payout = payout, miles = miles, stops = stops)
    }
}
