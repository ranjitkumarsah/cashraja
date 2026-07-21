import 'package:cashraja/core/theme/raja_colors.dart';
import 'package:cashraja/core/theme/raja_theme.dart';
import 'package:cashraja/core/widgets/coin_balance.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/harness.dart';

void main() {
  test('Raja theme is dark-first with gold primary', () {
    final ThemeData theme = RajaTheme.dark();
    expect(theme.brightness, Brightness.dark);
    expect(theme.colorScheme.primary, RajaColors.gold);
    expect(theme.scaffoldBackgroundColor, RajaColors.indigoDeep);
  });

  testWidgets('CoinBalance renders a grouped, tabular coin amount',
      (tester) async {
    await pumpApp(
      tester,
      const Scaffold(body: Center(child: CoinBalance(amount: 123456))),
    );
    await tester.pumpAndSettle();
    expect(find.text('1,23,456'), findsOneWidget); // Indian grouping
  });
}
