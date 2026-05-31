package com.deliverybuddy.mk2

import android.content.Intent
import android.net.Uri
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
        handleSharedImage(intent)
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleSharedImage(intent)
    }

    /** A screenshot shared into the app → OCR → parse → Store.captured banner. */
    private fun handleSharedImage(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND) return
        if (intent.type?.startsWith("image/") != true) return
        @Suppress("DEPRECATION")
        val uri: Uri = intent.getParcelableExtra(Intent.EXTRA_STREAM) ?: return
        OfferOcr.scan(
            applicationContext, uri,
            onText = { text ->
                val parsed = Engine.parseOffer(text)
                if (parsed.payout != null || parsed.miles != null) {
                    Store.captured.value = CapturedOffer(
                        platform = Store.cfg.value.platform,
                        payout = parsed.payout, miles = parsed.miles, stops = parsed.stops,
                        raw = text.take(300), ts = System.currentTimeMillis(),
                    )
                }
            },
            onError = { },
        )
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
