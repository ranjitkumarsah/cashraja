import 'package:flutter/material.dart';

import '../../../core/theme/raja_colors.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../rewards/presentation/rewards_screen.dart';
import '../../tasks/presentation/tasks_screen.dart';
import '../../wallet/presentation/wallet_screen.dart';
import 'home_tab.dart';

/// Authenticated home shell with a bottom navigation bar over five tabs.
/// Tabs are kept alive via [IndexedStack] so state (scroll, forms) persists.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  void _go(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    final List<Widget> tabs = <Widget>[
      HomeTab(
        onGoToTasks: () => _go(1),
        onGoToWallet: () => _go(2),
      ),
      const TasksScreen(),
      const WalletScreen(),
      const RewardsScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
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
    );
  }
}
