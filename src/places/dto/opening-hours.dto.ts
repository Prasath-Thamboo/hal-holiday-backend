import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';
import { TIME_RE } from '../types/opening-hours';

export class TimeSlotDto {
  @ApiProperty({ example: '12:00', description: 'Heure d\'ouverture, format HH:MM (24 h)' })
  @Matches(TIME_RE, { message: 'open doit être au format HH:MM' })
  open!: string;

  @ApiProperty({ example: '14:30', description: 'Heure de fermeture, format HH:MM (24 h)' })
  @Matches(TIME_RE, { message: 'close doit être au format HH:MM' })
  close!: string;
}

export class OpeningHoursExceptionDto {
  @ApiProperty({ example: '2026-12-25', description: 'Date concernée (YYYY-MM-DD)' })
  @IsISO8601()
  date!: string;

  @ApiProperty({ example: true, description: 'true = fermé toute la journée' })
  @IsBoolean()
  closed!: boolean;

  @ApiPropertyOptional({ type: [TimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  slots?: TimeSlotDto[];
}

/**
 * Horaires hebdomadaires + exceptions. Chaque jour est optionnel ;
 * absent ou tableau vide = fermé ce jour-là.
 */
export class OpeningHoursDto {
  @ApiPropertyOptional({ type: [TimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  mon?: TimeSlotDto[];

  @ApiPropertyOptional({ type: [TimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  tue?: TimeSlotDto[];

  @ApiPropertyOptional({ type: [TimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  wed?: TimeSlotDto[];

  @ApiPropertyOptional({ type: [TimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  thu?: TimeSlotDto[];

  @ApiPropertyOptional({ type: [TimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  fri?: TimeSlotDto[];

  @ApiPropertyOptional({ type: [TimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  sat?: TimeSlotDto[];

  @ApiPropertyOptional({ type: [TimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  sun?: TimeSlotDto[];

  @ApiPropertyOptional({ type: [OpeningHoursExceptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningHoursExceptionDto)
  exceptions?: OpeningHoursExceptionDto[];
}
