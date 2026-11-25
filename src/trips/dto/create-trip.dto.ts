import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateTripDto {
  @ApiProperty({ example: 'Week-end à Paris' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ example: '2026-05-01', description: 'Date de début (YYYY-MM-DD)' })
  @Matches(DATE_RE, { message: 'startDate doit être au format YYYY-MM-DD' })
  startDate!: string;

  @ApiProperty({ example: '2026-05-04', description: 'Date de fin (YYYY-MM-DD), ≥ startDate' })
  @Matches(DATE_RE, { message: 'endDate doit être au format YYYY-MM-DD' })
  endDate!: string;
}
