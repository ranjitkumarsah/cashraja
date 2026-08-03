package com.graduatedcoder.cashraja

import android.content.Intent
import android.provider.Settings
import java.util.concurrent.atomic.AtomicBoolean
import com.playtimeads.PlaytimeAds
import com.playtimeads.listeners.OfferWallInitListener
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val deviceChannel = "cashraja/device"
    private val playtimeChannel = "cashraja/playtime"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // PlaytimeAds offerwall SDK bridge — init once with (appKey, userId),
        // then open() shows the native offerwall. Rewards credit server-side.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, playtimeChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "init" -> {
                        val appKey = call.argument<String>("appKey") ?: ""
                        val userId = call.argument<String>("userId") ?: ""
                        if (appKey.isEmpty()) {
                            result.success(false)
                        } else if (PlaytimeAds.getInstance().isInitialized()) {
                            result.success(true)
                        } else {
                            // Guard against the listener firing more than once
                            // (init + already-initializing) — reply exactly once.
                            val replied = AtomicBoolean(false)
                            fun reply(ok: Boolean) {
                                if (replied.compareAndSet(false, true)) result.success(ok)
                            }
                            try {
                                PlaytimeAds.getInstance().init(
                                    this,
                                    appKey,
                                    userId,
                                    object : OfferWallInitListener {
                                        override fun onInitSuccess() = reply(true)
                                        override fun onAlreadyInitializing() = reply(true)
                                        override fun onInitFailed(error: String?) = reply(false)
                                    },
                                )
                            } catch (e: Exception) {
                                reply(false)
                            }
                        }
                    }
                    "open" -> {
                        try {
                            if (PlaytimeAds.getInstance().isInitialized()) {
                                PlaytimeAds.getInstance().open(this)
                                result.success(true)
                            } else {
                                result.success(false)
                            }
                        } catch (e: Exception) {
                            result.success(false)
                        }
                    }
                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, deviceChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    // Returns the Android Private DNS mode string
                    // ("off" | "opportunistic" | "hostname") or null when
                    // unavailable. The Dart side treats anything other than
                    // "off"/null as ON.
                    "getPrivateDnsMode" -> {
                        result.success(readPrivateDnsMode())
                    }
                    // Opens the Android Private DNS settings screen so the user
                    // can turn it off. Falls back to Wireless/general Settings
                    // when the dedicated screen is unavailable on the device.
                    "openPrivateDnsSettings" -> {
                        result.success(openPrivateDnsSettings())
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun readPrivateDnsMode(): String? {
        return try {
            Settings.Global.getString(contentResolver, "private_dns_mode")
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Launches the most specific settings screen available for Private DNS.
     * Tries the dedicated action first, then wireless settings, then the top
     * settings screen. Returns true if any intent was launched.
     */
    private fun openPrivateDnsSettings(): Boolean {
        val actions = listOf(
            // Not a public constant across all API levels — resolved by name.
            "android.settings.PRIVATE_DNS_SETTINGS",
            Settings.ACTION_WIRELESS_SETTINGS,
            Settings.ACTION_SETTINGS,
        )
        for (action in actions) {
            try {
                val intent = Intent(action).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                if (intent.resolveActivity(packageManager) != null) {
                    startActivity(intent)
                    return true
                }
            } catch (e: Exception) {
                // Try the next fallback action.
            }
        }
        return false
    }
}
