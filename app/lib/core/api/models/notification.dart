/// In-app inbox notification (H8). Mirrors the backend `NotificationView`
/// (`GET /api/notifications`). All wire fields are snake_case.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.read,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final bool read;
  final DateTime createdAt;

  AppNotification copyWith({bool? read}) => AppNotification(
        id: id,
        type: type,
        title: title,
        body: body,
        read: read ?? this.read,
        createdAt: createdAt,
      );

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: (json['id'] as String?) ?? '',
      type: (json['type'] as String?) ?? '',
      title: (json['title'] as String?) ?? '',
      body: (json['body'] as String?) ?? '',
      read: (json['read'] as bool?) ?? false,
      createdAt: DateTime.tryParse((json['created_at'] as String?) ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

/// One keyset-paginated page of the inbox, plus the total unread count
/// (`GET /api/notifications` → `{ notifications, unread_count, next_cursor }`).
class NotificationPage {
  const NotificationPage({
    required this.notifications,
    required this.unreadCount,
    required this.nextCursor,
  });

  final List<AppNotification> notifications;
  final int unreadCount;
  final String? nextCursor;

  factory NotificationPage.fromJson(Map<String, dynamic> json) {
    final List<dynamic> list =
        (json['notifications'] as List<dynamic>?) ?? <dynamic>[];
    return NotificationPage(
      notifications: list
          .map((dynamic e) =>
              AppNotification.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      unreadCount: (json['unread_count'] as num?)?.toInt() ?? 0,
      nextCursor: json['next_cursor'] as String?,
    );
  }
}
