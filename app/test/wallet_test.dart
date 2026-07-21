import 'package:cashraja/core/api/models/enums.dart';
import 'package:cashraja/core/api/models/wallet.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/wallet/presentation/wallet_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

void main() {
  testWidgets('Wallet shows balance, pending, and ledger history',
      (tester) async {
    final WalletSummary summary = WalletSummary(
      coinBalance: 6000,
      pendingOfferCredits: 250,
      recentEntries: <LedgerEntry>[
        LedgerEntry(
          id: 'l1',
          amount: 100,
          sourceType: LedgerSourceType.offer,
          balanceAfter: 6000,
          createdAt: DateTime(2026, 7, 20, 10),
        ),
      ],
    );
    final LedgerPage page =
        LedgerPage(entries: summary.recentEntries, nextCursor: null);

    await pumpApp(
      tester,
      const WalletScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(walletData: summary, ledgerData: page),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('6,000'), findsOneWidget);
    expect(find.textContaining('pending'), findsOneWidget);
    expect(find.text('Offer'), findsOneWidget);
    expect(find.text('+100'), findsOneWidget);
  });
}
