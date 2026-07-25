import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { AttestResult, AuthService, AuthTokens, GoogleLoginResult } from './auth.service';
import { clientIpOf } from './client-ip';
import { AttestDto } from './dto/attest.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** TRD §3.1: exchange a Firebase ID token for app JWT + refresh token. */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  google(@Body() dto: GoogleAuthDto, @Req() req: Request): Promise<GoogleLoginResult> {
    return this.auth.loginWithGoogle({
      idToken: dto.id_token,
      deviceFingerprint: dto.device_fingerprint,
      referralCode: dto.referral_code,
      clientIp: clientIpOf(req),
    });
  }

  /**
   * Server-authoritative 18+ attestation (JWT-protected). Persists the DOB and
   * links the referral for a brand-new user. Enforces 18+ server-side.
   */
  @Post('attest')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  attest(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: AttestDto,
  ): Promise<AttestResult> {
    if (!user) throw new UnauthorizedException();
    return this.auth.attest({
      userId: user.id,
      dateOfBirth: new Date(dto.date_of_birth),
      referralCode: dto.referral_code,
    });
  }

  /** TRD §3.1: rotate the refresh token (reuse detection revokes the chain). */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refresh_token);
  }
}
