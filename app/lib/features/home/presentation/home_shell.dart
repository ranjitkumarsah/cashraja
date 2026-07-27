import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/device/private_dns_service.dart';
import '../../../core/providers.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/primary_button.dart';
import '../../notifications/data/push_messaging.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../rewards/presentation/rewards_screen.dart';
import '../../tasks/presentation/tasks_screen.dart';
import '../../wallet/presentation/wallet_screen.dart';
import 'home_tab.dart';

/// Authenticated home shell with a bottom navigation bar over five tabs.
/// Tabs are kept alive via [IndexedStack] so state (scroll, forms) persists.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

/// Window within which a second back press exits the app (Android).
const Duration _kExitPromptWindow = Duration(seconds: 2);

class _HomeShellState extends ConsumerState<HomeShell> {
  int _index = 0;
  bool _dnsChecked = false;

  /// Timestamp of the last back press while on the Home tab — powers the
  /// "press back again to exit" pattern.
  DateTime? _lastBackPress;

  void _go(int i) => setState(() => _index = i);

  /// Android back handling for the top-level Home shell:
  ///  • On a non-Home tab, back returns to the Home tab (never exits).
  ///  • On the Home tab, the first back shows a "press back again to exit"
  ///    snackbar and stays; a second back within [_kExitPromptWindow] exits.
  /// Inner screens/tabs push their own routes and pop normally — this only
  /// governs the shell's root.
  Future<void> _handleBackPressed() async {
    if (_index != 0) {
      _go(0);
      return;
    }
    final DateTime now = DateTime.now();
    final DateTime? last = _lastBackPress;
    if (last == null || now.difference(last) > _kExitPromptWindow) {
      _lastBackPress = now;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Press back again to exit'),
            duration: _kExitPromptWindow,
          ),
        );
      return;
    }
    await SystemNavigator.pop();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkPrivateDns();
      _registerPush();
    });
  }

  /// On authenticated startup: request notification permission, register the
  /// FCM token, and wire tap-to-open-inbox. Best-effort — never blocks the UI.
  void _registerPush() {
    if (!mounted) return;
    ref
        .read(pushMessagingProvider)
        .ensureRegistered(
          ref.read(apiClientProvider),
          onOpenInbox: () {
            if (mounted) context.push(Routes.inbox);
          },
        );
  }

  /// On startup: if Android Private DNS is ON, show a BLOCKING dialog that the
  /// user cannot dismiss until they turn Private DNS off — ads (and therefore
  /// earning) don't work while DNS-over-TLS is intercepting requests. The dialog
  /// re-checks on demand and only closes once DNS is confirmed off.
  Future<void> _checkPrivateDns() async {
    if (_dnsChecked) return;
    _dnsChecked = true;
    final PrivateDnsService service = ref.read(privateDnsServiceProvider);
    final bool on = await service.isPrivateDnsOn();
    if (!mounted || !on) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PrivateDnsBlockDialog(service: service),
    );
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> tabs = <Widget>[
      HomeTab(onGoToTasks: () => _go(1), onGoToWallet: () => _go(2)),
      const TasksScreen(),
      const WalletScreen(),
      const RewardsScreen(),
      const ProfileScreen(),
    ];

    return PopScope(
      // We fully own the top-level back gesture: never auto-pop; route it
      // through [_handleBackPressed] (tab-return, then double-back-to-exit).
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (didPop) return;
        _handleBackPressed();
      },
      child: Scaffold(
        body: IndexedStack(index: _index, children: tabs),
        bottomNavigationBar: DecoratedBox(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: RajaColors.border)),
          ),
          child: BottomNavigationBar(
            currentIndex: _index,
            onTap: _go,
            items: const <BottomNavigationBarItem>[
              BottomNavigationBarItem(
                icon: Icon(Icons.home_rounded),
                label: 'Home',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.task_alt_rounded),
                label: 'Tasks',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.account_balance_wallet_rounded),
                label: 'Wallet',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.card_giftcard_rounded),
                label: 'Rewards',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.person_rounded),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Blocking, non-dismissible gate shown while Android Private DNS is ON. The
/// user cannot use the app until they turn it off: the barrier and the Android
/// back gesture are both blocked, and the only exit is confirming — via
/// "Re-check" — that Private DNS is now off.
class PrivateDnsBlockDialog extends StatefulWidget {
  const PrivateDnsBlockDialog({super.key, required this.service});

  final PrivateDnsService service;

  @override
  State<PrivateDnsBlockDialog> createState() => _PrivateDnsBlockDialogState();
}

class _PrivateDnsBlockDialogState extends State<PrivateDnsBlockDialog> {
  bool _busy = false;
  bool _stillOn = false;

  Future<void> _openSettings() async {
    if (_busy) return;
    setState(() => _busy = true);
    await widget.service.openPrivateDnsSettings();
    if (!mounted) return;
    setState(() => _busy = false);
  }

  Future<void> _recheck() async {
    if (_busy) return;
    setState(() => _busy = true);
    final bool on = await widget.service.isPrivateDnsOn();
    if (!mounted) return;
    if (!on) {
      Navigator.of(context).pop();
      return;
    }
    setState(() {
      _busy = false;
      _stillOn = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Dialog(
        backgroundColor: RajaColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RajaColors.goldGradient,
                ),
                child: const Icon(
                  Icons.dns_rounded,
                  size: 38,
                  color: Color(0xFF1A1300),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Turn off Private DNS',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              const Text(
                'Private DNS must be OFF to watch ads and earn rewards. Open '
                'Settings, set Private DNS to "Off", then come back and re-check.',
                textAlign: TextAlign.center,
                style: TextStyle(color: RajaColors.textSecondary, height: 1.4),
              ),
              if (_stillOn) ...<Widget>[
                const SizedBox(height: 12),
                const Text(
                  'Private DNS is still on. Please switch it off, then re-check.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: RajaColors.rose,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              const SizedBox(height: 24),
              PrimaryButton(
                label: 'Open Settings',
                icon: Icons.settings_rounded,
                onPressed: _busy ? null : _openSettings,
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _busy ? null : _recheck,
                child: Text(
                  _busy ? 'Checking…' : "I've turned it off — Re-check",
                  style: const TextStyle(color: RajaColors.gold),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
