package com.deliverybuddy.mk2

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.widget.Toast

@Composable
fun MoreScreen() {
    val cfg = Store.cfg.value
    val clipboard = LocalClipboardManager.current
    val ctx = LocalContext.current
    var showRestore by remember { mutableStateOf(false) }

    val lifecycleOwner = LocalLifecycleOwner.current
    var captureEnabled by remember { mutableStateOf(CaptureAccess.isEnabled(ctx)) }
    DisposableEffect(lifecycleOwner) {
        val obs = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) captureEnabled = CaptureAccess.isEnabled(ctx)
        }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose { lifecycleOwner.lifecycle.removeObserver(obs) }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Settings", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)

        SectionCard {
            Label("Earnings target")
            NumField("Target \$/hr", cfg.targetHourly) { Store.updateCfg { c -> c.copy(targetHourly = it) } }
            NumField("Daily goal (\$)", cfg.dailyGoal) { Store.updateCfg { c -> c.copy(dailyGoal = it) } }
            NumField("Shift goal (hours)", cfg.shiftGoalHours) { Store.updateCfg { c -> c.copy(shiftGoalHours = it) } }
            ToggleRow("Grade on net (after gas)", cfg.gradeOnNet) { Store.updateCfg { c -> c.copy(gradeOnNet = it) } }
        }

        SectionCard {
            Label("Vehicle & costs")
            NumField("Avg speed (mph)", cfg.avgSpeed) { Store.updateCfg { c -> c.copy(avgSpeed = it) } }
            NumField("MPG", cfg.mpg) { Store.updateCfg { c -> c.copy(mpg = it) } }
            NumField("Gas price (\$/gal)", cfg.gasPrice) { Store.updateCfg { c -> c.copy(gasPrice = it) } }
            NumField("Return factor (deadhead, 0.4 = +40%)", cfg.returnFactor) { Store.updateCfg { c -> c.copy(returnFactor = it) } }
        }

        SectionCard {
            Label("Time & waits")
            NumField("First stop wait (min)", cfg.firstWait) { Store.updateCfg { c -> c.copy(firstWait = it) } }
            NumField("Extra stop wait (min)", cfg.extraWait) { Store.updateCfg { c -> c.copy(extraWait = it) } }
            NumField("Idle per trip (min)", cfg.idleMin) { Store.updateCfg { c -> c.copy(idleMin = it) } }
        }

        SectionCard {
            Label("Taxes")
            NumField("Tax set-aside (0.25 = 25%)", cfg.taxPct) { Store.updateCfg { c -> c.copy(taxPct = it) } }
            NumField("IRS mileage rate (\$/mi)", cfg.irsRate) { Store.updateCfg { c -> c.copy(irsRate = it) } }
        }

        SectionCard {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Label("Notification auto-capture")
                Text(
                    if (captureEnabled) "● On" else "○ Off",
                    color = if (captureEnabled) Ui.GREEN else Ui.MUTED, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                )
            }
            Text(
                "Reads your Uber/DoorDash/Grubhub offer notifications (read-only, on-device) " +
                    "and auto-grades them on the Offer tab.",
                color = Ui.MUTED, fontSize = 12.sp, modifier = Modifier.padding(vertical = 6.dp),
            )
            Button(
                onClick = { CaptureAccess.openSettings(ctx) },
                colors = ButtonDefaults.buttonColors(containerColor = if (captureEnabled) Ui.CARD else Ui.ORANGE),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    if (captureEnabled) "Manage notification access" else "Enable notification access",
                    color = if (captureEnabled) Ui.TEXT else Color.White, fontSize = 13.sp,
                )
            }
        }

        SectionCard {
            Label("Backup & restore")
            Text("Your data stays on this device. Export a JSON snapshot to keep it safe.",
                color = Ui.MUTED, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Button(
                    onClick = {
                        clipboard.setText(AnnotatedString(Store.exportJson()))
                        Toast.makeText(ctx, "Backup copied to clipboard", Toast.LENGTH_SHORT).show()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Ui.ORANGE),
                    modifier = Modifier.weight(1f),
                ) { Text("Copy backup", color = Color.White, fontSize = 13.sp) }
                Button(
                    onClick = { showRestore = true },
                    colors = ButtonDefaults.buttonColors(containerColor = Ui.CARD),
                    modifier = Modifier.weight(1f),
                ) { Text("Restore", color = Ui.TEXT, fontSize = 13.sp) }
            }
        }

        Text("DeliveryBuddy MK2 · native build", color = Ui.FAINT, fontSize = 11.sp,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }

    if (showRestore) {
        var text by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showRestore = false },
            containerColor = Ui.CARD,
            title = { Text("Restore from backup", color = Color.White, fontSize = 16.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Paste a backup JSON. This replaces all current data.", color = Ui.MUTED, fontSize = 12.sp)
                    OutlinedTextField(value = text, onValueChange = { text = it },
                        label = { Text("Backup JSON") }, modifier = Modifier.fillMaxWidth(), minLines = 4, maxLines = 8)
                    TextButton(onClick = { clipboard.getText()?.let { text = it.text } }) {
                        Text("Paste from clipboard", color = Ui.ORANGE, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val ok = Store.importJson(text)
                    Toast.makeText(ctx, if (ok) "Restored" else "Invalid backup", Toast.LENGTH_SHORT).show()
                    if (ok) showRestore = false
                }) { Text("Restore", color = Ui.ORANGE) }
            },
            dismissButton = { TextButton(onClick = { showRestore = false }) { Text("Cancel", color = Ui.MUTED) } },
        )
    }
}

@Composable
private fun NumField(label: String, value: Double, onChange: (Double) -> Unit) {
    var text by remember(value) { mutableStateOf(trimNum(value)) }
    OutlinedTextField(
        value = text,
        onValueChange = {
            text = it
            it.toDoubleOrNull()?.let(onChange)
        },
        label = { Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        singleLine = true,
        modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
    )
}

@Composable
private fun ToggleRow(label: String, value: Boolean, onChange: (Boolean) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Ui.TEXT, fontSize = 14.sp)
        Switch(checked = value, onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Ui.ORANGE))
    }
}

private fun trimNum(n: Double): String =
    if (n == n.toLong().toDouble()) n.toLong().toString() else n.toString()
