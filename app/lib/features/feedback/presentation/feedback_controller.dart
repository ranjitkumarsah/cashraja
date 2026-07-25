import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/feedback.dart';
import '../../../core/providers.dart';

/// Loads the user's own submissions (`GET /feedback/mine`) and submits new
/// feedback/complaints (`POST /feedback`).
class FeedbackController extends AsyncNotifier<List<FeedbackEntry>> {
  @override
  Future<List<FeedbackEntry>> build() =>
      ref.read(apiClientProvider).myFeedback();

  Future<void> refresh() async {
    state = const AsyncValue<List<FeedbackEntry>>.loading();
    state = await AsyncValue.guard(
      () => ref.read(apiClientProvider).myFeedback(),
    );
  }

  /// Submits a new entry, then refreshes the list so it appears immediately.
  Future<FeedbackEntry> submit({
    required FeedbackType type,
    required String subject,
    required String message,
  }) async {
    final FeedbackEntry created =
        await ref.read(apiClientProvider).submitFeedback(
          type: type,
          subject: subject,
          message: message,
        );
    await refresh();
    return created;
  }
}

final feedbackControllerProvider =
    AsyncNotifierProvider<FeedbackController, List<FeedbackEntry>>(
        FeedbackController.new);
