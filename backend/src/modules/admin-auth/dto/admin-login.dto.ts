import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body of POST /api/admin-auth/login. */
export class AdminLoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
