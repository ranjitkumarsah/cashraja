import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Audience for a broadcast: everyone, or an explicit list of user ids. */
export class BroadcastAudienceDto {
  @IsIn(['all', 'users'])
  type!: 'all' | 'users';

  /** Required (and non-empty) when type = 'users'; ignored for 'all'. */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10_000)
  @IsUUID('4', { each: true })
  user_ids?: string[];
}

/** POST /api/admin/notifications/broadcast — compose + send a broadcast. */
export class BroadcastNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;

  @ValidateNested()
  @Type(() => BroadcastAudienceDto)
  audience!: BroadcastAudienceDto;
}
