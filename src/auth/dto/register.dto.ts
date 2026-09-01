import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'admin@halholiday.fr' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'motdepasse123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({
    example: true,
    description:
      "Consentement explicite aux CGU et à la politique de confidentialité (RGPD) — doit être true",
  })
  @IsBoolean()
  @Equals(true, { message: 'Vous devez accepter les CGU et la politique de confidentialité' })
  acceptedTerms!: boolean;
}
