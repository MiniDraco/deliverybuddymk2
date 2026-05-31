package com.deliverybuddy.mk2

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

@Composable
fun RefScreen() {
    val cfg = Store.cfg.value
    var stops by remember { mutableStateOf(1) }
    val dists = listOf(2.0, 3.0, 4.0, 5.0, 5.5, 6.0, 7.0, 8.0, 10.0, 12.0, 15.0)

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Minimum \$ table", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(
            "Least an offer must pay to hit \$${cfg.targetHourly.toInt()}/hr " +
                (if (cfg.gradeOnNet) "(incl. gas)" else ""),
            color = Ui.MUTED, fontSize = 12.sp,
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
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
                    modifier = Modifier.weight(1f),
                ) { Text("$n") }
            }
        }

        SectionCard {
            Row(modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp)) {
                HeaderCell("Miles", Modifier.weight(1f))
                HeaderCell("Drive", Modifier.weight(1f))
                HeaderCell("Cycle", Modifier.weight(1f))
                HeaderCell("Min \$", Modifier.weight(1f))
            }
            dists.forEachIndexed { i, d ->
                val r = Engine.calc(cfg, 0.0, d, stops)
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .background(if (i % 2 == 1) Ui.BG else Color.Transparent, RoundedCornerShape(6.dp))
                        .padding(vertical = 7.dp, horizontal = 4.dp),
                ) {
                    Cell("$d", Ui.TEXT, Modifier.weight(1f))
                    Cell(fMin(r.driveMin), Ui.MUTED, Modifier.weight(1f))
                    Cell(fMin(r.cycleMin), Ui.MUTED, Modifier.weight(1f))
                    Cell("\$${f2(r.minPay)}", Ui.ORANGE, Modifier.weight(1f))
                }
            }
        }

        val wait = if (stops > 0) cfg.firstWait + (stops - 1) * cfg.extraWait else 0.0
        val footer = buildString {
            append(if (stops > 0) "Food wait: ${wait.toInt()} min" else "No food stop")
            if (cfg.idleMin > 0) append(" + ${cfg.idleMin.toInt()} min idle")
            if (cfg.returnFactor > 0) append(" · +${(cfg.returnFactor * 100).roundToInt()}% return")
            append(" · ${cfg.avgSpeed.toInt()} mph")
        }
        Text(footer, color = Ui.FAINT, fontSize = 11.sp)
    }
}

@Composable
private fun HeaderCell(text: String, modifier: Modifier) {
    Text(text, color = Ui.MUTED, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = modifier)
}

@Composable
private fun Cell(text: String, color: Color, modifier: Modifier) {
    Text(text, color = color, fontSize = 13.sp, modifier = modifier)
}
