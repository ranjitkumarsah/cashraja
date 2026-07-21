import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/user.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../auth/presentation/auth_controller.dart';
import 'profile_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<MeProfile> profile = ref.watch(profileControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: AsyncValueView<MeProfile>(
            value: profile,
            onRetry: () =>
                ref.read(profileControllerProvider.notifier).refresh(),
            data: (MeProfile me) => ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                _Header(me: me),
                const SizedBox(height: 20),
                _ReferralCard(code: me.referralCode),
                const SizedBox(height: 20),
                const _SectionLabel('Account'),
                AppCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: <Widget>[
                      _Row(
                        icon: Icons.email_outlined,
                        label: 'Email',
                        value: me.email,
                      ),
                      const Divider(height: 1),
                      _Row(
                        icon: Icons.verified_user_outlined,
                        label: 'Status',
                        value: me.status,
                      ),
                      if (me.country != null) ...<Widget>[
                        const Divider(height: 1),
                        _Row(
                          icon: Icons.public_rounded,
                          label: 'Country',
                          value: me.country!,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const _SectionLabel('Settings'),
                AppCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: <Widget>[
                      _Action(
                        icon: Icons.logout_rounded,
                        label: 'Sign out',
                        onTap: () =>
                            ref.read(authControllerProvider.notifier).signOut(),
                      ),
                      const Divider(height: 1),
                      _Action(
                        icon: Icons.delete_forever_rounded,
                        label: 'Delete account',
                        danger: true,
                        onTap: () => _confirmDelete(context, ref),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                const Center(
                  child: Text(
                    'Cash Raja • v1.0.0',
                    style: TextStyle(color: RajaColors.textMuted, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final bool? yes = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'This permanently anonymizes your account and ends all sessions. '
          'Your coin balance will be lost. This cannot be undone.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete',
                style: TextStyle(color: RajaColors.rose)),
          ),
        ],
      ),
    );
    if (yes != true || !context.mounted) return;
    try {
      await ref.read(profileControllerProvider.notifier).deleteAccount();
      // Router redirect returns us to onboarding after sign-out.
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.me});

  final MeProfile me;

  @override
  Widget build(BuildContext context) {
    final String initial =
        me.displayName.isNotEmpty ? me.displayName[0].toUpperCase() : '?';
    return Row(
      children: <Widget>[
        CircleAvatar(
          radius: 30,
          backgroundColor: RajaColors.indigoSoft,
          child: Text(
            initial,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: RajaColors.gold,
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                me.displayName.isEmpty ? 'Cash Raja player' : me.displayName,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 2),
              Text(
                me.email,
                style: const TextStyle(color: RajaColors.textMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ReferralCard extends StatelessWidget {
  const _ReferralCard({required this.code});

  final String code;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      gradient: const LinearGradient(
        colors: <Color>[RajaColors.indigo, RajaColors.surfaceHigh],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Text(
                  'Your referral code',
                  style: TextStyle(color: RajaColors.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 6),
                Text(
                  code.isEmpty ? '—' : code,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                    color: RajaColors.gold,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.copy_rounded),
            color: RajaColors.gold,
            onPressed: code.isEmpty
                ? null
                : () async {
                    await Clipboard.setData(ClipboardData(text: code));
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Referral code copied')),
                      );
                    }
                  },
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          color: RajaColors.textMuted,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 1,
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: <Widget>[
          Icon(icon, size: 20, color: RajaColors.textMuted),
          const SizedBox(width: 14),
          Text(label, style: const TextStyle(color: RajaColors.textSecondary)),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final Color color = danger ? RajaColors.rose : RajaColors.textPrimary;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 14),
            Text(
              label,
              style: TextStyle(color: color, fontWeight: FontWeight.w600),
            ),
            const Spacer(),
            const Icon(Icons.chevron_right_rounded,
                color: RajaColors.textMuted),
          ],
        ),
      ),
    );
  }
}
