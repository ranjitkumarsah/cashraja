import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/streak.dart';
import '../../../core/providers.dart';
import '../../wallet/presentation/wallet_controllers.dart';

/// Loads the daily login-streak state (`GET /streak`) and claims the daily
/// bonus (`POST /streak/claim`). This is the D2 surface — Home reads the streak
/// count from here (not the nullable `/me` placeholder).
class StreakController extends AsyncNotifier<StreakState> {
  @override
  Future<StreakState> build() => ref.read(apiClientProvider).streak();

  Future<void> refresh() async {
    state = const AsyncValue<StreakState>.loading();
    state = await AsyncValue.guard(() => ref.read(apiClientProvider).streak());
  }

  /// Claims today's streak bonus, then refreshes streak state + wallet balance.
  Future<StreakClaimResult> claim() async {
    final StreakClaimResult result =
        await ref.read(apiClientProvider).claimStreak();
    await refresh();
    await ref.read(walletControllerProvider.notifier).refresh();
    return result;
  }
}

final streakControllerProvider =
    AsyncNotifierProvider<StreakController, StreakState>(StreakController.new);
