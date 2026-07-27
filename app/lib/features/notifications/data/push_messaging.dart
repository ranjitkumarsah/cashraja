import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

/// Android notification channel for foreground/local display (H8). Must match
/// the id declared in AndroidManifest's default-channel metadata.
const AndroidNotificationChannel _channel = AndroidNotificationChannel(
  'cash_raja_default',
  'Cash Raja',
  description: 'Rewards, redemptions and updates',
  importance: Importance.high,
);

/// Background/terminated push handler. Android renders `notification` messages
/// in the system tray automatically, so this only needs to exist. Must be a
/// top-level function annotated as a VM entry point.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // No-op: the OS displays notification-type messages while backgrounded.
}

/// Registers the background handler as early as possible (called from main,
/// before runApp). Best-effort — never throws.
Future<void> initPushBackgroundHandler() async {
  try {
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (e) {
    debugPrint('push background handler registration skipped: $e');
  }
}

/// Owns FCM setup for an authenticated session: notification permission, the
/// Android channel + foreground display, token registration (+ refresh), and a
/// tap-to-open-inbox callback. All operations are best-effort and never throw —
/// a push failure must never break the app.
class PushMessaging {
  PushMessaging();

  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  bool _started = false;

  /// Idempotent per app run. [onOpenInbox] is invoked when the user taps a
  /// notification (tray tap while backgrounded, or a foreground local tap).
  Future<void> ensureRegistered(
    ApiClient api, {
    VoidCallback? onOpenInbox,
  }) async {
    if (_started) return;
    _started = true;
    try {
      final FirebaseMessaging messaging = FirebaseMessaging.instance;

      await messaging.requestPermission();
      await _initLocal(onOpenInbox);

      // Foreground messages don't auto-display on Android — show them locally.
      FirebaseMessaging.onMessage.listen(_showForeground);

      // Tray tap that launched/resumed the app → open the inbox.
      FirebaseMessaging.onMessageOpenedApp.listen((_) => onOpenInbox?.call());
      final RemoteMessage? initial = await messaging.getInitialMessage();
      if (initial != null) onOpenInbox?.call();

      // Register the current token, then keep it fresh.
      final String? token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        await _register(api, token);
      }
      messaging.onTokenRefresh.listen((String t) => _register(api, t));
    } catch (e) {
      debugPrint('push registration skipped: $e');
    }
  }

  Future<void> _initLocal(VoidCallback? onOpenInbox) async {
    const AndroidInitializationSettings android =
        AndroidInitializationSettings('ic_stat_coin');
    await _local.initialize(
      const InitializationSettings(android: android),
      onDidReceiveNotificationResponse: (NotificationResponse _) =>
          onOpenInbox?.call(),
    );
    await _local
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);
  }

  Future<void> _showForeground(RemoteMessage message) async {
    final RemoteNotification? n = message.notification;
    if (n == null) return;
    await _local.show(
      n.hashCode,
      n.title,
      n.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          icon: 'ic_stat_coin',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
    );
  }

  Future<void> _register(ApiClient api, String token) async {
    try {
      await api.registerFcmToken(token);
    } catch (e) {
      debugPrint('fcm token registration failed: $e');
    }
  }
}

final pushMessagingProvider =
    Provider<PushMessaging>((Ref ref) => PushMessaging());
