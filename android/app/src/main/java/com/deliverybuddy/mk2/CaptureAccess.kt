package com.deliverybuddy.mk2

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings

/** Helpers for the notification-listener permission used by OfferCaptureService. */
object CaptureAccess {

    /** True when the user has granted notification access to our service. */
    fun isEnabled(ctx: Context): Boolean {
        val flat = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: return false
        val me = ComponentName(ctx, OfferCaptureService::class.java)
        val meFlat = me.flattenToString()
        val meShort = me.flattenToShortString()
        return flat.split(":").any { it == meFlat || it == meShort }
    }

    /** Opens the system "Notification access" settings screen. */
    fun openSettings(ctx: Context) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { ctx.startActivity(intent) }
            .onFailure {
                ctx.startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
    }
}
