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
import { ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard, AuthenticatedAdmin, CurrentAdmin, RolesGuard } from '../../common/auth';
import {
  AdminManualOfferSubmissionsService,
  AdminSubmissionView,
} from './admin-manual-offer-submissions.service';
import { RejectSubmissionDto } from './dto/reject-submission.dto';
import { SubmissionQueryDto } from './dto/submission-query.dto';

/**
 * H5 — manual-offer proof review queue. Reviewers and super-admins both view,
 * approve, and reject (no @Roles gate beyond admin auth). Every mutation is
 * audited; approval credits the reward through LedgerService.
 */
@ApiTags('admin')
@Controller('admin/manual-offer-submissions')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminManualOfferSubmissionsController {
  constructor(private readonly submissions: AdminManualOfferSubmissionsService) {}

  @Get()
  list(@Query() query: SubmissionQueryDto): Promise<AdminSubmissionView[]> {
    return this.submissions.list(query.status);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
  ): Promise<AdminSubmissionView> {
    return this.submissions.approve(requireAdmin(admin).id, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
    @Body() dto: RejectSubmissionDto,
  ): Promise<AdminSubmissionView> {
    return this.submissions.reject(requireAdmin(admin).id, id, dto.reason);
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
