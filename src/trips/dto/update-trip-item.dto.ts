import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateTripItemDto } from './create-trip-item.dto';

export class UpdateTripItemDto extends PartialType(CreateTripItemDto) {
  @ApiPropertyOptional({
    example: 0,
    description: 'Nouveau rang dans le créneau (0-indexé) — pour réordonner',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
