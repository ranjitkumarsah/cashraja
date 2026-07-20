import { IsObject } from 'class-validator';

/**
 * PATCH /api/admin/config/:key (super_admin). `value` is the full replacement
 * value object for the key (small jsonb, e.g. { percent: 12, window_days: 30 }).
 * Writes are versioned — a new (key, version) row, never a mutation.
 */
export class UpdateConfigDto {
  @IsObject()
  value!: Record<string, unknown>;
}
