import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/models/referral.dart';
import '../../../core/providers.dart';

/// The referral code (`GET /referral/my-code`), summary stats
/// (`GET /referral/stats`) and the per-user breakdown
/// (`GET /referral/breakdown`), loaded together for the Invite & Earn screen.
class InviteData {
  const InviteData({
    required this.code,
    required this.stats,
    required this.breakdown,
  });

  final String code;
  final ReferralStats stats;
  final ReferralBreakdown breakdown;
}

class InviteController extends AsyncNotifier<InviteData> {
  Future<InviteData> _load() async {
    final ApiClient api = ref.read(apiClientProvider);
    final List<dynamic> results = await Future.wait<dynamic>(<Future<dynamic>>[
      api.referralCode(),
      api.referralStats(),
      api.referralBreakdown(),
    ]);
    final ReferralCode code = results[0] as ReferralCode;
    final ReferralStats stats = results[1] as ReferralStats;
    final ReferralBreakdown breakdown = results[2] as ReferralBreakdown;
    return InviteData(code: code.code, stats: stats, breakdown: breakdown);
  }

  @override
  Future<InviteData> build() => _load();

  Future<void> refresh() async {
    state = const AsyncValue<InviteData>.loading();
    state = await AsyncValue.guard(_load);
  }
}

final inviteControllerProvider =
    AsyncNotifierProvider<InviteController, InviteData>(InviteController.new);
