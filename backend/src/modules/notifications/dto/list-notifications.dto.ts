import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { NOTIFICATION_PAGE_MAX_LIMIT } from '../notification.service';

export class ListNotificationsDto {
  /** Opaque keyset cursor from the previous page's next_cursor. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NOTIFICATION_PAGE_MAX_LIMIT)
  limit?: number;
}
