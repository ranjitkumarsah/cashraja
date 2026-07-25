import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

/** Body of POST /api/auth/attest — server-authoritative 18+ DOB attestation. */
export class AttestDto {
  /** ISO date (e.g. "1998-01-31"). Age is enforced server-side. */
  @IsDateString()
  date_of_birth!: string;

  @IsOptional()
  @IsString()
  @Length(4, 16)
  referral_code?: string;
}
