import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

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

/// Real AdMob rewarded driver (G1) via `google_mobile_ads`.
///
/// [show] loads (if needed) and presents a rewarded ad, resolving with
/// [AdResult.watched] ONLY when the SDK fires `onUserEarnedReward`; a dismissal
/// without earning resolves [AdResult.dismissed]; a load/show failure resolves
/// [AdResult.noFill]/[AdResult.failed]. The `watched` result merely gates
/// whether the app calls the server credit endpoint — coins always come from
/// the server, never from this client.
class RealRewardedAdService implements RewardedAdService {
  RealRewardedAdService({String? adUnitId})
      : _adUnitId = adUnitId ?? AppConfig.admobRewardedId;

  final String _adUnitId;
  RewardedAd? _ad;

  @override
  Future<void> load() {
    if (_ad != null) return Future<void>.value();
    final Completer<void> done = Completer<void>();
    RewardedAd.load(
      adUnitId: _adUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (RewardedAd ad) {
          _ad = ad;
          if (!done.isCompleted) done.complete();
        },
        onAdFailedToLoad: (LoadAdError error) {
          _ad = null;
          if (!done.isCompleted) done.complete();
        },
      ),
    );
    return done.future;
  }

  @override
  Future<AdResult> show() async {
    await load();
    final RewardedAd? ad = _ad;
    if (ad == null) return AdResult.noFill;
    _ad = null; // a rewarded ad is single-use; a fresh one is loaded next time.

    final Completer<AdResult> result = Completer<AdResult>();
    bool earned = false;

    ad.fullScreenContentCallback = FullScreenContentCallback<RewardedAd>(
      onAdDismissedFullScreenContent: (RewardedAd ad) {
        ad.dispose();
        if (!result.isCompleted) {
          result.complete(earned ? AdResult.watched : AdResult.dismissed);
        }
      },
      onAdFailedToShowFullScreenContent: (RewardedAd ad, AdError error) {
        ad.dispose();
        if (!result.isCompleted) result.complete(AdResult.failed);
      },
    );

    unawaited(ad.show(
      onUserEarnedReward: (AdWithoutView ad, RewardItem reward) {
        earned = true;
      },
    ));
    return result.future;
  }
}

final rewardedAdServiceProvider = Provider<RewardedAdService>((Ref ref) {
  if (AppConfig.useMockAds) {
    return MockRewardedAdService();
  }
  return RealRewardedAdService();
});
