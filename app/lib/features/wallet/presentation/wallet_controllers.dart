import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/models/wallet.dart';
import '../../../core/providers.dart';

/// Loads the wallet summary (balance + pending + recent entries).
class WalletController extends AsyncNotifier<WalletSummary> {
  @override
  Future<WalletSummary> build() => ref.read(apiClientProvider).wallet();

  Future<void> refresh() async {
    state = const AsyncValue<WalletSummary>.loading();
    state = await AsyncValue.guard(
      () => ref.read(apiClientProvider).wallet(),
    );
  }
}

final walletControllerProvider =
    AsyncNotifierProvider<WalletController, WalletSummary>(
  WalletController.new,
);

/// Accumulated ledger state for the paginated history list.
class LedgerListState {
  const LedgerListState({
    required this.entries,
    required this.nextCursor,
    this.loadingMore = false,
  });

  final List<LedgerEntry> entries;
  final String? nextCursor;
  final bool loadingMore;

  bool get hasMore => nextCursor != null;

  LedgerListState copyWith({
    List<LedgerEntry>? entries,
    String? nextCursor,
    bool? loadingMore,
    bool clearCursor = false,
  }) {
    return LedgerListState(
      entries: entries ?? this.entries,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      loadingMore: loadingMore ?? this.loadingMore,
    );
  }
}

/// Keyset-paginated ledger history.
class LedgerController extends AsyncNotifier<LedgerListState> {
  static const int _pageSize = 20;

  @override
  Future<LedgerListState> build() async {
    final LedgerPage page =
        await ref.read(apiClientProvider).ledger(limit: _pageSize);
    return LedgerListState(
      entries: page.entries,
      nextCursor: page.nextCursor,
    );
  }

  Future<void> loadMore() async {
    final LedgerListState? current = state.valueOrNull;
    if (current == null || !current.hasMore || current.loadingMore) return;

    state = AsyncData<LedgerListState>(current.copyWith(loadingMore: true));
    try {
      final ApiClient api = ref.read(apiClientProvider);
      final LedgerPage page =
          await api.ledger(cursor: current.nextCursor, limit: _pageSize);
      state = AsyncData<LedgerListState>(
        LedgerListState(
          entries: <LedgerEntry>[...current.entries, ...page.entries],
          nextCursor: page.nextCursor,
        ),
      );
    } catch (_) {
      // Keep existing entries; just stop the spinner.
      state = AsyncData<LedgerListState>(current.copyWith(loadingMore: false));
    }
  }

  Future<void> refresh() async {
    state = const AsyncValue<LedgerListState>.loading();
    state = await AsyncValue.guard(build);
  }
}

final ledgerControllerProvider =
    AsyncNotifierProvider<LedgerController, LedgerListState>(
  LedgerController.new,
);
