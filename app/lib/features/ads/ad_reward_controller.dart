import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/models/ad_reward.dart';
import '../../core/providers.dart';

/// Watch-ads reward state (G7): remaining daily count + cooldown. The credit
/// itself happens through [ApiClient.claimAdReward] after a completed ad watch;
/// the server enforces both the daily cap and the cooldown.
class AdRewardController extends AsyncNotifier<AdRewardState> {
  @override
  Future<AdRewardState> build() => ref.read(apiClientProvider).adRewardState();

  Future<void> refresh() async {
    state = const AsyncValue<AdRewardState>.loading();
    state = await AsyncValue.guard(
      () => ref.read(apiClientProvider).adRewardState(),
    );
  }

  /// Calls the server credit endpoint (only after the app has confirmed a
  /// completed rewarded-ad watch). Refreshes state afterwards.
  Future<AdRewardResult> claim() async {
    final AdRewardResult result =
        await ref.read(apiClientProvider).claimAdReward();
    await refresh();
    return result;
  }
}

final adRewardControllerProvider =
    AsyncNotifierProvider<AdRewardController, AdRewardState>(
  AdRewardController.new,
);
