import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

/** C3.8 — user account self-deletion (anonymize-in-place). */
@Module({
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
