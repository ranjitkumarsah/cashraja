import { IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** Body of POST /api/auth/google (TRD §3.1 + device fingerprint + referral). */
export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  id_token!: string;

  @IsString()
  @Length(8, 128)
  device_fingerprint!: string;

  @IsOptional()
  @IsString()
  @Length(4, 16)
  referral_code?: string;
}
