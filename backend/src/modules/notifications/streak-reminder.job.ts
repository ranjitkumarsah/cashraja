import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { istDateString, istDateStringToDate } from '../../common/time/ist-day';
import { NotificationService } from './notification.service';

const MAX_REMINDERS_PER_RUN = 5_000;

/**
 * E2 (optional) — daily streak reminder. At 19:00 IST, push a reminder to users
 * who have an active streak but haven't claimed today, so they don't break it.
 * Push-only (no inbox spam). Disabled by default via STREAK_REMINDER_ENABLED so
 * it never fires in environments that didn't opt in.
 */
@Injectable()
export class StreakReminderJob {
  private readonly logger = new Logger(StreakReminderJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 19 * * *', { timeZone: 'Asia/Kolkata' })
  async remind(): Promise<void> {
    if ((this.config.get<string>('STREAK_REMINDER_ENABLED') ?? 'false') !== 'true') {
      return;
    }
    const today = istDateStringToDate(istDateString());
    const stale = await this.prisma.streak.findMany({
      where: { currentCount: { gt: 0 }, lastClaimDate: { lt: today } },
      select: { userId: true, currentCount: true },
      take: MAX_REMINDERS_PER_RUN,
    });
    for (const s of stale) {
      await this.notifications.push({
        userId: s.userId,
        type: 'streak_reminder',
        title: 'Keep your streak alive',
        body: `Claim your daily bonus to keep your ${s.currentCount}-day streak going.`,
        data: { kind: 'streak_reminder' },
      });
    }
    if (stale.length > 0) {
      this.logger.log(`streak reminder pushed to ${stale.length} users`);
    }
  }
}
