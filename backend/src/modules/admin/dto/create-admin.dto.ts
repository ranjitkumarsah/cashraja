import { AdminRole } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';

/** POST /api/admin/admins (super_admin) — creates with a temp password. */
export class CreateAdminDto {
  @IsEmail()
  email!: string;

  @IsEnum(AdminRole)
  role!: AdminRole;
}
