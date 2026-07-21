import 'package:dio/dio.dart';

/// A normalized API error with a user-presentable [message].
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isUnauthorized => statusCode == 401;

  /// Builds a friendly exception from a Dio error, pulling the backend's
  /// `message` field when present (NestJS error envelope).
  factory ApiException.fromDio(DioException e) {
    final Response<dynamic>? res = e.response;
    final int? code = res?.statusCode;

    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.connectionError) {
      return const ApiException(
        'Can\'t reach the server. Check your connection and try again.',
      );
    }

    final dynamic data = res?.data;
    String? message;
    if (data is Map<String, dynamic>) {
      final Object? m = data['message'];
      if (m is String) {
        message = m;
      } else if (m is List && m.isNotEmpty) {
        message = m.first.toString();
      }
    }

    return ApiException(
      message ?? _defaultFor(code),
      statusCode: code,
    );
  }

  static String _defaultFor(int? code) {
    switch (code) {
      case 400:
        return 'That request wasn\'t valid.';
      case 401:
        return 'Your session expired. Please sign in again.';
      case 403:
        return 'You don\'t have access to that.';
      case 404:
        return 'Not found.';
      case 409:
        return 'That\'s not available right now.';
      case 429:
        return 'Too many attempts. Please slow down.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  @override
  String toString() => message;
}
