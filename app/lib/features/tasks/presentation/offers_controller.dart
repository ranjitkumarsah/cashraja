import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/offer.dart';
import '../../../core/providers.dart';

/// Loads the active, per-user-eligible offer catalog.
class OffersController extends AsyncNotifier<List<Offer>> {
  @override
  Future<List<Offer>> build() => ref.read(apiClientProvider).offers();

  Future<void> refresh() async {
    state = const AsyncValue<List<Offer>>.loading();
    state = await AsyncValue.guard(() => ref.read(apiClientProvider).offers());
  }

  /// Requests a signed launch URL for [offerId].
  Future<OfferLaunch> launch(String offerId) {
    return ref.read(apiClientProvider).launchOffer(offerId);
  }
}

final offersControllerProvider =
    AsyncNotifierProvider<OffersController, List<Offer>>(OffersController.new);
