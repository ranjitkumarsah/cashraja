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

  /// Step 1 (roll): ask the server to roll + reserve the prize (no credit yet)
  /// for this kind. Reflects the consumed attempt locally so the UI updates
  /// immediately. Shared by scratch and spin.
  Future<BonusRollResult> roll() async {
    final BonusRollResult result =
        await ref.read(apiClientProvider).rollBonus(arg);
    final BonusState? current = state.valueOrNull;
    if (current != null) {
      state = AsyncData<BonusState>(
        current.copyWith(attemptsRemaining: result.attemptsRemaining),
      );
    }
    return result;
  }

  /// Step 2 (claim): credit the reserved prize after the ad; refresh the wallet.
  Future<BonusPlayResult> claim(String reservationId) async {
    final BonusPlayResult result =
        await ref.read(apiClientProvider).claimBonus(arg, reservationId);
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
