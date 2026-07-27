import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/notification.dart';
import '../../../core/providers.dart';

/// Immutable inbox state: the loaded notifications, the server's unread count,
/// the next keyset cursor (null = no more pages), and whether a page is loading.
class InboxState {
  const InboxState({
    required this.items,
    required this.unreadCount,
    required this.nextCursor,
    this.loadingMore = false,
  });

  final List<AppNotification> items;
  final int unreadCount;
  final String? nextCursor;
  final bool loadingMore;

  bool get hasMore => nextCursor != null;

  InboxState copyWith({
    List<AppNotification>? items,
    int? unreadCount,
    String? nextCursor,
    bool? loadingMore,
    bool clearCursor = false,
  }) {
    return InboxState(
      items: items ?? this.items,
      unreadCount: unreadCount ?? this.unreadCount,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      loadingMore: loadingMore ?? this.loadingMore,
    );
  }
}

/// H8 — the in-app inbox. Loads the first page on build; supports pull-to-refresh,
/// infinite scroll (`loadMore`), and marking a single item read (which also
/// drives the Home unread badge, since both read the same provider).
class NotificationsController extends AsyncNotifier<InboxState> {
  @override
  Future<InboxState> build() async {
    final NotificationPage page =
        await ref.read(apiClientProvider).notifications();
    return InboxState(
      items: page.notifications,
      unreadCount: page.unreadCount,
      nextCursor: page.nextCursor,
    );
  }

  Future<void> refresh() async {
    state = const AsyncValue<InboxState>.loading();
    state = await AsyncValue.guard(build);
  }

  /// Fetch the next keyset page and append it. No-op while already loading, or
  /// when there are no more pages.
  Future<void> loadMore() async {
    final InboxState? current = state.valueOrNull;
    if (current == null || current.loadingMore || !current.hasMore) return;
    state = AsyncValue<InboxState>.data(current.copyWith(loadingMore: true));
    try {
      final NotificationPage page = await ref
          .read(apiClientProvider)
          .notifications(cursor: current.nextCursor);
      state = AsyncValue<InboxState>.data(
        current.copyWith(
          items: <AppNotification>[...current.items, ...page.notifications],
          unreadCount: page.unreadCount,
          nextCursor: page.nextCursor,
          loadingMore: false,
          clearCursor: page.nextCursor == null,
        ),
      );
    } catch (_) {
      state = AsyncValue<InboxState>.data(current.copyWith(loadingMore: false));
    }
  }

  /// Mark one notification read: optimistic local update (flips the flag and
  /// decrements the unread count), then persists. Idempotent server-side.
  Future<void> markRead(String id) async {
    final InboxState? current = state.valueOrNull;
    if (current == null) return;
    final int index = current.items.indexWhere((n) => n.id == id);
    if (index < 0 || current.items[index].read) return;

    final List<AppNotification> next = <AppNotification>[...current.items];
    next[index] = next[index].copyWith(read: true);
    state = AsyncValue<InboxState>.data(
      current.copyWith(
        items: next,
        unreadCount: current.unreadCount > 0 ? current.unreadCount - 1 : 0,
      ),
    );

    try {
      await ref.read(apiClientProvider).markNotificationRead(id);
    } catch (_) {
      // Best-effort: leave the optimistic state; a refresh reconciles.
    }
  }
}

final notificationsControllerProvider =
    AsyncNotifierProvider<NotificationsController, InboxState>(
        NotificationsController.new);

/// Convenience: the unread badge count for the Home entry point. Reads the
/// shared inbox state so marking items read updates the badge reactively.
final unreadCountProvider = Provider<int>((Ref ref) {
  return ref.watch(notificationsControllerProvider).valueOrNull?.unreadCount ??
      0;
});
