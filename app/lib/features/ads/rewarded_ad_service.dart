import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';

/// Outcome of a rewarded-ad attempt.
enum AdResult {
  /// The user watched to completion. Coins (if any) are credited server-side
  /// via the ad network's SSV callback — never trusted from the client.
  watched,

  /// The user dismissed the ad before the reward threshold.
  dismissed,

  /// No ad was available to show.
  noFill,

  /// The SDK/network errored.
  failed,
}

/// Abstraction over rewarded video ads so the UI never depends on a concrete
/// ad SDK. Swap the mock for a real driver (AppLovin MAX / google_mobile_ads)
/// when credentials exist — the UI contract stays identical.
abstract class RewardedAdService {
  /// Preload an ad if the driver supports it. No-op for the mock.
  Future<void> load();

  /// Show a rewarded ad and resolve with the [AdResult].
  Future<AdResult> show();
}

/// Fully functional mock: simulates a short ad view and reports success. In a
/// wired backend, the ad network's server would then hit
/// `POST /api/webhooks/ads/:network` (SSV) and the coins appear in the wallet.
class MockRewardedAdService implements RewardedAdService {
  MockRewardedAdService({this.viewDuration = const Duration(seconds: 2)});

  final Duration viewDuration;

  @override
  Future<void> load() async {}

  @override
  Future<AdResult> show() async {
    await Future<void>.delayed(viewDuration);
    return AdResult.watched;
  }
}

/// Real driver placeholder.
///
/// TODO(ads): wire a real rewarded-ad SDK here.
/// NEEDS_CREDENTIALS — AppLovin MAX SDK key / ad unit id (or google_mobile_ads
/// app id + rewarded unit). Add the plugin (`applovin_max` or
/// `google_mobile_ads`), initialize in main(), and implement load()/show()
/// mapping the SDK reward/dismiss/error callbacks onto [AdResult]. Crediting
/// stays server-side via SSV — this client only reports that the ad completed.
class RealRewardedAdService implements RewardedAdService {
  @override
  Future<void> load() async {
    throw UnimplementedError('Real ad SDK not wired (NEEDS_CREDENTIALS).');
  }

  @override
  Future<AdResult> show() async {
    throw UnimplementedError('Real ad SDK not wired (NEEDS_CREDENTIALS).');
  }
}

final rewardedAdServiceProvider = Provider<RewardedAdService>((Ref ref) {
  if (AppConfig.useMockAds || kDebugMode) {
    return MockRewardedAdService();
  }
  return RealRewardedAdService();
});
