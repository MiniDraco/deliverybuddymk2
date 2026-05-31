package com.deliverybuddy.mk2

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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

@Composable
fun HistoryScreen() {
    val cfg = Store.cfg.value
    val filter = Store.histFilter.value
    val all = Store.history.toList()

    var tipFor by remember { mutableStateOf<Ride?>(null) }
    var detailsFor by remember { mutableStateOf<Ride?>(null) }
    var confirmClear by remember { mutableStateOf(false) }

    val worked = all.filter { it.status == "accepted" || it.status == "completed" }
    val earned = worked.sumOf { payoutOf(it) }
    val effList = worked.filter { it.eff != null }.map { it.eff!! }
    val avgEff = if (effList.isEmpty()) null else effList.average()
    val declined = all.count { it.status == "declined" }
    val rows = all.filter { if (filter == "all") true else it.status == filter }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("History", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)

        // filter segments
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("all" to "All", "accepted" to "Accepted", "completed" to "Done", "declined" to "Declined").forEach { (k, l) ->
                Button(
                    onClick = { Store.histFilter.value = k },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (filter == k) Ui.ORANGE else Ui.CARD,
                        contentColor = if (filter == k) Color.White else Ui.MUTED,
                    ),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                ) { Text(l, fontSize = 11.sp) }
            }
        }

        if (all.isEmpty()) {
            Text("No rides logged yet", color = Ui.MUTED, fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth().padding(40.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            return@Column
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            Text("${worked.size} worked · $declined declined", color = Ui.MUTED, fontSize = 12.sp)
            TextButton(onClick = { confirmClear = true }) { Text("Clear All", color = Ui.RED, fontSize = 11.sp) }
        }

        // worked average card
        val agColor = if (avgEff != null) Color(Engine.grade(cfg, avgEff).color) else Ui.MUTED
        SectionCard {
            Label("Worked average ${if (cfg.gradeOnNet) "(net)" else "(gross)"}")
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text(if (avgEff != null) "\$${f2(avgEff)}/hr" else "—", color = agColor, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Column(horizontalAlignment = Alignment.End) {
                    Text("Total earned", color = Ui.MUTED, fontSize = 11.sp)
                    Text("\$${f2(earned)}", color = Ui.TEXT, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (rows.isEmpty()) {
            Text("None in this filter", color = Ui.MUTED, fontSize = 12.sp,
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        } else {
            rows.forEach { r -> RideRow(r, cfg, onTip = { tipFor = r }, onDetails = { detailsFor = r }) }
        }
    }

    tipFor?.let { ride ->
        NumberDialog(
            title = "Final payout after tip (\$)",
            initial = (ride.actualP ?: ride.p)?.let { f2(it) } ?: "",
            onDismiss = { tipFor = null },
            onConfirm = { v -> Store.setActual(ride.id, v); tipFor = null },
        )
    }
    detailsFor?.let { ride ->
        TwoNumberDialog(
            title = "Add offer details",
            label1 = "Payout offered (\$)", label2 = "Trip distance (miles)",
            initial1 = ride.p?.let { f2(it) } ?: "", initial2 = ride.m?.let { f2(it) } ?: "",
            onDismiss = { detailsFor = null },
            onConfirm = { p, m -> Store.setDetails(ride.id, p, m); detailsFor = null },
        )
    }
    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            containerColor = Ui.CARD,
            title = { Text("Clear all ride history?", color = Color.White) },
            text = { Text("Back up first if you need it. This can't be undone.", color = Ui.MUTED) },
            confirmButton = { TextButton(onClick = { Store.clearHistory(); confirmClear = false }) { Text("Clear", color = Ui.RED) } },
            dismissButton = { TextButton(onClick = { confirmClear = false }) { Text("Cancel", color = Ui.MUTED) } },
        )
    }
}

@Composable
private fun RideRow(r: Ride, cfg: Config, onTip: () -> Unit, onDetails: () -> Unit) {
    val dot = if (r.eff != null) Color(Engine.grade(cfg, r.eff).color) else Ui.FAINT
    val p = platformOf(r.platform)
    val trip = (r.m?.let { "${f2(it)} mi" } ?: "— mi") + " · " +
        (if (r.stops > 0) "${r.stops} stop${if (r.stops > 1) "s" else ""}" else "no stops")
    val startLine = if (r.startedAt != null) "Started ${fmtTime(r.startedAt)}" else fmtTime(r.ts)
    val payShow = if (payoutOf(r) > 0) "\$${f2(payoutOf(r))}" else "—"
    val tipMark = if (r.actualP != null && r.p != null && r.actualP != r.p) " *" else ""

    SectionCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(modifier = Modifier.size(8.dp).background(dot, CircleShape))
            Column(modifier = Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(p.name, color = p.color, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    StatusBadge(r.status)
                    r.score?.let { Text("$it", color = Color(Engine.scoreColor(it)), fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                }
                Text(trip, color = Ui.MUTED, fontSize = 12.sp)
                Text(startLine, color = Ui.FAINT, fontSize = 10.sp)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("$payShow$tipMark", color = Ui.TEXT, fontSize = 13.sp)
                r.eff?.let { Text("\$${f2(it)}/hr", color = dot, fontSize = 12.sp) }
                if (r.status == "completed" && r.startedAt != null && r.completedAt != null && payoutOf(r) > 0) {
                    val hrs = (r.completedAt - r.startedAt) / 3600000.0
                    if (hrs > 0.01) Text("act \$${f2(payoutOf(r) / hrs)}/hr · ${fMin(hrs * 60)}", color = Ui.BLUE, fontSize = 11.sp)
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End)) {
            if (r.status == "accepted") MiniBtn("Mark done") { Store.markCompleted(r.id) }
            if ((r.status == "accepted" || r.status == "completed") && (r.p == null || r.m == null)) MiniBtn("+ \$/mi", onDetails)
            if (r.status == "accepted" || r.status == "completed") MiniBtn("Tip", onTip)
            MiniBtn("✕") { Store.delEntry(r.id) }
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (label, color) = when (status) {
        "accepted" -> "Accepted" to Ui.GREEN
        "declined" -> "Declined" to Ui.RED
        "completed" -> "Completed" to Ui.BLUE
        else -> return
    }
    Box(modifier = Modifier.background(color.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
        .padding(horizontal = 6.dp, vertical = 2.dp)) {
        Text(label, color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun MiniBtn(label: String, onClick: () -> Unit) {
    TextButton(
        onClick = onClick,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp),
    ) { Text(label, color = Ui.MUTED, fontSize = 11.sp) }
}

@Composable
fun NumberDialog(title: String, initial: String, onDismiss: () -> Unit, onConfirm: (Double) -> Unit) {
    var value by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ui.CARD,
        title = { Text(title, color = Color.White, fontSize = 16.sp) },
        text = {
            OutlinedTextField(value = value, onValueChange = { value = it },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth())
        },
        confirmButton = {
            TextButton(onClick = { value.toDoubleOrNull()?.let { if (it >= 0) onConfirm(it) } }) {
                Text("Save", color = Ui.ORANGE)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Ui.MUTED) } },
    )
}

@Composable
fun TwoNumberDialog(
    title: String, label1: String, label2: String, initial1: String, initial2: String,
    onDismiss: () -> Unit, onConfirm: (Double, Double) -> Unit,
) {
    var v1 by remember { mutableStateOf(initial1) }
    var v2 by remember { mutableStateOf(initial2) }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Ui.CARD,
        title = { Text(title, color = Color.White, fontSize = 16.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(value = v1, onValueChange = { v1 = it }, label = { Text(label1) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = v2, onValueChange = { v2 = it }, label = { Text(label2) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val a = v1.toDoubleOrNull(); val b = v2.toDoubleOrNull()
                if (a != null && b != null && a > 0 && b > 0) onConfirm(a, b)
            }) { Text("Save", color = Ui.ORANGE) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Ui.MUTED) } },
    )
}
