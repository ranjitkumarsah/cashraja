import { ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import {
  Body,
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
import {
  BonusPlayResult,
  BonusRollResult,
  BonusService,
  BonusStateView,
} from './bonus.service';

/** Body for the spin claim step — the reservation returned by `spin/roll`. */
export class ClaimSpinDto {
  @IsUUID()
  reservation_id!: string;
}

/** D3 — scratch/spin state + server-rolled play, JWT-guarded. */
@ApiTags('bonus')
@Controller('bonus')
@UseGuards(JwtAuthGuard)
export class BonusController {
  constructor(private readonly bonus: BonusService) {}

  /**
   * Step 1 (roll): reserve + return the server-picked prize WITHOUT crediting,
   * so the client can reveal it (scratch: on the card; spin: land the wheel)
   * before gating the credit behind a rewarded ad. Shared by scratch and spin.
   */
  @Post(':type/roll')
  roll(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('type', new ParseEnumPipe(BonusKind)) type: BonusKind,
  ): Promise<BonusRollResult> {
    return this.bonus.roll(requireUser(user).id, type);
  }

  /**
   * Step 2 (claim): credit a reserved prize after the rewarded ad completes.
   * The reservation carries its own kind, so the route `:type` is cosmetic.
   */
  @Post(':type/claim')
  claim(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('type', new ParseEnumPipe(BonusKind)) _type: BonusKind,
    @Body() dto: ClaimSpinDto,
  ): Promise<BonusPlayResult> {
    return this.bonus.claim(requireUser(user).id, dto.reservation_id);
  }

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
