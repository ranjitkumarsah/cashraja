import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService, AuthTokens, GoogleLoginResult } from './auth.service';
import { clientIpOf } from './client-ip';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { RefreshDto } from './dto/refresh.dto';

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

  /** TRD §3.1: rotate the refresh token (reuse detection revokes the chain). */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refresh_token);
  }
}
