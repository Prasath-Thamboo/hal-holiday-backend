import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PlaceCategory } from '../../common/enums/place-category.enum';
import { PlaceType } from '../../common/enums/place-type.enum';

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Numéro de page (défaut : 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Résultats par page (défaut : 20, max : 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filtrer par statut publié' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({ enum: PlaceType, isArray: true, description: 'Filtrer par type(s)' })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsEnum(PlaceType, { each: true })
  types?: PlaceType[];

  @ApiPropertyOptional({ enum: PlaceCategory, isArray: true, description: 'Filtrer par sous-catégorie(s)' })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsEnum(PlaceCategory, { each: true })
  categories?: PlaceCategory[];

  @ApiPropertyOptional({ example: 'couscous', description: 'Recherche par nom ou adresse' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
