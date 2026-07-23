plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    // Firebase — must be applied after the Android plugin.
    id("com.google.gms.google-services")
}

// Decode the base64 comma-separated dart-defines the Flutter tool forwards to
// Gradle, so a release build can inject the real AdMob app id via
// --dart-define=ADMOB_APP_ID=... The AdMob *App ID* must live in the manifest
// (native, read by MobileAds at init) — it cannot come from a runtime define.
val dartDefines: Map<String, String> =
    (project.findProperty("dart-defines") as? String)
        ?.split(",")
        ?.mapNotNull { token ->
            val decoded = String(java.util.Base64.getDecoder().decode(token))
            val idx = decoded.indexOf('=')
            if (idx < 0) null else decoded.substring(0, idx) to decoded.substring(idx + 1)
        }
        ?.toMap()
        ?: emptyMap()

// Dev default is Google's official SAMPLE AdMob app id (safe, no real revenue).
val admobAppId: String =
    dartDefines["ADMOB_APP_ID"] ?: "ca-app-pub-3940256099942544~3347511713"

android {
    namespace = "com.graduatedcoder.cashraja"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.graduatedcoder.cashraja"
        // PRD: Android 6.0+ (API 23). Firebase Auth also requires minSdk 23.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // AdMob app id → AndroidManifest ${admobAppId} placeholder (G1).
        manifestPlaceholders["admobAppId"] = admobAppId
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
