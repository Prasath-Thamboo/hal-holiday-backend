import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { TripSlot } from '../../common/enums/trip-slot.enum';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateTripItemDto {
  @ApiProperty({ description: 'Lieu à planifier' })
  @IsUUID()
  placeId!: string;

  @ApiProperty({ example: '2026-05-02', description: 'Jour du séjour (YYYY-MM-DD)' })
  @Matches(DATE_RE, { message: 'date doit être au format YYYY-MM-DD' })
  date!: string;

  @ApiProperty({ enum: TripSlot, example: TripSlot.MATIN })
  @IsEnum(TripSlot)
  slot!: TripSlot;

  @ApiPropertyOptional({ example: '14:30', description: 'Heure précise (HH:MM), optionnelle' })
  @IsOptional()
  @Matches(TIME_RE, { message: 'time doit être au format HH:MM' })
  time?: string;

  @ApiPropertyOptional({ example: 'Réserver la veille', description: 'Note libre' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
