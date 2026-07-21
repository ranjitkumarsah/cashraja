import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleFcmDriver, FCM_DRIVER, FcmDriver, FirebaseFcmDriver } from './fcm-driver';
import { NOTIFICATION_HOOK } from './notification-hook';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { StreakReminderJob } from './streak-reminder.job';

/**
 * E2 — notifications. NotificationService is bound behind NOTIFICATION_HOOK
 * (replacing the Phase-B no-op) so all credit paths deliver inbox + push
 * notifications, and is exported for redemption status changes and the streak
 * reminder job. FCM_DRIVER is env-selected (console default / firebase real).
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    {
      provide: FCM_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): FcmDriver => {
        const driver = config.get<string>('FCM_DRIVER') ?? 'console';
        return driver === 'firebase' ? new FirebaseFcmDriver(config) : new ConsoleFcmDriver();
      },
    },
    NotificationService,
    { provide: NOTIFICATION_HOOK, useExisting: NotificationService },
    StreakReminderJob,
  ],
  exports: [NOTIFICATION_HOOK, NotificationService],
})
export class NotificationsModule {}
