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
import { AdminFeedbackService, AdminFeedbackView } from './admin-feedback.service';
import { FeedbackQueryDto } from './dto/feedback-query.dto';
import { ReplyFeedbackDto } from './dto/reply-feedback.dto';

/**
 * H4 — admin feedback queue. Reviewers and super-admins both view, reply, and
 * resolve (RBAC: no @Roles beyond admin auth). Every mutation is audited.
 */
@ApiTags('admin')
@Controller('admin/feedback')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminFeedbackController {
  constructor(private readonly feedback: AdminFeedbackService) {}

  @Get()
  list(@Query() query: FeedbackQueryDto): Promise<AdminFeedbackView[]> {
    return this.feedback.list(query.status);
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.OK)
  reply(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
    @Body() dto: ReplyFeedbackDto,
  ): Promise<AdminFeedbackView> {
    return this.feedback.reply(requireAdmin(admin).id, id, dto.reply);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
  ): Promise<AdminFeedbackView> {
    return this.feedback.resolve(requireAdmin(admin).id, id);
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
