import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class NotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  promos?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  planning_reminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  prayer_times?: boolean;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: ['fr', 'en'], example: 'fr' })
  @IsOptional()
  @IsIn(['fr', 'en'])
  language?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 4,
    description: 'Rigueur halal préférée par défaut (1-4), utilisée comme filtre par défaut sur la carte',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  halalStrictnessPreference?: number;

  @ApiPropertyOptional({ type: NotificationPreferencesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;
}
