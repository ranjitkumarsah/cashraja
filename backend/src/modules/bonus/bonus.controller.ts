import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { BonusKind } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { BonusPlayResult, BonusService, BonusStateView } from './bonus.service';

/** D3 — scratch/spin state + server-rolled play, JWT-guarded. */
@ApiTags('bonus')
@Controller('bonus')
@UseGuards(JwtAuthGuard)
export class BonusController {
  constructor(private readonly bonus: BonusService) {}

  @Get(':type')
  state(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('type', new ParseEnumPipe(BonusKind)) type: BonusKind,
  ): Promise<BonusStateView> {
    return this.bonus.getState(requireUser(user).id, type);
  }

  @Post(':type/play')
  play(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('type', new ParseEnumPipe(BonusKind)) type: BonusKind,
  ): Promise<BonusPlayResult> {
    return this.bonus.play(requireUser(user).id, type);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
