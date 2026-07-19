import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body of POST /api/auth/refresh (TRD §3.1). */
export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refresh_token!: string;
}
