import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralModule } from '../referral/referral.module';
import { AdminManualOfferSubmissionsController } from './admin-manual-offer-submissions.controller';
import { AdminManualOfferSubmissionsService } from './admin-manual-offer-submissions.service';
import { AdminManualOffersController } from './admin-manual-offers.controller';
import { AdminManualOffersService } from './admin-manual-offers.service';
import { ManualOffersController } from './manual-offers.controller';
import { ManualOffersService } from './manual-offers.service';

/**
 * H5 — manual offers + text-proof review. Bundles the user surface (list active
 * / submit proof / read own), super-admin offer management, and the reviewer
 * approval queue. Approval credits go through LedgerService (imported), with
 * referral + notification fan-out mirroring the postback-credit path.
 */
@Module({
  imports: [LedgerModule, NotificationsModule, ReferralModule],
  controllers: [
    ManualOffersController,
    AdminManualOffersController,
    AdminManualOfferSubmissionsController,
  ],
  providers: [
    ManualOffersService,
    AdminManualOffersService,
    AdminManualOfferSubmissionsService,
  ],
})
export class ManualOffersModule {}
