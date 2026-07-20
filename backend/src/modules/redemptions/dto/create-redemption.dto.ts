import { IsUUID } from 'class-validator';

/** POST /api/redemptions (JWT). */
export class CreateRedemptionDto {
  @IsUUID()
  gift_card_id!: string;
}
