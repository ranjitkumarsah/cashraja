import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService, FeedbackView } from './feedback.service';

/** H4 — user feedback/complaint submission + read-back of own submissions. */
@ApiTags('feedback')
@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  submit(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateFeedbackDto,
  ): Promise<FeedbackView> {
    return this.feedback.submit(requireUser(user).id, {
      type: dto.type,
      subject: dto.subject,
      message: dto.message,
    });
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser | undefined): Promise<FeedbackView[]> {
    return this.feedback.listMine(requireUser(user).id);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
