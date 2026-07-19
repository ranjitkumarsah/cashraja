import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AdminAuthService,
  AdminSessionResult,
  TotpChallengeResult,
} from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { TotpVerifyDto } from './dto/totp-verify.dto';

/**
 * Admin login flow (A4.7). Strict throttling on every credential endpoint
 * (ARCHITECTURE_PLAN §2.5); the rest of the API keeps the generous global
 * default for now.
 */
@Controller('admin-auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: AdminLoginDto): Promise<TotpChallengeResult> {
    return this.adminAuth.login(dto.email, dto.password);
  }

  @Post('totp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyTotp(@Body() dto: TotpVerifyDto): Promise<AdminSessionResult> {
    return this.adminAuth.verifyTotp(dto.challenge_token, dto.code);
  }

  @Post('totp-setup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  setupTotp(@Body() dto: TotpVerifyDto): Promise<AdminSessionResult> {
    return this.adminAuth.setupTotp(dto.challenge_token, dto.code);
  }
}
