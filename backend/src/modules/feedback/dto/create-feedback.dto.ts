import { FeedbackType } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

/** POST /api/feedback — a user submits feedback or a complaint. */
export class CreateFeedbackDto {
  @IsEnum(FeedbackType)
  type!: FeedbackType;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message!: string;
}
