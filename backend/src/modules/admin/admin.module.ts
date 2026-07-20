import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { AdminAdminsController } from './admin-admins.controller';
import { AdminAdminsService } from './admin-admins.service';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';
import { AdminFraudController } from './admin-fraud.controller';
import { AdminFraudService } from './admin-fraud.service';
import { AdminOffersController } from './admin-offers.controller';
import { AdminOffersService } from './admin-offers.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

/**
 * C3 — admin management API (users, offers, config, admins, fraud). Redemption
 * queue lives in RedemptionsModule; dashboard metrics in MetricsModule. RBAC is
 * enforced per-route via @Roles + RolesGuard behind AdminAuthGuard.
 */
@Module({
  imports: [LedgerModule],
  controllers: [
    AdminUsersController,
    AdminOffersController,
    AdminConfigController,
    AdminAdminsController,
    AdminFraudController,
  ],
  providers: [
    AdminUsersService,
    AdminOffersService,
    AdminConfigService,
    AdminAdminsService,
    AdminFraudService,
  ],
  exports: [AdminUsersService],
})
export class AdminModule {}
