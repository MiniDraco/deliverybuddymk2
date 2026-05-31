package com.deliverybuddy.mk2

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

@Composable
fun StatsScreen() {
    val cfg = Store.cfg.value
    val window = Store.statsWindow.value
    val active = Store.activeShift.value
    // observe lists for recomposition
    val historySize = Store.history.size
    val expenseSize = Store.expenses.size
    val shiftSize = Store.shifts.size

    var showAddExpense by remember { mutableStateOf(false) }

    val start = winStart(window)
    val worked = Store.history.filter {
        (it.status == "accepted" || it.status == "completed") && (it.startedAt ?: it.ts) >= start
    }
    val declinedArr = Store.history.filter { it.status == "declined" && it.ts >= start }
    val declined = declinedArr.size
    val cpm = Engine.cpm(cfg)
    val earned = worked.sumOf { payoutOf(it) }
    val miles = worked.sumOf { Engine.realMiles(cfg, it.m ?: 0.0) }
    val fuel = miles * cpm
    val net = earned - fuel
    val exp = Store.sumExpenses(start)
    val takeHome = net - exp
    val taxJar = max(0.0, takeHome * max(0.0, cfg.taxPct))
    var onlineHr = Store.shiftHours(start) + (active?.let { (System.currentTimeMillis() - it.start) / 3600000.0 } ?: 0.0)
    var hrSource = "shifts"
    if (onlineHr <= 0.01) {
        onlineHr = worked.filter { it.completedAt != null && it.startedAt != null }
            .sumOf { (it.completedAt!! - it.startedAt!!) / 3600000.0 }
        hrSource = "trips"
    }
    val realHr = if (onlineHr > 0) net / onlineHr else null
    val decisions = worked.size + declined
    val acceptRate = if (decisions > 0) (worked.size.toDouble() / decisions * 100).roundToInt() else null
    val irs = miles * cfg.irsRate
    val goalPct = min(net / max(cfg.dailyGoal, 1.0) * 100, 100.0)

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Stats", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)

        // window selector
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("today" to "Today", "week" to "Week", "all" to "All").forEach { (k, l) ->
                Button(
                    onClick = { Store.statsWindow.value = k },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (window == k) Ui.ORANGE else Ui.CARD,
                        contentColor = if (window == k) Color.White else Ui.MUTED,
                    ),
                    shape = RoundedCornerShape(8.dp),
                ) { Text(l, fontSize = 12.sp) }
            }
        }

        // shift control
        Button(
            onClick = { if (active != null) Store.endShift() else Store.startShift() },
            colors = ButtonDefaults.buttonColors(
                containerColor = if (active != null) Ui.RED else Ui.GREEN,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                if (active != null) "■ End shift · ${fMin((System.currentTimeMillis() - active.start) / 60000.0)}"
                else "● Start shift",
                color = Ui.BG, fontWeight = FontWeight.Bold,
            )
        }

        // net profit card
        SectionCard {
            Label(
                "Net profit " + when (window) {
                    "today" -> "today"; "week" -> "(7 days)"; else -> "(all time)"
                },
            )
            Text("\$${f2(net)}", color = Ui.GREEN, fontSize = 34.sp, fontWeight = FontWeight.Bold)
            Text(
                "\$${f2(earned)} earned − \$${f2(fuel)} gas · ${worked.size} deliveries",
                color = Ui.MUTED, fontSize = 11.sp,
            )
            if (exp > 0) {
                Text("− \$${f2(exp)} expenses = \$${f2(takeHome)} take-home", color = Ui.RED, fontSize = 11.sp)
            }
            if (window == "today" && realHr != null && onlineHr > 0.1) {
                val proj = realHr * max(onlineHr, cfg.shiftGoalHours)
                val remainHr = max(0.0, cfg.shiftGoalHours - onlineHr)
                Text(
                    "On pace for ~\$${f2(proj)} net by ${cfg.shiftGoalHours.toInt()}h" +
                        if (remainHr > 0) " (${fMin(remainHr * 60)} to go)" else "",
                    color = Ui.BLUE, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp),
                )
            }
            if (window == "today") {
                Box(modifier = Modifier.padding(top = 8.dp).fillMaxWidth().height(8.dp)
                    .background(Ui.BG, RoundedCornerShape(4.dp))) {
                    Box(modifier = Modifier.fillMaxWidth(goalPct.toFloat() / 100f).height(8.dp)
                        .background(Ui.ORANGE, RoundedCornerShape(4.dp)))
                }
                Text("${goalPct.roundToInt()}% of \$${cfg.dailyGoal.toInt()} goal",
                    color = Ui.FAINT, fontSize = 10.sp, modifier = Modifier.padding(top = 5.dp))
            }
        }

        // tiles grid (2 columns)
        val realHrColor = if (realHr != null) (if (realHr >= cfg.targetHourly) Ui.GREEN else Ui.YELLOW) else Ui.FAINT
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatTile("Real \$/hr ${if (onlineHr > 0) "($hrSource)" else ""}",
                    if (realHr != null) "\$${f2(realHr)}" else "—", realHrColor, Modifier.weight(1f))
                StatTile("Online time", if (onlineHr > 0) fMin(onlineHr * 60) else "—", modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatTile("Accept rate", if (acceptRate != null) "$acceptRate%" else "—", modifier = Modifier.weight(1f))
                StatTile("Avg / delivery", if (worked.isNotEmpty()) "\$${f2(earned / worked.size)}" else "—", modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatTile("Miles (incl. return)", "${f2(miles)} mi", modifier = Modifier.weight(1f))
                StatTile("Tax deduction est.", "\$${f2(irs)}", Ui.BLUE, Modifier.weight(1f))
            }
        }

        // tax jar
        SectionCard(bg = Color(0x0FFBBF24)) {
            Label("🫙 Tax set-aside jar (${(cfg.taxPct * 100).roundToInt()}%)", Ui.YELLOW)
            Text("\$${f2(taxJar)}", color = Ui.YELLOW, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text("Stash this from take-home so taxes don't sting", color = Ui.FAINT, fontSize = 10.sp)
        }

        // decline-regret
        val avg = Store.workedAvgEff()
        if (avg != null) {
            val regret = declinedArr.filter { it.eff != null && it.eff > avg }
            if (regret.isNotEmpty()) {
                SectionCard(bg = Color(0x12C084FC)) {
                    Label("Decline check", Ui.PURPLE)
                    Text(
                        "You declined ${regret.size} offer${if (regret.size > 1) "s" else ""} that beat your " +
                            "\$${f2(avg)}/hr average. Best skipped: \$${f2(regret.maxOf { it.eff!! })}/hr.",
                        color = Ui.TEXT, fontSize = 12.sp,
                    )
                }
            }
        }

        // expenses
        SectionCard {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Label("Expenses (this window)")
                TextButton(onClick = { showAddExpense = true }) { Text("+ Add", color = Ui.ORANGE, fontSize = 12.sp) }
            }
            val expList = Store.expenses.filter { it.ts >= start }
            if (expList.isEmpty()) {
                Text("None logged — tolls, car wash, supplies…", color = Ui.FAINT, fontSize = 11.sp)
            } else {
                expList.take(8).forEach { x ->
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(x.kind.replaceFirstChar { it.uppercase() }, color = Ui.TEXT, fontSize = 12.sp)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("-\$${f2(x.amount)}", color = Ui.RED, fontSize = 12.sp)
                            TextButton(onClick = { Store.delExpense(x.id) }) { Text("✕", color = Ui.MUTED) }
                        }
                    }
                }
            }
        }

        // by platform
        val byPlat = LinkedHashMap<String, Pair<Int, Double>>()
        worked.forEach { r ->
            val k = r.platform.ifBlank { "other" }
            val cur = byPlat[k] ?: (0 to 0.0)
            byPlat[k] = (cur.first + 1) to (cur.second + payoutOf(r) - Engine.realMiles(cfg, r.m ?: 0.0) * cpm)
        }
        if (byPlat.isNotEmpty()) {
            SectionCard {
                Label("By platform")
                byPlat.forEach { (k, v) ->
                    val p = platformOf(k)
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(p.name, color = p.color, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("${v.first} · \$${f2(v.second)} net", color = Ui.TEXT, fontSize = 12.sp)
                    }
                }
            }
        }

        if (worked.isEmpty() && Store.expenses.none { it.ts >= start }) {
            Text("No activity in this window yet", color = Ui.MUTED, fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth().padding(24.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }

        // keep lint happy referencing observed sizes
        Box(modifier = Modifier.height((0 * (historySize + expenseSize + shiftSize)).dp))
    }

    if (showAddExpense) {
        AddExpenseDialog(onDismiss = { showAddExpense = false }, onAdd = { kind, amt ->
            Store.addExpense(kind, amt); showAddExpense = false
        })
    }
}

@Composable
private fun AddExpenseDialog(onDismiss: () -> Unit, onAdd: (String, Double) -> Unit) {
    var kind by remember { mutableStateOf("gas") }
    var amount by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ui.CARD,
        title = { Text("Add expense", color = Color.White) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(value = kind, onValueChange = { kind = it },
                    label = { Text("Type (gas, tolls, supplies…)") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = amount, onValueChange = { amount = it },
                    label = { Text("Amount ($)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            TextButton(onClick = { amount.toDoubleOrNull()?.let { if (it > 0) onAdd(kind, it) } }) {
                Text("Add", color = Ui.ORANGE)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Ui.MUTED) } },
    )
}
