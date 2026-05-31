package com.deliverybuddy.mk2

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Reads the user's OWN incoming delivery-app notifications (read-only) and, when
 * one looks like an offer, parses payout/miles/stops via the ported Engine and
 * stashes it in Store.captured for the Offer screen to load.
 *
 * This does NOT auto-accept, inject input, or talk to the delivery platforms —
 * it only reads notifications the user already receives, on-device.
 */
class OfferCaptureService : NotificationListenerService() {

    override fun onListenerConnected() {
        Store.init(applicationContext)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        val platform = PACKAGE_PLATFORM[sbn.packageName]
            ?: PACKAGE_PLATFORM.entries.firstOrNull { sbn.packageName.startsWith(it.key) }?.value
            ?: return

        Store.init(applicationContext)
        val text = extractText(sbn.notification)
        if (text.isBlank()) return

        val parsed = Engine.parseOffer(text)
        // Only surface things that actually look like an offer.
        if (parsed.payout == null && parsed.miles == null) return

        Store.captured.value = CapturedOffer(
            platform = platform,
            payout = parsed.payout,
            miles = parsed.miles,
            stops = parsed.stops,
            raw = text.take(300),
            ts = System.currentTimeMillis(),
        )
    }

    private fun extractText(n: Notification?): String {
        n ?: return ""
        val e = n.extras ?: return ""
        val parts = listOf(
            e.getCharSequence(Notification.EXTRA_TITLE),
            e.getCharSequence(Notification.EXTRA_TEXT),
            e.getCharSequence(Notification.EXTRA_BIG_TEXT),
            e.getCharSequence(Notification.EXTRA_SUB_TEXT),
            e.getCharSequence(Notification.EXTRA_SUMMARY_TEXT),
        )
        return parts.filterNotNull().joinToString("\n") { it.toString() }
    }

    companion object {
        /** Driver-app package prefixes → platform key. Prefix match handles variants. */
        val PACKAGE_PLATFORM = linkedMapOf(
            "com.ubercab.driver" to "uber",
            "com.ubercab" to "uber",
            "com.doordash.driverapp" to "doordash",
            "com.doordash" to "doordash",
            "com.grubhub.android.driver" to "grubhub",
            "com.grubhub" to "grubhub",
        )
    }
}
