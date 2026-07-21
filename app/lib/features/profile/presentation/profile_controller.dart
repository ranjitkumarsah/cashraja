import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/user.dart';
import '../../../core/providers.dart';
import '../../auth/presentation/auth_controller.dart';

class ProfileController extends AsyncNotifier<MeProfile> {
  @override
  Future<MeProfile> build() => ref.read(apiClientProvider).me();

  Future<void> refresh() async {
    state = const AsyncValue<MeProfile>.loading();
    state = await AsyncValue.guard(() => ref.read(apiClientProvider).me());
  }

  /// Permanently deletes (anonymizes) the account, then signs out locally.
  Future<void> deleteAccount() async {
    await ref.read(apiClientProvider).deleteAccount();
    await ref.read(authControllerProvider.notifier).signOut();
  }
}

final profileControllerProvider =
    AsyncNotifierProvider<ProfileController, MeProfile>(ProfileController.new);
