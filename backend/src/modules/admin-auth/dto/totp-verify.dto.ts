import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

/** Body of POST /api/admin-auth/totp and /api/admin-auth/totp-setup. */
export class TotpVerifyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  challenge_token!: string;

  @IsString()
  @Length(6, 8)
  code!: string;
}
