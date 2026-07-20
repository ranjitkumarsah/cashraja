import { Module } from '@nestjs/common';
import { NOTIFICATION_HOOK, NoopNotificationHook } from './notification-hook';

/** Notifications (Phase B: no-op hook; FCM + inbox land in Phase E). */
@Module({
  providers: [{ provide: NOTIFICATION_HOOK, useClass: NoopNotificationHook }],
  exports: [NOTIFICATION_HOOK],
})
export class NotificationsModule {}
