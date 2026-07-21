import 'package:intl/intl.dart';

/// Central place for value → display-string formatting.
abstract class Formatters {
  static final NumberFormat _coins = NumberFormat.decimalPattern('en_IN');
  static final NumberFormat _rupees = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  /// Grouped coin count, e.g. `1,23,456` (Indian grouping).
  static String coins(int value) => _coins.format(value);

  /// Signed coin delta for ledger rows, e.g. `+100` / `-250`.
  static String signedCoins(int value) {
    final String sign = value >= 0 ? '+' : '-';
    return '$sign${_coins.format(value.abs())}';
  }

  /// Rupee face value, e.g. `₹50`.
  static String rupees(int value) => _rupees.format(value);

  /// Compact date, e.g. `21 Jul 2026`.
  static String date(DateTime dt) => DateFormat('d MMM yyyy').format(dt.toLocal());

  /// Date + time, e.g. `21 Jul, 2:30 PM`.
  static String dateTime(DateTime dt) =>
      DateFormat('d MMM, h:mm a').format(dt.toLocal());
}
