import { Module } from '@nestjs/common';
import { AdminFeedbackController } from './admin-feedback.controller';
import { AdminFeedbackService } from './admin-feedback.service';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

/**
 * H4 — user feedback/complaints. Bundles the user intake surface (submit + read
 * own) and the admin triage surface (queue + reply + resolve). PrismaModule is
 * global, so no imports are needed.
 */
@Module({
  controllers: [FeedbackController, AdminFeedbackController],
  providers: [FeedbackService, AdminFeedbackService],
})
export class FeedbackModule {}
