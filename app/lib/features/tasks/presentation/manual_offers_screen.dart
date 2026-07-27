import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:markdown/markdown.dart' as md;
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/manual_offer.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/theme/raja_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_glyph.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/primary_button.dart';
import 'manual_offers_controller.dart';

/// H5 — manual offers: complete an admin-authored task off-platform, then submit
/// free-text proof for review. Two tabs: available offers + your submissions.
class ManualOffersScreen extends ConsumerWidget {
  const ManualOffersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Manual offers'),
          bottom: const TabBar(
            indicatorColor: RajaColors.gold,
            labelColor: RajaColors.gold,
            unselectedLabelColor: RajaColors.textMuted,
            tabs: <Widget>[
              Tab(text: 'Offers'),
              Tab(text: 'My submissions'),
            ],
          ),
        ),
        extendBodyBehindAppBar: true,
        body: GradientBackground(
          child: SafeArea(
            child: TabBarView(
              children: <Widget>[_OffersTab(), _SubmissionsTab()],
            ),
          ),
        ),
      ),
    );
  }
}

class _OffersTab extends ConsumerWidget {
  Future<void> _openProofSheet(
    BuildContext context,
    WidgetRef ref,
    ManualOffer offer,
  ) async {
    final String? proof = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: RajaColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _ProofSheet(offer: offer),
    );
    if (proof == null || proof.isEmpty) return;
    if (!context.mounted) return;
    try {
      await ref
          .read(manualOffersControllerProvider.notifier)
          .submitProof(offer.id, proof);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Proof submitted — pending review.')),
      );
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<ManualOffer>> offers = ref.watch(
      manualOffersControllerProvider,
    );
    return RefreshIndicator(
      color: RajaColors.gold,
      backgroundColor: RajaColors.surface,
      onRefresh: () =>
          ref.read(manualOffersControllerProvider.notifier).refresh(),
      child: AsyncValueView<List<ManualOffer>>(
        value: offers,
        onRetry: () =>
            ref.read(manualOffersControllerProvider.notifier).refresh(),
        data: (List<ManualOffer> list) {
          if (list.isEmpty) {
            return ListView(
              children: const <Widget>[
                SizedBox(height: 120),
                EmptyStateView(
                  icon: Icons.assignment_rounded,
                  title: 'No manual offers right now',
                  subtitle: 'Check back soon — new tasks are added regularly.',
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
              onSubmit: list[i].canSubmit
                  ? () => _openProofSheet(context, ref, list[i])
                  : null,
            ),
          );
        },
      ),
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.offer, required this.onSubmit});

  final ManualOffer offer;

  /// Null ⇒ already submitted (pending/approved): the button is disabled.
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  offer.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: RajaColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              const CoinGlyph(size: 18),
              const SizedBox(width: 4),
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
          if (offer.description.isNotEmpty) ...<Widget>[
            const SizedBox(height: 6),
            Text(
              offer.description,
              style: const TextStyle(
                color: RajaColors.textSecondary,
                height: 1.4,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: RajaColors.surfaceHigh,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: RajaColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Row(
                  children: <Widget>[
                    Icon(
                      Icons.checklist_rounded,
                      size: 16,
                      color: RajaColors.gold,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'How to complete',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: RajaColors.gold,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                // H7: instructions are authored as Markdown in admin — links
                // (open externally), bold, inline code (tap to copy), lists.
                _InstructionsMarkdown(data: offer.instructions),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (onSubmit != null)
            PrimaryButton(
              label: 'Submit proof',
              icon: Icons.upload_file_rounded,
              onPressed: onSubmit,
            )
          else
            _SubmittedBadge(status: offer.mySubmissionStatus ?? 'pending'),
        ],
      ),
    );
  }
}

/// H7 — renders manual-offer instructions as Markdown in the Raja dark theme:
/// gold underlined links that open in the external browser, bold, bullet /
/// numbered lists, and inline `code` chips that copy to the clipboard on tap.
class _InstructionsMarkdown extends StatelessWidget {
  const _InstructionsMarkdown({required this.data});

  final String data;

  Future<void> _openLink(BuildContext context, String? rawHref) async {
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    final String href = (rawHref ?? '').trim();
    bool launched = false;
    if (href.isNotEmpty) {
      // Admins author links as Markdown, often without a scheme
      // (e.g. "www.example.com" or "example.com/x"). A schemeless URI opens a
      // blank browser tab, so normalise it to https:// first. Explicit schemes
      // — https/http and mailto:/tel: — are launched as-is.
      final Uri? uri = Uri.tryParse(_normalizeHref(href));
      if (uri != null) {
        try {
          launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
        } catch (_) {
          launched = false;
        }
      }
    }
    if (!launched) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Couldn\'t open that link.')),
      );
    }
  }

  /// Prepends `https://` to a schemeless href so it loads a real page. Hrefs
  /// that already carry a scheme (https, http, mailto, tel, …) are returned
  /// unchanged so `mailto:`/`tel:` links keep working.
  static String _normalizeHref(String href) {
    final Uri? parsed = Uri.tryParse(href);
    if (parsed != null && parsed.hasScheme) return href;
    return 'https://$href';
  }

  @override
  Widget build(BuildContext context) {
    final MarkdownStyleSheet base = MarkdownStyleSheet.fromTheme(
      Theme.of(context),
    );
    return MarkdownBody(
      data: data,
      fitContent: true,
      onTapLink: (String text, String? href, String title) =>
          _openLink(context, href),
      styleSheet: base.copyWith(
        p: const TextStyle(color: RajaColors.textPrimary, height: 1.4),
        a: const TextStyle(
          color: RajaColors.gold,
          fontWeight: FontWeight.w700,
          decoration: TextDecoration.underline,
          decorationColor: RajaColors.gold,
        ),
        strong: const TextStyle(
          color: RajaColors.textPrimary,
          fontWeight: FontWeight.w800,
        ),
        em: const TextStyle(
          color: RajaColors.textPrimary,
          fontStyle: FontStyle.italic,
        ),
        listBullet: const TextStyle(color: RajaColors.textPrimary, height: 1.4),
        code: const TextStyle(
          color: RajaColors.gold,
          fontFamily: 'monospace',
          backgroundColor: Colors.transparent,
        ),
        codeblockDecoration: BoxDecoration(
          color: RajaColors.surfaceHigh,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: RajaColors.border),
        ),
      ),
      builders: <String, MarkdownElementBuilder>{
        'code': _CopyableCodeBuilder(),
      },
    );
  }
}

/// Renders `code` spans as tap-to-copy chips (H7). Handy for promo codes /
/// usernames a user must paste elsewhere to complete the offer.
class _CopyableCodeBuilder extends MarkdownElementBuilder {
  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    return _CopyableCode(code: element.textContent);
  }
}

class _CopyableCode extends StatelessWidget {
  const _CopyableCode({required this.code});

  final String code;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(6),
      onTap: () async {
        final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
        await Clipboard.setData(ClipboardData(text: code));
        messenger.showSnackBar(
          SnackBar(content: Text('Copied "$code" to clipboard')),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        decoration: BoxDecoration(
          color: RajaColors.surfaceHigh,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: RajaColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Flexible(
              child: Text(
                code,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  color: RajaColors.gold,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.copy_rounded,
              size: 13,
              color: RajaColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }
}

class _SubmittedBadge extends StatelessWidget {
  const _SubmittedBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final bool approved = status == 'approved';
    final Color color = approved ? RajaColors.emerald : RajaColors.amber;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(
            approved ? Icons.check_circle_rounded : Icons.hourglass_top_rounded,
            size: 18,
            color: color,
          ),
          const SizedBox(width: 8),
          Text(
            approved ? 'Completed' : 'Pending review',
            style: TextStyle(color: color, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _ProofSheet extends StatefulWidget {
  const _ProofSheet({required this.offer});

  final ManualOffer offer;

  @override
  State<_ProofSheet> createState() => _ProofSheetState();
}

class _ProofSheetState extends State<_ProofSheet> {
  final TextEditingController _proof = TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _proof.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(_proof.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: RajaColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Submit proof',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  'Describe how you completed "${widget.offer.title}". '
                  'A reviewer will check it before your coins are credited.',
                  style: const TextStyle(color: RajaColors.textSecondary),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _proof,
                  maxLines: 5,
                  maxLength: 2000,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'Your proof',
                    hintText:
                        'e.g. my username, the link I shared, what I did…',
                    alignLabelWithHint: true,
                  ),
                  validator: (String? v) {
                    final String value = (v ?? '').trim();
                    if (value.length < 5) return 'Please add a bit more detail';
                    return null;
                  },
                ),
                const SizedBox(height: 8),
                PrimaryButton(
                  label: 'Submit for review',
                  icon: Icons.send_rounded,
                  onPressed: _submit,
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(color: RajaColors.textMuted),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SubmissionsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<ManualOfferSubmission>> mine = ref.watch(
      myManualOfferSubmissionsProvider,
    );
    return RefreshIndicator(
      color: RajaColors.gold,
      backgroundColor: RajaColors.surface,
      onRefresh: () =>
          ref.read(myManualOfferSubmissionsProvider.notifier).refresh(),
      child: AsyncValueView<List<ManualOfferSubmission>>(
        value: mine,
        onRetry: () =>
            ref.read(myManualOfferSubmissionsProvider.notifier).refresh(),
        data: (List<ManualOfferSubmission> list) {
          if (list.isEmpty) {
            return ListView(
              children: const <Widget>[
                SizedBox(height: 120),
                EmptyStateView(
                  icon: Icons.inbox_rounded,
                  title: 'No submissions yet',
                  subtitle:
                      'Submit proof for a manual offer and track its status here.',
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (_, int i) => _SubmissionCard(item: list[i]),
          );
        },
      ),
    );
  }
}

class _SubmissionCard extends StatelessWidget {
  const _SubmissionCard({required this.item});

  final ManualOfferSubmission item;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  item.offerTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: RajaColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _SubmissionStatusChip(status: item.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            item.proofText,
            style: const TextStyle(
              color: RajaColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: <Widget>[
              const CoinGlyph(size: 14),
              const SizedBox(width: 4),
              Text(
                '+${item.coinReward}',
                style: const TextStyle(
                  color: RajaColors.gold,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                Formatters.dateTime(item.createdAt),
                style: const TextStyle(
                  color: RajaColors.textMuted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          if (item.status == 'rejected' &&
              item.reviewReason != null &&
              item.reviewReason!.isNotEmpty) ...<Widget>[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: RajaColors.rose.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: RajaColors.rose.withValues(alpha: 0.4),
                ),
              ),
              child: Text(
                'Reason: ${item.reviewReason}',
                style: TextStyle(
                  color: RajaColors.rose.withValues(alpha: 0.95),
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SubmissionStatusChip extends StatelessWidget {
  const _SubmissionStatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    late final Color color;
    late final String label;
    switch (status) {
      case 'approved':
        color = RajaColors.emerald;
        label = 'Approved';
      case 'rejected':
        color = RajaColors.rose;
        label = 'Rejected';
      default:
        color = RajaColors.amber;
        label = 'Pending';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
