import { Controller, Delete, HttpCode, HttpStatus, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { AccountDeletionResult, AccountService } from './account.service';

/** DELETE /api/account (JWT) — user-initiated account deletion (C3.8). */
@ApiTags('account')
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Delete()
  @HttpCode(HttpStatus.OK)
  deleteSelf(@CurrentUser() user: AuthenticatedUser | undefined): Promise<AccountDeletionResult> {
    if (!user) throw new UnauthorizedException();
    return this.account.deleteSelf(user.id);
  }
}
