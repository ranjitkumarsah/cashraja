import { IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterTokenDto {
  /** FCM registration token from the device SDK. */
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  token!: string;
}
