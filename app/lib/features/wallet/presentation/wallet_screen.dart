import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/wallet.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_balance.dart';
import '../../../core/widgets/gradient_background.dart';
import 'ledger_tile.dart';
import 'wallet_controllers.dart';

class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels >=
        _scroll.position.maxScrollExtent - 240) {
      ref.read(ledgerControllerProvider.notifier).loadMore();
    }
  }

  Future<void> _refresh() async {
    await Future.wait(<Future<void>>[
      ref.read(walletControllerProvider.notifier).refresh(),
      ref.read(ledgerControllerProvider.notifier).refresh(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<WalletSummary> wallet =
        ref.watch(walletControllerProvider);
    final AsyncValue<LedgerListState> ledger =
        ref.watch(ledgerControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: RefreshIndicator(
            color: RajaColors.gold,
            backgroundColor: RajaColors.surface,
            onRefresh: _refresh,
            child: CustomScrollView(
              controller: _scroll,
              slivers: <Widget>[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: _BalanceCard(wallet: wallet),
                  ),
                ),
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
                    child: Text(
                      'History',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: RajaColors.textPrimary,
                      ),
                    ),
                  ),
                ),
                ..._historySlivers(ledger),
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _historySlivers(AsyncValue<LedgerListState> ledger) {
    return <Widget>[
      ledger.when(
        loading: () => const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Center(
              child: CircularProgressIndicator(color: RajaColors.gold),
            ),
          ),
        ),
        error: (Object e, _) => SliverToBoxAdapter(
          child: ErrorStateView(
            message: e.toString().replaceFirst('Exception: ', ''),
            onRetry: () =>
                ref.read(ledgerControllerProvider.notifier).refresh(),
          ),
        ),
        data: (LedgerListState s) {
          if (s.entries.isEmpty) {
            return const SliverToBoxAdapter(
              child: EmptyStateView(
                icon: Icons.receipt_long_rounded,
                title: 'No activity yet',
                subtitle: 'Earn some coins and it\'ll show up here.',
              ),
            );
          }
          return SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverList.separated(
              itemCount: s.entries.length + (s.hasMore ? 1 : 0),
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (BuildContext context, int i) {
                if (i >= s.entries.length) {
                  return const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(
                      child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: RajaColors.gold,
                        ),
                      ),
                    ),
                  );
                }
                return LedgerTile(entry: s.entries[i]);
              },
            ),
          );
        },
      ),
    ];
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.wallet});

  final AsyncValue<WalletSummary> wallet;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(24),
      gradient: const LinearGradient(
        colors: <Color>[RajaColors.indigo, RajaColors.surfaceHigh],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: AsyncValueView<WalletSummary>(
        value: wallet,
        data: (WalletSummary w) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text(
              'Coin balance',
              style: TextStyle(color: RajaColors.textSecondary),
            ),
            const SizedBox(height: 10),
            CoinBalance(amount: w.coinBalance, fontSize: 40, glyphSize: 34),
            if (w.pendingOfferCredits > 0) ...<Widget>[
              const SizedBox(height: 12),
              Text(
                '${w.pendingOfferCredits} coins pending from offers',
                style: const TextStyle(
                  color: RajaColors.amber,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
