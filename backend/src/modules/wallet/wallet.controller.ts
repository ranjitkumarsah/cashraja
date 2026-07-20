import { Controller, Get, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { LedgerPage, WalletService, WalletView } from './wallet.service';

/**
 * TRD §3.2 — wallet reads, JWT-guarded. Global throttle (300/min) applies;
 * wallet reads are cheap cached lookups, no stricter limit needed (see
 * backend README rate-limit notes).
 */
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  wallet_(@CurrentUser() user: AuthenticatedUser | undefined): Promise<WalletView> {
    return this.wallet.walletOf(requireUser(user).id);
  }

  @Get('ledger')
  ledger(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: LedgerQueryDto,
  ): Promise<LedgerPage> {
    return this.wallet.ledgerPage(requireUser(user).id, query.cursor, query.limit);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
