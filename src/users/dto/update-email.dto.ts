import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class UpdateEmailDto {
  @ApiProperty({ example: 'nouveau@halholiday.fr' })
  @IsEmail()
  newEmail!: string;

  @ApiProperty({ description: 'Mot de passe actuel, requis pour ré-authentification' })
  @IsString()
  @MinLength(1)
  password!: string;
}
