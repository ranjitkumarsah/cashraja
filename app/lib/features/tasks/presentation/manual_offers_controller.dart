import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/manual_offer.dart';
import '../../../core/providers.dart';

/// Active manual offers (`GET /api/manual-offers`), annotated with the caller's
/// submission status per offer.
class ManualOffersController extends AsyncNotifier<List<ManualOffer>> {
  @override
  Future<List<ManualOffer>> build() =>
      ref.read(apiClientProvider).manualOffers();

  Future<void> refresh() async {
    state = const AsyncValue<List<ManualOffer>>.loading();
    state = await AsyncValue.guard(
      () => ref.read(apiClientProvider).manualOffers(),
    );
  }

  /// Submits text proof for [offerId], then refreshes both the offers list (so
  /// the offer flips to "pending") and the caller's submissions.
  Future<ManualOfferSubmission> submitProof(
    String offerId,
    String proofText,
  ) async {
    final ManualOfferSubmission created = await ref
        .read(apiClientProvider)
        .submitManualOfferProof(offerId, proofText);
    await refresh();
    ref.invalidate(myManualOfferSubmissionsProvider);
    return created;
  }
}

final manualOffersControllerProvider =
    AsyncNotifierProvider<ManualOffersController, List<ManualOffer>>(
  ManualOffersController.new,
);

/// The caller's own manual-offer submissions (`GET /api/manual-offers/mine`).
class MyManualOfferSubmissionsController
    extends AsyncNotifier<List<ManualOfferSubmission>> {
  @override
  Future<List<ManualOfferSubmission>> build() =>
      ref.read(apiClientProvider).myManualOfferSubmissions();

  Future<void> refresh() async {
    state = const AsyncValue<List<ManualOfferSubmission>>.loading();
    state = await AsyncValue.guard(
      () => ref.read(apiClientProvider).myManualOfferSubmissions(),
    );
  }
}

final myManualOfferSubmissionsProvider = AsyncNotifierProvider<
    MyManualOfferSubmissionsController,
    List<ManualOfferSubmission>>(MyManualOfferSubmissionsController.new);
