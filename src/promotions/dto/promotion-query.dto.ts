import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PlaceType } from '../../common/enums/place-type.enum';

export class PromotionQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Numéro de page (défaut : 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Par page (défaut : 20, max : 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 11, description: 'Filtrer par arrondissement du lieu' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  arrondissement?: number;

  @ApiPropertyOptional({ enum: PlaceType, description: 'Filtrer par type de lieu' })
  @IsOptional()
  @IsEnum(PlaceType)
  type?: PlaceType;
}
