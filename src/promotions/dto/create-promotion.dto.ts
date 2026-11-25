import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePromotionDto {
  @ApiProperty({ description: 'Lieu partenaire associé' })
  @IsUUID()
  placeId!: string;

  @ApiProperty({ example: '-20% sur le menu du midi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: 'Sur présentation du code, du lundi au jeudi.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/promo.jpg' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  imageUrl?: string;

  @ApiProperty({ example: '2026-05-01', description: 'Début de validité (YYYY-MM-DD)' })
  @Matches(DATE_RE, { message: 'startDate doit être au format YYYY-MM-DD' })
  startDate!: string;

  @ApiProperty({ example: '2026-06-30', description: 'Fin de validité (YYYY-MM-DD), ≥ startDate' })
  @Matches(DATE_RE, { message: 'endDate doit être au format YYYY-MM-DD' })
  endDate!: string;

  @ApiPropertyOptional({ example: 'HALAL20' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
