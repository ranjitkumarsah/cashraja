import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/models/referral.dart';
import '../../../core/providers.dart';

/// The referral code (`GET /referral/my-code`) plus stats
/// (`GET /referral/stats`), loaded together for the Invite & Earn screen.
class InviteData {
  const InviteData({required this.code, required this.stats});

  final String code;
  final ReferralStats stats;
}

class InviteController extends AsyncNotifier<InviteData> {
  Future<InviteData> _load() async {
    final ApiClient api = ref.read(apiClientProvider);
    final List<dynamic> results = await Future.wait<dynamic>(<Future<dynamic>>[
      api.referralCode(),
      api.referralStats(),
    ]);
    final ReferralCode code = results[0] as ReferralCode;
    final ReferralStats stats = results[1] as ReferralStats;
    return InviteData(code: code.code, stats: stats);
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
