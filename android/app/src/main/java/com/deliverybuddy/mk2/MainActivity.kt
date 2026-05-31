package com.deliverybuddy.mk2

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Store.init(this)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = Ui.BG, surface = Ui.BG, primary = Ui.ORANGE,
                ),
            ) {
                Surface(modifier = Modifier.fillMaxSize(), color = Ui.BG) {
                    AppShell()
                }
            }
        }
    }
}

private data class Tab(val label: String, val icon: String)

private val TABS = listOf(
    Tab("Offer", "💵"),   // 💵
    Tab("Stats", "📊"),   // 📊
    Tab("History", "🕒"), // 🕒
    Tab("Min \$", "📋"),  // 📋
    Tab("More", "⚙️"),    // ⚙️
)

@Composable
private fun AppShell() {
    var tab by remember { mutableIntStateOf(0) }
    Scaffold(
        containerColor = Ui.BG,
        bottomBar = {
            NavigationBar(containerColor = Ui.CARD) {
                TABS.forEachIndexed { i, t ->
                    NavigationBarItem(
                        selected = tab == i,
                        onClick = { tab = i },
                        icon = { Text(t.icon, fontSize = 18.sp) },
                        label = { Text(t.label, fontSize = 11.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Ui.ORANGE,
                            selectedTextColor = Ui.ORANGE,
                            unselectedIconColor = Ui.MUTED,
                            unselectedTextColor = Ui.MUTED,
                            indicatorColor = Ui.BG,
                        ),
                    )
                }
            }
        },
    ) { pad ->
        Surface(modifier = Modifier.fillMaxSize().padding(pad), color = Ui.BG) {
            when (tab) {
                0 -> OfferScreen()
                1 -> StatsScreen()
                2 -> HistoryScreen()
                3 -> RefScreen()
                else -> MoreScreen()
            }
        }
    }
}
