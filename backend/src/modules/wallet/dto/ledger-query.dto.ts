import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { LEDGER_PAGE_MAX_LIMIT } from '../wallet.service';

/** GET /api/wallet/ledger?cursor=&limit= (whitelist: every field declared). */
export class LedgerQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LEDGER_PAGE_MAX_LIMIT)
  limit?: number;
}
