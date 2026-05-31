package com.deliverybuddy.mk2

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Parity tests: these expected numbers are computed by hand from the same
 * formulas the PWA uses, so a green run here means the Kotlin engine matches
 * the JS engine that 320 web tests already cover.
 */
class EngineTest {
    private val cfg = Config() // PWA defaults

    @Test
    fun calc_default_12_6_2() {
        val r = Engine.calc(cfg, 12.0, 6.0, 2)
        assertEquals(8.4, r.totalMiles, 1e-9)
        assertEquals(25.2, r.driveMin, 1e-9)
        assertEquals(10.0, r.foodWait, 1e-9)
        assertEquals(35.2, r.cycleMin, 1e-9)
        assertEquals(0.5866666667, r.cycleHr, 1e-6)
        assertEquals(0.14, Engine.cpm(cfg), 1e-12)
        assertEquals(1.176, r.fuel, 1e-9)
        assertEquals(10.824, r.net, 1e-9)
        assertEquals(20.4545454545, r.grossEff, 1e-6)
        assertEquals(18.45, r.netEff, 1e-6)
        assertEquals(18.45, r.eff, 1e-6)       // gradeOnNet = true
        assertEquals(12.9093333333, r.minPay, 1e-6)
        assertEquals(-0.9093333333, r.surplus, 1e-6)
    }

    @Test
    fun grade_thresholds() {
        // eff/target ratios: 1.3 GREAT, 1.0 WORTH IT, 0.85 BORDERLINE, else SKIP
        assertEquals(Verdict.GREAT, Engine.grade(cfg, 26.0))      // 1.30
        assertEquals(Verdict.WORTH_IT, Engine.grade(cfg, 20.0))   // 1.00
        assertEquals(Verdict.BORDERLINE, Engine.grade(cfg, 17.0)) // 0.85
        assertEquals(Verdict.SKIP_IT, Engine.grade(cfg, 16.0))    // 0.80
    }

    @Test
    fun score_default_12_6_2_is_77() {
        val r = Engine.calc(cfg, 12.0, 6.0, 2)
        assertEquals(77, Engine.scoreOffer(cfg, r, 12.0, 6.0, 2))
    }

    @Test
    fun zeroSafety_noDivideByZero() {
        // avgSpeed 0 -> MPM fallback 3; target 0 -> grade uses eff>0 ? 2
        val c = Config(avgSpeed = 0.0, targetHourly = 0.0, mpg = 0.0, gasPrice = 0.0)
        val r = Engine.calc(c, 10.0, 0.0, 0)
        assertTrue(r.eff.isFinite())
        assertEquals(0.0, Engine.cpm(c), 0.0)
        assertEquals(Verdict.GREAT, Engine.grade(c, 5.0)) // target 0, eff>0 -> ratio 2 -> GREAT
    }

    @Test
    fun parseOffer_basicScreenshot() {
        val p = Engine.parseOffer("Deliver by 7:45 PM  \$8.50 guaranteed  4.2 mi est 18 min  2 deliveries")
        assertEquals(8.5, p.payout!!, 1e-9)
        assertEquals(4.2, p.miles!!, 1e-9)
        assertEquals(2, p.stops)
    }

    @Test
    fun parseOffer_filtersHugeAndReadsMiles() {
        val p = Engine.parseOffer("Big \$650 banner; pay \$9 for 12 miles")
        // 650 >= 500 -> filtered out, 9 remains as the largest valid payout
        assertEquals(9.0, p.payout!!, 1e-9)
        assertEquals(12.0, p.miles!!, 1e-9)
        assertNull(p.stops)
    }

    @Test
    fun parseOffer_threeDigitCapMatchesJs() {
        // Faithful to the JS regex \d{1,3}: commas are stripped, then only the
        // first 3 digits are captured, so "$1,234" -> "$1234" -> 123 (a known
        // quirk shared with the PWA; documented so the port stays in lock-step).
        val p = Engine.parseOffer("Total \$1,234")
        assertEquals(123.0, p.payout!!, 1e-9)
    }

    @Test
    fun parseOffer_emptyText() {
        val p = Engine.parseOffer(null)
        assertNull(p.payout)
        assertNull(p.miles)
        assertNull(p.stops)
    }
}
