import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/notification.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/gradient_background.dart';
import 'notifications_controller.dart';

/// H8 — the in-app inbox. Lists notifications (pull-to-refresh + infinite
/// scroll), shows read/unread state, and marks an item read on tap.
class InboxScreen extends ConsumerStatefulWidget {
  const InboxScreen({super.key});

  @override
  ConsumerState<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends ConsumerState<InboxScreen> {
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    // The inbox provider is kept alive app-wide (it also feeds the Home unread
    // badge), so opening this screen would otherwise show a stale/cached list.
    // Reload after the first frame so newly-arrived notifications appear.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(notificationsControllerProvider.notifier).refresh();
    });
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels >=
        _scroll.position.maxScrollExtent - 300) {
      ref.read(notificationsControllerProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<InboxState> inbox =
        ref.watch(notificationsControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: RefreshIndicator(
            color: RajaColors.gold,
            backgroundColor: RajaColors.surface,
            onRefresh: () =>
                ref.read(notificationsControllerProvider.notifier).refresh(),
            child: AsyncValueView<InboxState>(
              value: inbox,
              onRetry: () =>
                  ref.read(notificationsControllerProvider.notifier).refresh(),
              data: (InboxState state) {
                if (state.items.isEmpty) {
                  return ListView(
                    controller: _scroll,
                    // Always scrollable so pull-to-refresh works while empty.
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(20),
                    children: const <Widget>[_EmptyInbox()],
                  );
                }
                return ListView.separated(
                  controller: _scroll,
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: state.items.length + (state.hasMore ? 1 : 0),
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (BuildContext context, int i) {
                    if (i >= state.items.length) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: Center(
                          child: SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.4,
                              color: RajaColors.gold,
                            ),
                          ),
                        ),
                      );
                    }
                    final AppNotification n = state.items[i];
                    return _NotificationCard(
                      item: n,
                      onTap: () => ref
                          .read(notificationsControllerProvider.notifier)
                          .markRead(n.id),
                    );
                  },
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.item, required this.onTap});

  final AppNotification item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: item.read ? null : onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: item.read
                  ? RajaColors.surfaceHigh
                  : RajaColors.gold.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.notifications_rounded,
              size: 20,
              color: item.read ? RajaColors.textMuted : RajaColors.gold,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  item.title,
                  style: TextStyle(
                    fontWeight: item.read ? FontWeight.w600 : FontWeight.w800,
                    color: RajaColors.textPrimary,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.body,
                  style: const TextStyle(
                    color: RajaColors.textSecondary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  Formatters.dateTime(item.createdAt),
                  style:
                      const TextStyle(color: RajaColors.textMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          if (!item.read) ...<Widget>[
            const SizedBox(width: 10),
            Container(
              width: 10,
              height: 10,
              margin: const EdgeInsets.only(top: 4),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: RajaColors.gold,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EmptyInbox extends StatelessWidget {
  const _EmptyInbox();

  @override
  Widget build(BuildContext context) {
    return const AppCard(
      child: Row(
        children: <Widget>[
          Icon(Icons.inbox_rounded, color: RajaColors.textMuted),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              "You're all caught up. Rewards and updates will show up here.",
              style: TextStyle(color: RajaColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
