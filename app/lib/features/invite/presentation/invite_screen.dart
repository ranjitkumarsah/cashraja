import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/referral.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/theme/raja_theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_glyph.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/primary_button.dart';
import 'invite_controller.dart';

/// D4 "Invite & Earn": the user's referral code (copy + share) and their
/// referral earnings stats. Share uses a clipboard fallback to avoid a heavy
/// share dependency.
class InviteScreen extends ConsumerWidget {
  const InviteScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<InviteData> data = ref.watch(inviteControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Invite & Earn')),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: RefreshIndicator(
            color: RajaColors.gold,
            backgroundColor: RajaColors.surface,
            onRefresh: () => ref.read(inviteControllerProvider.notifier).refresh(),
            child: AsyncValueView<InviteData>(
              value: data,
              onRetry: () =>
                  ref.read(inviteControllerProvider.notifier).refresh(),
              data: (InviteData d) => ListView(
                padding: const EdgeInsets.all(20),
                children: <Widget>[
                  const _Hero(),
                  const SizedBox(height: 20),
                  _CodeCard(code: d.code),
                  const SizedBox(height: 24),
                  const Text(
                    'Your referrals',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: RajaColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _StatsGrid(stats: d.stats),
                  const SizedBox(height: 24),
                  const _HowItWorks(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(24),
      gradient: const LinearGradient(
        colors: <Color>[RajaColors.indigo, RajaColors.surfaceHigh],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const Icon(Icons.group_add_rounded, color: RajaColors.gold, size: 28),
              const SizedBox(width: 12),
              Text(
                'Earn together',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Share your code with friends. When they earn coins, you earn a '
            'bonus on top — automatically.',
            style: TextStyle(color: RajaColors.textSecondary, height: 1.5),
          ),
        ],
      ),
    );
  }
}

class _CodeCard extends StatelessWidget {
  const _CodeCard({required this.code});

  final String code;

  String get _inviteMessage =>
      'Join me on Cash Raja and earn rewards! Use my code $code when you sign up.';

  Future<void> _copy(BuildContext context, String value, String note) async {
    await Clipboard.setData(ClipboardData(text: value));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(note)));
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const Text(
            'YOUR REFERRAL CODE',
            style: TextStyle(
              color: RajaColors.textMuted,
              letterSpacing: 1.5,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => _copy(context, code, 'Code copied to clipboard'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              decoration: BoxDecoration(
                color: RajaColors.surfaceHigh,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: RajaColors.gold.withValues(alpha: 0.4)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text(
                    code,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: RajaColors.gold,
                      letterSpacing: 2,
                    ),
                  ),
                  const Icon(Icons.copy_rounded, color: RajaColors.textSecondary),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Share invite',
            icon: Icons.ios_share_rounded,
            onPressed: () =>
                _copy(context, _inviteMessage, 'Invite message copied — paste it anywhere'),
          ),
        ],
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});

  final ReferralStats stats;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: _StatTile(
            icon: Icons.people_alt_rounded,
            value: '${stats.referredCount}',
            label: 'Referred',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatTile(
            icon: Icons.verified_user_rounded,
            value: '${stats.activeReferrals}',
            label: 'Active',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatTile(
            icon: Icons.savings_rounded,
            value: '${stats.totalEarned}',
            label: 'Earned',
            isCoins: true,
          ),
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.value,
    required this.label,
    this.isCoins = false,
  });

  final IconData icon;
  final String value;
  final String label;
  final bool isCoins;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 8),
      child: Column(
        children: <Widget>[
          Icon(icon, color: RajaColors.gold, size: 22),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              if (isCoins) ...<Widget>[
                const CoinGlyph(size: 14),
                const SizedBox(width: 4),
              ],
              Flexible(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: RajaColors.textPrimary,
                    fontFeatures: RajaTheme.tabularFigures,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(color: RajaColors.textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _HowItWorks extends StatelessWidget {
  const _HowItWorks();

  @override
  Widget build(BuildContext context) {
    return const AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _Step(
            number: '1',
            text: 'Share your code with a friend.',
          ),
          SizedBox(height: 14),
          _Step(
            number: '2',
            text: 'They sign up with your code and start earning.',
          ),
          SizedBox(height: 14),
          _Step(
            number: '3',
            text: 'You earn a bonus on what they make — for free.',
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.number, required this.text});

  final String number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: RajaColors.gold.withValues(alpha: 0.16),
            border: Border.all(color: RajaColors.gold.withValues(alpha: 0.4)),
          ),
          child: Text(
            number,
            style: const TextStyle(
              color: RajaColors.gold,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              text,
              style: const TextStyle(color: RajaColors.textSecondary, height: 1.4),
            ),
          ),
        ),
      ],
    );
  }
}
