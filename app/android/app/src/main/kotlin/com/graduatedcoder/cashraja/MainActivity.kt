package com.graduatedcoder.cashraja

import android.content.Intent
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val deviceChannel = "cashraja/device"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
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
