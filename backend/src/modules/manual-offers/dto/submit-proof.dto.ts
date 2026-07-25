import { IsString, MaxLength, MinLength } from 'class-validator';

/** POST /api/manual-offers/:id/submit — a user submits free-text proof. */
export class SubmitProofDto {
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  proof_text!: string;
}
