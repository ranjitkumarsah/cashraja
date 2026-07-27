# Cash Raja — Android Release Build

The debug build ships dev defaults: mock ads, `localhost` API, Google **sample**
AdMob ids, and **debug signing**. A Play Store release must override all of them.

## 1. Release signing (REQUIRED — you cannot publish a debug-signed app)

`android/app/build.gradle.kts` currently signs `release` with the debug key
(so `flutter run --release` works during dev). Before publishing:

```bash
# Generate an upload keystore (keep the .jks + passwords in D:\Secrets, never in git)
keytool -genkey -v -keystore D:\Secrets\cashraja-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias cashraja
```
Create `android/key.properties` (git-ignored):
```
storeFile=D:/Secrets/cashraja-upload.jks
storePassword=…
keyAlias=cashraja
keyPassword=…
```
Then wire a real `signingConfigs.release` in `build.gradle.kts` that reads
`key.properties`, and point `buildTypes.release.signingConfig` at it (replacing
the `getByName("debug")` line at build.gradle.kts:62). Recommended: enable
`isMinifyEnabled = true` + `isShrinkResources = true` for the release type.

> Prefer **Play App Signing**: upload with this key; Google re-signs for
> distribution. Register the upload key's SHA-1 **and** SHA-256 in Firebase
> (Google Sign-In) — plus the Play App Signing SHA-256 once Play shows it.

## 2. Build with production dart-defines

```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.cashraja.graduatedcoder.in/api \
  --dart-define=USE_MOCK_ADS=false \
  --dart-define=ADMOB_APP_ID=ca-app-pub-XXXXXXXX~XXXXXXXX \
  --dart-define=ADMOB_REWARDED_ID=ca-app-pub-XXXXXXXX/XXXXXXXX \
  --dart-define=ADMOB_BANNER_ID=ca-app-pub-XXXXXXXX/XXXXXXXX
```

| dart-define | Dev default | Release value |
| --- | --- | --- |
| `API_BASE_URL` | `http://localhost:3000/api` | `https://api.cashraja.graduatedcoder.in/api` |
| `USE_MOCK_ADS` | `true` | **`false`** |
| `ADMOB_APP_ID` | Google sample (`~3347511713`) | your real AdMob **app** id |
| `ADMOB_REWARDED_ID` | Google sample | your real rewarded unit id |
| `ADMOB_BANNER_ID` | Google sample | your real banner unit id |
| `ENABLE_DEV_LOGIN` | `true` (debug-only) | irrelevant — dev login is `kDebugMode`-gated, never in release |

- Output: `build/app/outputs/bundle/release/app-release.aab` → upload to Play.
- `google-services.json` (Firebase) must be present at `android/app/` — it is
  **not** committed (git-ignored); keep it in `D:\Secrets` and drop it in for builds.
- Version: bump `pubspec.yaml` `version: 1.0.0+1` (name+build) for each upload.

## 3. Pre-upload smoke check
Install the release build on a Play-Services device and verify against **prod**:
Google Sign-In succeeds · a rewarded ad actually plays (not the mock) · balance/
store/redeem load over HTTPS · an FCM push arrives. See `docs/PLAY_STORE_CHECKLIST.md`.
