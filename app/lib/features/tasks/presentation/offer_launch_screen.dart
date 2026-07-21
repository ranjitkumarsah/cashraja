import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/api/models/offer.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/primary_button.dart';

/// Offer webview handoff.
///
/// STUB: the real integration loads [OfferLaunch.launchUrl] in an in-app
/// webview (or hands off to the offerwall SDK). We don't bundle a webview
/// package yet, so this screen presents the signed URL and explains the flow.
/// Wiring `webview_flutter` here is a small follow-up — see handoff notes.
class OfferLaunchScreen extends StatelessWidget {
  const OfferLaunchScreen({
    super.key,
    required this.offer,
    required this.launch,
  });

  final Offer offer;
  final OfferLaunch launch;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(offer.title)),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                const Spacer(),
                const Icon(Icons.open_in_new_rounded,
                    size: 56, color: RajaColors.gold),
                const SizedBox(height: 20),
                Text(
                  'Opening “${offer.title}”',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Complete the offer to earn your coins. Credits arrive after '
                  'the network confirms completion (usually a few minutes).',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: RajaColors.textSecondary, height: 1.5),
                ),
                const SizedBox(height: 24),
                AppCard(
                  child: Row(
                    children: <Widget>[
                      const Icon(Icons.link_rounded,
                          color: RajaColors.textMuted, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          launch.launchUrl,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: RajaColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy_rounded, size: 18),
                        color: RajaColors.textMuted,
                        onPressed: () async {
                          await Clipboard.setData(
                            ClipboardData(text: launch.launchUrl),
                          );
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Link copied')),
                            );
                          }
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Webview handoff is stubbed in this build.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: RajaColors.textMuted, fontSize: 12),
                ),
                const Spacer(),
                PrimaryButton(
                  label: 'Done',
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
