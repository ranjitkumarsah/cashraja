import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/gift_card.dart';
import '../../../core/api/models/redemption.dart';
import '../../../core/providers.dart';
import '../../wallet/presentation/wallet_controllers.dart';

/// Gift-card catalog.
class GiftCardsController extends AsyncNotifier<List<GiftCard>> {
  @override
  Future<List<GiftCard>> build() => ref.read(apiClientProvider).giftCards();

  Future<void> refresh() async {
    state = const AsyncValue<List<GiftCard>>.loading();
    state =
        await AsyncValue.guard(() => ref.read(apiClientProvider).giftCards());
  }
}

final giftCardsControllerProvider =
    AsyncNotifierProvider<GiftCardsController, List<GiftCard>>(
  GiftCardsController.new,
);

/// The signed-in user's redemption history.
class RedemptionsController extends AsyncNotifier<List<Redemption>> {
  @override
  Future<List<Redemption>> build() =>
      ref.read(apiClientProvider).myRedemptions();

  Future<void> refresh() async {
    state = const AsyncValue<List<Redemption>>.loading();
    state = await AsyncValue.guard(
      () => ref.read(apiClientProvider).myRedemptions(),
    );
  }

  /// Requests a redemption; on success refreshes history + wallet balance.
  Future<Redemption> redeem(String giftCardId) async {
    final Redemption r =
        await ref.read(apiClientProvider).createRedemption(giftCardId);
    await refresh();
    // The reserve-debit changed the balance — refresh the wallet too.
    await ref.read(walletControllerProvider.notifier).refresh();
    return r;
  }
}

final redemptionsControllerProvider =
    AsyncNotifierProvider<RedemptionsController, List<Redemption>>(
  RedemptionsController.new,
);
