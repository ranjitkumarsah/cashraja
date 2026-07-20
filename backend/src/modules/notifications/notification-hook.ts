import { Injectable, Logger } from '@nestjs/common';
import { LedgerSourceType } from '@prisma/client';

/**
 * Post-credit notification hook (ARCHITECTURE_PLAN §2.2 step 8).
 * Phase B: interface + no-op stub. Phase E binds the FCM + in-app inbox
 * implementation behind the same token.
 */

export interface CreditNotification {
  userId: string;
  coins: number;
  sourceType: LedgerSourceType;
  /** offer_completion id / ad_impression id */
  sourceRefId: string;
}

export interface NotificationHook {
  onCredited(notification: CreditNotification): Promise<void>;
}

export const NOTIFICATION_HOOK = 'NOTIFICATION_HOOK';

/** Phase B stub: logs at debug level only. */
@Injectable()
export class NoopNotificationHook implements NotificationHook {
  private readonly logger = new Logger(NoopNotificationHook.name);

  async onCredited(notification: CreditNotification): Promise<void> {
    this.logger.debug(
      `credit notification (noop): user=${notification.userId} +${notification.coins} ${notification.sourceType}`,
    );
  }
}
