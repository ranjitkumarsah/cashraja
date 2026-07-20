import {
  Controller,
  Get,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface MeView {
  id: string;
  email: string;
  display_name: string;
  country: string | null;
  status: string;
  referral_code: string;
  created_at: string;
  /** Streak state lands in Phase D (D2) — placeholder until then. */
  streak: null;
}

/** GET /api/me — profile + referral code (B4.3). */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() user: AuthenticatedUser | undefined): Promise<MeView> {
    if (!user) throw new UnauthorizedException();
    const row = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!row) throw new NotFoundException('User not found');
    return {
      id: row.id,
      email: row.email,
      display_name: row.displayName,
      country: row.country,
      status: row.status,
      referral_code: row.referralCode,
      created_at: row.createdAt.toISOString(),
      streak: null,
    };
  }
}
