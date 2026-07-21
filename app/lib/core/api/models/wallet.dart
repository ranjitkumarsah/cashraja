import 'enums.dart';

/// A single append-only ledger row.
class LedgerEntry {
  const LedgerEntry({
    required this.id,
    required this.amount,
    required this.sourceType,
    required this.balanceAfter,
    required this.createdAt,
    this.sourceRefId,
  });

  final String id;
  final int amount;
  final LedgerSourceType sourceType;
  final int balanceAfter;
  final DateTime createdAt;
  final String? sourceRefId;

  bool get isCredit => amount >= 0;

  factory LedgerEntry.fromJson(Map<String, dynamic> json) {
    return LedgerEntry(
      id: json['id'] as String,
      amount: (json['amount'] as num).toInt(),
      sourceType: LedgerSourceType.fromWire(json['source_type'] as String?),
      balanceAfter: (json['balance_after'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
      sourceRefId: json['source_ref_id'] as String?,
    );
  }
}

/// `GET /api/wallet` summary.
class WalletSummary {
  const WalletSummary({
    required this.coinBalance,
    required this.pendingOfferCredits,
    required this.recentEntries,
  });

  final int coinBalance;
  final int pendingOfferCredits;
  final List<LedgerEntry> recentEntries;

  factory WalletSummary.fromJson(Map<String, dynamic> json) {
    final List<dynamic> entries =
        (json['recent_ledger_entries'] as List<dynamic>?) ?? <dynamic>[];
    return WalletSummary(
      coinBalance: (json['coin_balance'] as num?)?.toInt() ?? 0,
      pendingOfferCredits: (json['pending_offer_credits'] as num?)?.toInt() ?? 0,
      recentEntries: entries
          .map((dynamic e) => LedgerEntry.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}

/// One page of `GET /api/wallet/ledger` (keyset pagination).
class LedgerPage {
  const LedgerPage({required this.entries, this.nextCursor});

  final List<LedgerEntry> entries;
  final String? nextCursor;

  bool get hasMore => nextCursor != null;

  factory LedgerPage.fromJson(Map<String, dynamic> json) {
    final List<dynamic> entries =
        (json['entries'] as List<dynamic>?) ?? <dynamic>[];
    return LedgerPage(
      entries: entries
          .map((dynamic e) => LedgerEntry.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      nextCursor: json['next_cursor'] as String?,
    );
  }
}
