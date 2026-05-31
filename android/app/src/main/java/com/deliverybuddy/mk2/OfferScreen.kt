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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver

@Composable
fun OfferScreen() {
    val cfg = Store.cfg.value
    var payout by remember { mutableStateOf("") }
    var miles by remember { mutableStateOf("") }
    var target by remember { mutableStateOf(if (cfg.targetHourly > 0) cfg.targetHourly.toInt().toString() else "20") }
    var stops by remember { mutableStateOf(1) }
    var result by remember { mutableStateOf<CalcResult?>(null) }
    var verdict by remember { mutableStateOf<Verdict?>(null) }
    var score by remember { mutableStateOf(0) }
    var analysis by remember { mutableStateOf<Analysis?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var toast by remember { mutableStateOf<String?>(null) }

    // notification auto-capture state
    val ctx = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var captureEnabled by remember { mutableStateOf(CaptureAccess.isEnabled(ctx)) }
    DisposableEffect(lifecycleOwner) {
        val obs = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) captureEnabled = CaptureAccess.isEnabled(ctx)
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }
    val captured = Store.captured.value

    fun analyze() {
        val p = payout.toDoubleOrNull()
        val m = miles.toDoubleOrNull()
        if (p == null || m == null || p <= 0 || m <= 0) {
            error = "Enter payout and miles"; result = null; verdict = null; analysis = null; return
        }
        val t = target.toDoubleOrNull() ?: 20.0
        Store.updateCfg { it.copy(targetHourly = t) }
        val c = Store.cfg.value
        val r = Engine.calc(c, p, m, stops)
        result = r
        verdict = Engine.grade(c, r.eff)
        score = Engine.scoreOffer(c, r, p, m, stops)
        analysis = Analysis(p, m, stops, r.eff, score)
        error = null; toast = null
    }

    fun reset() {
        payout = ""; miles = ""; result = null; verdict = null; analysis = null
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("DeliveryBuddy", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text("Is this offer worth it?", color = Ui.MUTED, fontSize = 13.sp)

        // captured-offer banner (from a delivery-app notification)
        if (captured != null && System.currentTimeMillis() - captured.ts < 10 * 60 * 1000) {
            SectionCard(bg = Color(0x1AFF7A18)) {
                Label("📥 Captured from ${platformOf(captured.platform).name} notification", Ui.ORANGE)
                Text(
                    listOfNotNull(
                        captured.payout?.let { "\$${f2(it)}" },
                        captured.miles?.let { "${f2(it)} mi" },
                        captured.stops?.let { "$it stop${if (it > 1) "s" else ""}" },
                    ).joinToString(" · ").ifBlank { "Offer detected" },
                    color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    Button(
                        onClick = {
                            captured.payout?.let { payout = f2(it) }
                            captured.miles?.let { miles = f2(it) }
                            captured.stops?.let { stops = it }
                            Store.updateCfg { it.copy(platform = captured.platform) }
                            Store.captured.value = null
                            analyze()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Ui.ORANGE),
                        modifier = Modifier.weight(1f),
                    ) { Text("Load & grade", color = Color.White, fontWeight = FontWeight.Bold) }
                    Button(
                        onClick = { Store.captured.value = null },
                        colors = ButtonDefaults.buttonColors(containerColor = Ui.CARD),
                    ) { Text("Dismiss", color = Ui.MUTED) }
                }
            }
        }

        // auto-capture onboarding (only while disabled)
        if (!captureEnabled) {
            SectionCard {
                Label("Auto-capture offers")
                Text(
                    "Let DeliveryBuddy read your Uber/DoorDash/Grubhub offer notifications " +
                        "so it can grade them automatically — read-only, on this device.",
                    color = Ui.MUTED, fontSize = 12.sp, modifier = Modifier.padding(vertical = 6.dp),
                )
                Button(
                    onClick = { CaptureAccess.openSettings(ctx) },
                    colors = ButtonDefaults.buttonColors(containerColor = Ui.ORANGE),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Enable notification access", color = Color.White, fontWeight = FontWeight.Bold) }
            }
        }

        // platform selector
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            PLATFORMS.forEach { plat ->
                val on = cfg.platform == plat.key
                Button(
                    onClick = { Store.updateCfg { it.copy(platform = plat.key) } },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (on) plat.color else Ui.CARD,
                        contentColor = if (on) Ui.BG else Ui.MUTED,
                    ),
                    contentPadding = PaddingHorizontal,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                ) { Text(plat.name, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
            }
        }

        OutlinedTextField(
            value = payout, onValueChange = { payout = it },
            label = { Text("Payout ($)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = miles, onValueChange = { miles = it },
            label = { Text("Miles") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = target, onValueChange = { target = it },
            label = { Text("Target $/hr") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )

        Text("Stops", color = Ui.MUTED, fontSize = 12.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            (0..4).forEach { n ->
                Button(
                    onClick = { stops = n },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (n == stops) Ui.ORANGE else Ui.CARD,
                        contentColor = if (n == stops) Color.White else Ui.MUTED,
                    ),
                    modifier = Modifier.size(54.dp),
                    contentPadding = PaddingZero,
                ) { Text("$n") }
            }
        }

        Button(
            onClick = { analyze() },
            colors = ButtonDefaults.buttonColors(containerColor = Ui.ORANGE),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Analyze", color = Color.White, fontWeight = FontWeight.Bold) }

        error?.let { Text(it, color = Ui.RED, fontSize = 13.sp) }
        toast?.let { Text(it, color = Ui.GREEN, fontSize = 13.sp) }

        val r = result
        val v = verdict
        if (r != null && v != null) {
            ResultCard(r, v, score)
            // decisions
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Button(
                    onClick = {
                        analysis?.let { Store.decide(it, "accepted"); toast = "Accepted — start time logged"; reset() }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Ui.GREEN),
                    modifier = Modifier.weight(1f),
                ) { Text("Accept", color = Ui.BG, fontWeight = FontWeight.Bold) }
                Button(
                    onClick = {
                        analysis?.let { Store.decide(it, "declined"); toast = "Declined — logged"; reset() }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Ui.RED),
                    modifier = Modifier.weight(1f),
                ) { Text("Decline", color = Ui.BG, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

private val PaddingZero = androidx.compose.foundation.layout.PaddingValues(0.dp)
private val PaddingHorizontal = androidx.compose.foundation.layout.PaddingValues(horizontal = 4.dp, vertical = 10.dp)

@Composable
private fun ResultCard(r: CalcResult, v: Verdict, score: Int) {
    val vColor = Color(v.color)
    SectionCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(
                modifier = Modifier.size(54.dp).background(Color(Engine.scoreColor(score)), CircleShape),
                contentAlignment = Alignment.Center,
            ) { Text("$score", color = Ui.BG, fontWeight = FontWeight.Bold) }
            Column {
                Text("${v.icon} ${v.label}", color = vColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text("\$${f2(r.eff)}/hr net", color = vColor, fontSize = 30.sp, fontWeight = FontWeight.Bold)
            }
        }
        Box(modifier = Modifier.size(0.dp, 10.dp))
        KvRow("Net \$/hr", "\$${f2(r.netEff)}")
        KvRow("Gross \$/hr", "\$${f2(r.grossEff)}")
        KvRow("Gas cost", "\$${f2(r.fuel)}")
        KvRow("Drive time", fMin(r.driveMin))
        KvRow("Full cycle", fMin(r.cycleMin))
        KvRow("Min needed", "\$${f2(r.minPay)}")
        Box(modifier = Modifier.size(0.dp, 8.dp))
        val surplusColor = if (r.surplus >= 0) Ui.GREEN else Ui.RED
        Box(modifier = Modifier.fillMaxWidth().background(Ui.BG, RoundedCornerShape(8.dp)).padding(10.dp)) {
            Text(
                if (r.surplus >= 0) "\$${f2(r.surplus)} above target on this offer"
                else "Short \$${f2(-r.surplus)} of target",
                color = surplusColor, fontSize = 13.sp,
            )
        }
    }
}
