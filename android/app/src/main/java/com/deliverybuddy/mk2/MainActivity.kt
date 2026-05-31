package com.deliverybuddy.mk2

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
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
import kotlin.math.roundToInt

private val BG = Color(0xFF0C0C0F)
private val CARD = Color(0xFF17171C)
private val MUTED = Color(0xFF9CA3AF)
private val ORANGE = Color(0xFFFF7A18)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(background = BG, surface = BG, primary = ORANGE)) {
                Surface(modifier = Modifier.fillMaxSize(), color = BG) {
                    OfferScreen()
                }
            }
        }
    }
}

private fun f2(n: Double): String = String.format("%.2f", if (n.isFinite()) n else 0.0)
private fun fMin(m: Double): String =
    if (m < 1) "${(m * 60).roundToInt()}s" else "${(m * 10).roundToInt() / 10.0}m"

@Composable
private fun OfferScreen() {
    var payout by remember { mutableStateOf("") }
    var miles by remember { mutableStateOf("") }
    var target by remember { mutableStateOf("20") }
    var stops by remember { mutableStateOf(1) }
    var result by remember { mutableStateOf<CalcResult?>(null) }
    var verdict by remember { mutableStateOf<Verdict?>(null) }
    var score by remember { mutableStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }

    fun analyze() {
        val p = payout.toDoubleOrNull()
        val m = miles.toDoubleOrNull()
        if (p == null || m == null || p <= 0 || m <= 0) {
            error = "Enter payout and miles"; result = null; verdict = null; return
        }
        val cfg = Config(targetHourly = target.toDoubleOrNull() ?: 20.0)
        val r = Engine.calc(cfg, p, m, stops)
        result = r
        verdict = Engine.grade(cfg, r.eff)
        score = Engine.scoreOffer(cfg, r, p, m, stops)
        error = null
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("DeliveryBuddy", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text("Is this offer worth it?", color = MUTED, fontSize = 13.sp)

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

        Text("Stops", color = MUTED, fontSize = 12.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            (0..4).forEach { n ->
                Button(
                    onClick = { stops = n },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (n == stops) ORANGE else CARD,
                        contentColor = if (n == stops) Color.White else MUTED,
                    ),
                    modifier = Modifier.size(54.dp),
                ) { Text("$n") }
            }
        }

        Button(
            onClick = { analyze() },
            colors = ButtonDefaults.buttonColors(containerColor = ORANGE),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Analyze", color = Color.White, fontWeight = FontWeight.Bold) }

        error?.let { Text(it, color = Color(0xFFF87171), fontSize = 13.sp) }

        val r = result
        val v = verdict
        if (r != null && v != null) {
            ResultCard(r, v, score)
        }
    }
}

@Composable
private fun ResultCard(r: CalcResult, v: Verdict, score: Int) {
    val vColor = Color(v.color)
    Card(colors = CardDefaults.cardColors(containerColor = CARD)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(
                    modifier = Modifier.size(54.dp).background(Color(Engine.scoreColor(score)), CircleShape),
                    contentAlignment = Alignment.Center,
                ) { Text("$score", color = BG, fontWeight = FontWeight.Bold) }
                Column {
                    Text("${v.icon} ${v.label}", color = vColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text("\$${f2(r.eff)}/hr net", color = vColor, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                }
            }
            Tile("Net \$/hr", "\$${f2(r.netEff)}")
            Tile("Gross \$/hr", "\$${f2(r.grossEff)}")
            Tile("Gas cost", "\$${f2(r.fuel)}")
            Tile("Drive time", fMin(r.driveMin))
            Tile("Full cycle", fMin(r.cycleMin))
            Tile("Min needed", "\$${f2(r.minPay)}")
            val surplusColor = if (r.surplus >= 0) Color(0xFF4ADE80) else Color(0xFFF87171)
            Box(
                modifier = Modifier.fillMaxWidth().background(CARD, RoundedCornerShape(8.dp)).padding(10.dp),
            ) {
                Text(
                    if (r.surplus >= 0) "\$${f2(r.surplus)} above target on this offer"
                    else "Short \$${f2(-r.surplus)} of target",
                    color = surplusColor, fontSize = 13.sp,
                )
            }
        }
    }
}

@Composable
private fun Tile(k: String, v: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(k, color = MUTED, fontSize = 13.sp)
        Text(v, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}
