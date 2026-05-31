package com.deliverybuddy.mk2

import android.content.Context
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import org.json.JSONArray
import org.json.JSONObject
import kotlin.random.Random

/** History row — mirrors a PWA `history[]` entry. */
data class Ride(
    val id: String,
    val p: Double?,            // offered payout
    val m: Double?,            // trip miles
    val stops: Int,
    val platform: String,
    val status: String,        // "accepted" | "completed" | "declined"
    val ts: Long,
    val startedAt: Long?,
    val completedAt: Long?,
    val actualP: Double?,      // final payout incl. tip
    val eff: Double?,          // net (or gross) $/hr at analysis time
    val score: Int?,
)

/** Mirrors a PWA `shifts[]` / `activeShift` entry. */
data class Shift(val id: String, val start: Long, val end: Long?)

/** Mirrors a PWA `expenses[]` entry. */
data class Expense(val id: String, val ts: Long, val kind: String, val amount: Double)

/** const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6) */
fun uid(): String =
    System.currentTimeMillis().toString(36) + Random.nextInt(0, 1 shl 20).toString(36).padStart(4, '0').takeLast(4)

/** What the Offer screen hands to decide/accept actions. */
data class Analysis(
    val p: Double,
    val m: Double,
    val stops: Int,
    val eff: Double,
    val score: Int,
)

/**
 * In-memory app state backed by SharedPreferences, holding the same five
 * buckets the PWA kept in localStorage (db-cfg / db-history / db-shifts /
 * db-activeShift / db-expenses). Compose observes the mutableState* holders.
 */
object Store {
    private const val PREFS = "deliverybuddy"
    private lateinit var prefs: android.content.SharedPreferences

    var cfg = mutableStateOf(Config())
    val history = mutableStateListOf<Ride>()
    val shifts = mutableStateListOf<Shift>()
    var activeShift = mutableStateOf<Shift?>(null)
    val expenses = mutableStateListOf<Expense>()

    var statsWindow = mutableStateOf("today")   // today | week | all
    var histFilter = mutableStateOf("all")      // all | accepted | completed | declined

    fun init(ctx: Context) {
        if (::prefs.isInitialized) return
        prefs = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        load()
    }

    // ── persistence ──────────────────────────────────────────────────────────
    private fun load() {
        prefs.getString("db-cfg", null)?.let { cfg.value = cfgFromJson(JSONObject(it)) }
        prefs.getString("db-history", null)?.let {
            history.clear(); history.addAll(JSONArray(it).objects().map { o -> rideFromJson(o) })
        }
        prefs.getString("db-shifts", null)?.let {
            shifts.clear(); shifts.addAll(JSONArray(it).objects().map { o -> shiftFromJson(o) })
        }
        prefs.getString("db-activeShift", null)?.let {
            activeShift.value = if (it == "null" || it.isBlank()) null else shiftFromJson(JSONObject(it))
        }
        prefs.getString("db-expenses", null)?.let {
            expenses.clear(); expenses.addAll(JSONArray(it).objects().map { o -> expenseFromJson(o) })
        }
    }

    fun save() {
        prefs.edit()
            .putString("db-cfg", cfgToJson(cfg.value).toString())
            .putString("db-history", JSONArray(history.map { rideToJson(it) }).toString())
            .putString("db-shifts", JSONArray(shifts.map { shiftToJson(it) }).toString())
            .putString("db-activeShift", activeShift.value?.let { shiftToJson(it).toString() } ?: "null")
            .putString("db-expenses", JSONArray(expenses.map { expenseToJson(it) }).toString())
            .apply()
    }

    // ── decisions ────────────────────────────────────────────────────────────
    fun decide(a: Analysis, status: String) {
        val now = System.currentTimeMillis()
        history.add(
            0,
            Ride(
                id = uid(), p = a.p, m = a.m, stops = a.stops, platform = cfg.value.platform,
                status = status, ts = now,
                startedAt = if (status == "accepted") now else null,
                completedAt = null, actualP = null, eff = a.eff, score = a.score,
            ),
        )
        if (history.size > 500) history.removeAt(history.lastIndex)
        save()
    }

    fun markCompleted(id: String) {
        val i = history.indexOfFirst { it.id == id }
        if (i < 0) return
        val e = history[i]
        history[i] = e.copy(status = "completed", completedAt = System.currentTimeMillis(),
            startedAt = e.startedAt ?: e.ts)
        save()
    }

    fun setActual(id: String, value: Double) {
        val i = history.indexOfFirst { it.id == id }
        if (i < 0 || value < 0) return
        history[i] = history[i].copy(actualP = value)
        save()
    }

    fun setDetails(id: String, p: Double, m: Double) {
        val i = history.indexOfFirst { it.id == id }
        if (i < 0 || p <= 0 || m <= 0) return
        val e = history[i]
        val r = Engine.calc(cfg.value, p, m, if (e.stops > 0) e.stops else 1)
        history[i] = e.copy(p = p, m = m, eff = r.eff,
            score = Engine.scoreOffer(cfg.value, r, p, m, if (e.stops > 0) e.stops else 1))
        save()
    }

    fun delEntry(id: String) { history.removeAll { it.id == id }; save() }
    fun clearHistory() { history.clear(); save() }

    // ── shifts ───────────────────────────────────────────────────────────────
    fun startShift() { activeShift.value = Shift(uid(), System.currentTimeMillis(), null); save() }
    fun endShift() {
        val a = activeShift.value ?: return
        shifts.add(0, a.copy(end = System.currentTimeMillis()))
        activeShift.value = null
        save()
    }

    // function shiftHours(start)
    fun shiftHours(start: Long): Double {
        var h = 0.0
        shifts.forEach { s -> if (s.end != null && s.start >= start) h += (s.end - s.start) / 3600000.0 }
        return h
    }

    // ── expenses ─────────────────────────────────────────────────────────────
    fun addExpense(kind: String, amount: Double) {
        if (amount <= 0) return
        expenses.add(0, Expense(uid(), System.currentTimeMillis(),
            kind.trim().lowercase().ifBlank { "other" }, amount))
        if (expenses.size > 500) expenses.removeAt(expenses.lastIndex)
        save()
    }

    fun delExpense(id: String) { expenses.removeAll { it.id == id }; save() }

    fun sumExpenses(start: Long): Double =
        expenses.filter { it.ts >= start }.sumOf { it.amount }

    // function workedAvgEff()
    fun workedAvgEff(): Double? {
        val list = history.filter {
            (it.status == "accepted" || it.status == "completed") && it.eff != null
        }.map { it.eff!! }
        return if (list.isEmpty()) null else list.average()
    }

    fun updateCfg(block: (Config) -> Config) { cfg.value = block(cfg.value); save() }

    // ── backup / restore ─────────────────────────────────────────────────────
    fun exportJson(): String = JSONObject().apply {
        put("cfg", cfgToJson(cfg.value))
        put("history", JSONArray(history.map { rideToJson(it) }))
        put("shifts", JSONArray(shifts.map { shiftToJson(it) }))
        put("activeShift", activeShift.value?.let { shiftToJson(it) } ?: JSONObject.NULL)
        put("expenses", JSONArray(expenses.map { expenseToJson(it) }))
        put("exportedAt", System.currentTimeMillis())
    }.toString(2)

    /** Returns true on success. Replaces all current data. */
    fun importJson(text: String): Boolean = try {
        val o = JSONObject(text)
        o.optJSONObject("cfg")?.let { cfg.value = cfgFromJson(it) }
        o.optJSONArray("history")?.let { arr ->
            history.clear(); history.addAll(arr.objects().map { rideFromJson(it) })
        }
        o.optJSONArray("shifts")?.let { arr ->
            shifts.clear(); shifts.addAll(arr.objects().map { shiftFromJson(it) })
        }
        activeShift.value = o.optJSONObject("activeShift")?.let { shiftFromJson(it) }
        o.optJSONArray("expenses")?.let { arr ->
            expenses.clear(); expenses.addAll(arr.objects().map { expenseFromJson(it) })
        }
        save(); true
    } catch (e: Exception) { false }
}

// ── JSON mapping helpers ─────────────────────────────────────────────────────
private fun JSONArray.objects(): List<JSONObject> =
    (0 until length()).map { getJSONObject(it) }

private fun JSONObject.dbl(k: String): Double? = if (has(k) && !isNull(k)) getDouble(k) else null
private fun JSONObject.lng(k: String): Long? = if (has(k) && !isNull(k)) getLong(k) else null

private fun rideToJson(r: Ride) = JSONObject().apply {
    put("id", r.id); put("p", r.p ?: JSONObject.NULL); put("m", r.m ?: JSONObject.NULL)
    put("stops", r.stops); put("platform", r.platform); put("status", r.status); put("ts", r.ts)
    put("startedAt", r.startedAt ?: JSONObject.NULL); put("completedAt", r.completedAt ?: JSONObject.NULL)
    put("actualP", r.actualP ?: JSONObject.NULL); put("eff", r.eff ?: JSONObject.NULL)
    put("score", r.score ?: JSONObject.NULL)
}

private fun rideFromJson(o: JSONObject) = Ride(
    id = o.optString("id", uid()).ifBlank { uid() },
    p = o.dbl("p"), m = o.dbl("m"), stops = o.optInt("stops", 0),
    platform = o.optString("platform", "other"), status = o.optString("status", "accepted"),
    ts = o.optLong("ts", System.currentTimeMillis()),
    startedAt = o.lng("startedAt"), completedAt = o.lng("completedAt"),
    actualP = o.dbl("actualP"), eff = o.dbl("eff"),
    score = if (o.has("score") && !o.isNull("score")) o.getInt("score") else null,
)

private fun shiftToJson(s: Shift) = JSONObject().apply {
    put("id", s.id); put("start", s.start); put("end", s.end ?: JSONObject.NULL)
}

private fun shiftFromJson(o: JSONObject) =
    Shift(o.optString("id", uid()), o.optLong("start", 0), o.lng("end"))

private fun expenseToJson(x: Expense) = JSONObject().apply {
    put("id", x.id); put("ts", x.ts); put("kind", x.kind); put("amount", x.amount)
}

private fun expenseFromJson(o: JSONObject) =
    Expense(o.optString("id", uid()), o.optLong("ts", 0), o.optString("kind", "other"),
        o.optDouble("amount", 0.0))

private fun cfgToJson(c: Config) = JSONObject().apply {
    put("targetHourly", c.targetHourly); put("dailyGoal", c.dailyGoal); put("platform", c.platform)
    put("gradeOnNet", c.gradeOnNet); put("avgSpeed", c.avgSpeed); put("idleMin", c.idleMin)
    put("firstWait", c.firstWait); put("extraWait", c.extraWait); put("mpg", c.mpg)
    put("gasPrice", c.gasPrice); put("irsRate", c.irsRate); put("returnFactor", c.returnFactor)
    put("taxPct", c.taxPct); put("shiftGoalHours", c.shiftGoalHours)
    put("speakVerdict", c.speakVerdict); put("drivingMode", c.drivingMode)
}

private fun cfgFromJson(o: JSONObject): Config {
    val d = Config()
    return Config(
        targetHourly = o.optDouble("targetHourly", d.targetHourly),
        dailyGoal = o.optDouble("dailyGoal", d.dailyGoal),
        platform = o.optString("platform", d.platform),
        gradeOnNet = o.optBoolean("gradeOnNet", d.gradeOnNet),
        avgSpeed = o.optDouble("avgSpeed", d.avgSpeed),
        idleMin = o.optDouble("idleMin", d.idleMin),
        firstWait = o.optDouble("firstWait", d.firstWait),
        extraWait = o.optDouble("extraWait", d.extraWait),
        mpg = o.optDouble("mpg", d.mpg),
        gasPrice = o.optDouble("gasPrice", d.gasPrice),
        irsRate = o.optDouble("irsRate", d.irsRate),
        returnFactor = o.optDouble("returnFactor", d.returnFactor),
        taxPct = o.optDouble("taxPct", d.taxPct),
        shiftGoalHours = o.optDouble("shiftGoalHours", d.shiftGoalHours),
        speakVerdict = o.optBoolean("speakVerdict", d.speakVerdict),
        drivingMode = o.optBoolean("drivingMode", d.drivingMode),
    )
}
