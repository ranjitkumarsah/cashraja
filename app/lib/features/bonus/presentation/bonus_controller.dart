import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/bonus.dart';
import '../../../core/providers.dart';
import '../../wallet/presentation/wallet_controllers.dart';

/// Loads scratch/spin bonus state (`GET /bonus/:type`) and plays a round
/// (`POST /bonus/:type/play`). Keyed by [BonusKind] so scratch and spin have
/// independent state. The prize is rolled server-side — [play] returns the
/// authoritative result the UI must reveal.
class BonusController extends FamilyAsyncNotifier<BonusState, BonusKind> {
  @override
  Future<BonusState> build(BonusKind arg) =>
      ref.read(apiClientProvider).bonusState(arg);

  Future<void> refresh() async {
    state = const AsyncValue<BonusState>.loading();
    state =
        await AsyncValue.guard(() => ref.read(apiClientProvider).bonusState(arg));
  }

  /// Plays a bonus round; on success reflects the new attempt count locally and
  /// refreshes the wallet balance. Returns the server-rolled prize.
  Future<BonusPlayResult> play() async {
    final BonusPlayResult result =
        await ref.read(apiClientProvider).playBonus(arg);
    final BonusState? current = state.valueOrNull;
    if (current != null) {
      state = AsyncData<BonusState>(
        current.copyWith(attemptsRemaining: result.attemptsRemaining),
      );
    }
    if (result.isWin) {
      await ref.read(walletControllerProvider.notifier).refresh();
    }
    return result;
  }
}

final bonusControllerProvider =
    AsyncNotifierProvider.family<BonusController, BonusState, BonusKind>(
  BonusController.new,
);
