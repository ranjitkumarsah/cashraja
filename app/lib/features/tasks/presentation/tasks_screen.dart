import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/offer.dart';
import '../../../core/api/models/survey_wall.dart';
import '../../../core/providers.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/theme/raja_theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_glyph.dart';
import '../../../core/widgets/gradient_background.dart';
import 'offer_launch_screen.dart';
import 'offers_controller.dart';

/// CPX survey-wall URL for the current user. Auto-disposes so it re-fetches a
/// fresh signed URL each time the Tasks tab opens.
final surveyWallProvider = FutureProvider.autoDispose<SurveyWall>((Ref ref) {
  return ref.read(apiClientProvider).surveyWall();
});

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

  Future<void> _openSurveys(BuildContext context, String url) async {
    final Uri? uri = Uri.tryParse(url);
    bool ok = false;
    if (uri != null) {
      ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t open surveys right now.')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Offer>> offers = ref.watch(offersControllerProvider);
    // Survey wall is best-effort: show the entry only when CPX is configured.
    final SurveyWall? wall = ref.watch(surveyWallProvider).valueOrNull;
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
                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: <Widget>[
                    // Entry point into the manual offers + text-proof flow (H5).
                    _ManualOffersEntry(
                      onTap: () => context.push(Routes.manualOffers),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Offerwall',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: RajaColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    // CPX survey wall (#4) sits in the offerwall list — shown only
                    // when CPX is configured on the server.
                    if (wall != null && wall.available && wall.url != null) ...<Widget>[
                      _SurveysEntry(
                        onTap: () => _openSurveys(context, wall.url!),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (list.isEmpty && (wall == null || !wall.available))
                      const Padding(
                        padding: EdgeInsets.only(top: 40),
                        child: EmptyStateView(
                          icon: Icons.inbox_rounded,
                          title: 'No offers right now',
                          subtitle:
                              'Check back soon — new tasks are added regularly.',
                        ),
                      )
                    else
                      for (final Offer o in list) ...<Widget>[
                        _OfferCard(
                          offer: o,
                          onTap: () => _launch(context, ref, o),
                        ),
                        const SizedBox(height: 12),
                      ],
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// Tasks-tab entry point into the H5 manual-offers flow.
class _ManualOffersEntry extends StatelessWidget {
  const _ManualOffersEntry({required this.onTap});

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
              gradient: RajaColors.goldGradient,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.assignment_turned_in_rounded,
                color: Color(0xFF1A1300)),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Manual offers',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: RajaColors.textPrimary,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Complete a task and submit proof to earn coins.',
                  style: TextStyle(color: RajaColors.textMuted, fontSize: 13),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: RajaColors.textMuted),
        ],
      ),
    );
  }
}

/// Tasks-tab entry into the CPX survey wall (opens in the phone browser).
class _SurveysEntry extends StatelessWidget {
  const _SurveysEntry({required this.onTap});

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
            child: const Icon(Icons.poll_rounded, color: RajaColors.gold),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Answer surveys',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: RajaColors.textPrimary,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Share your opinion in short surveys and earn coins.',
                  style: TextStyle(color: RajaColors.textMuted, fontSize: 13),
                ),
              ],
            ),
          ),
          const Icon(Icons.open_in_new_rounded, color: RajaColors.textMuted, size: 20),
        ],
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
