import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, AuthenticatedAdmin, CurrentAdmin, RolesGuard } from '../../common/auth';
import { AdminFraudService, FraudFlagView } from './admin-fraud.service';
import { FraudQueryDto } from './dto/fraud-query.dto';
import { ResolveFraudDto } from './dto/resolve-fraud.dto';

/**
 * C3.7 — fraud-flag review queue. Reviewers and super-admins both view and
 * resolve (RBAC matrix §2.3 — "view flags"), so no @Roles gate beyond admin auth.
 */
@ApiTags('admin')
@Controller('admin/fraud-flags')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminFraudController {
  constructor(private readonly fraud: AdminFraudService) {}

  @Get()
  list(@Query() query: FraudQueryDto): Promise<FraudFlagView[]> {
    return this.fraud.list(query.status);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
    @Body() dto: ResolveFraudDto,
  ): Promise<FraudFlagView> {
    return this.fraud.resolve(requireAdmin(admin).id, id, dto.action, dto.note);
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
