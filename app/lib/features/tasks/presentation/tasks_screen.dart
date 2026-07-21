import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/offer.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/theme/raja_theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_glyph.dart';
import '../../../core/widgets/gradient_background.dart';
import 'offer_launch_screen.dart';
import 'offers_controller.dart';

/// The offerwall — a list of active offers. Tapping one requests a launch token
/// and hands off to the (stubbed) webview flow.
class TasksScreen extends ConsumerWidget {
  const TasksScreen({super.key});

  Future<void> _launch(
    BuildContext context,
    WidgetRef ref,
    Offer offer,
  ) async {
    unawaited(showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: CircularProgressIndicator(color: RajaColors.gold),
      ),
    ));
    try {
      final OfferLaunch launch =
          await ref.read(offersControllerProvider.notifier).launch(offer.id);
      if (!context.mounted) return;
      Navigator.of(context).pop(); // dismiss loader
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => OfferLaunchScreen(offer: offer, launch: launch),
        ),
      );
    } on ApiException catch (e) {
      if (!context.mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Offer>> offers = ref.watch(offersControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Tasks')),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: RefreshIndicator(
            color: RajaColors.gold,
            backgroundColor: RajaColors.surface,
            onRefresh: () =>
                ref.read(offersControllerProvider.notifier).refresh(),
            child: AsyncValueView<List<Offer>>(
              value: offers,
              onRetry: () =>
                  ref.read(offersControllerProvider.notifier).refresh(),
              data: (List<Offer> list) {
                if (list.isEmpty) {
                  return ListView(
                    children: const <Widget>[
                      SizedBox(height: 120),
                      EmptyStateView(
                        icon: Icons.inbox_rounded,
                        title: 'No offers right now',
                        subtitle:
                            'Check back soon — new tasks are added regularly.',
                      ),
                    ],
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (_, int i) => _OfferCard(
                    offer: list[i],
                    onTap: () => _launch(context, ref, list[i]),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.offer, required this.onTap});

  final Offer offer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Row(
        children: <Widget>[
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: RajaColors.surfaceHigh,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.task_alt_rounded, color: RajaColors.gold),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  offer.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                if (offer.description != null) ...<Widget>[
                  const SizedBox(height: 4),
                  Text(
                    offer.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: RajaColors.textMuted,
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            children: <Widget>[
              const CoinGlyph(size: 18),
              const SizedBox(height: 4),
              Text(
                '+${offer.coinReward}',
                style: const TextStyle(
                  color: RajaColors.gold,
                  fontWeight: FontWeight.w800,
                  fontFeatures: RajaTheme.tabularFigures,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
