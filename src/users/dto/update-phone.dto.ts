import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdatePhoneDto {
  @ApiPropertyOptional({
    example: '+33612345678',
    description: 'Numéro au format international, ou null pour le retirer',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{6,15}$/, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber?: string | null;
}
