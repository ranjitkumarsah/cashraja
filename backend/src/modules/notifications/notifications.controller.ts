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
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterTokenDto } from './dto/register-token.dto';
import { NotificationPage, NotificationService } from './notification.service';

/**
 * E2 — user notifications (JWT). Register a device FCM token, list the in-app
 * inbox (keyset-paginated with unread count), and mark items read.
 */
@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('register-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerToken(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: RegisterTokenDto,
  ): Promise<void> {
    await this.notifications.registerToken(requireUser(user).id, dto.token);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListNotificationsDto,
  ): Promise<NotificationPage> {
    return this.notifications.list(requireUser(user).id, query.cursor, query.limit);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    return this.notifications.markRead(requireUser(user).id, id);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
