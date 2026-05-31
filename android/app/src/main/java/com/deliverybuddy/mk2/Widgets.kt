package com.deliverybuddy.mk2

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** A bordered dark card, like the PWA `.card`. */
@Composable
fun SectionCard(
    modifier: Modifier = Modifier,
    bg: Color = Ui.CARD,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = bg),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(modifier = Modifier.padding(14.dp), content = content)
    }
}

/** A small dimmed label like `.lbl`. */
@Composable
fun Label(text: String, color: Color = Ui.MUTED) {
    Text(text, color = color, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
}

/** Key/value row inside a card. */
@Composable
fun KvRow(k: String, v: String, valueColor: Color = Color.White) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(k, color = Ui.MUTED, fontSize = 13.sp)
        Text(v, color = valueColor, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

/** A `.tile` stat block (label over a big value). */
@Composable
fun StatTile(label: String, value: String, valueColor: Color = Color.White, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Ui.CARD),
        shape = RoundedCornerShape(10.dp),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(label, color = Ui.MUTED, fontSize = 11.sp)
            Text(value, color = valueColor, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}
