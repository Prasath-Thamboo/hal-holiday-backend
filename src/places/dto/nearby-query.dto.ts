import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlaceCategory } from '../../common/enums/place-category.enum';
import { PlaceType } from '../../common/enums/place-type.enum';

export class NearbyQueryDto {
  @ApiProperty({ example: 48.8566, description: 'Latitude du point de recherche' })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 2.3522, description: 'Longitude du point de recherche' })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ example: 1000, description: 'Rayon en mètres (défaut 1000)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(50000)
  radius?: number;

  @ApiPropertyOptional({
    enum: PlaceType,
    isArray: true,
    example: ['restaurant', 'mosque'],
    description: 'Filtrer par type(s)',
  })
  @IsOptional()
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : [value],
  )
  @IsEnum(PlaceType, { each: true })
  types?: PlaceType[];

  @ApiPropertyOptional({
    enum: PlaceCategory,
    isArray: true,
    example: ['touristique', 'divertissement'],
    description: 'Filtrer les activités par sous-catégorie',
  })
  @IsOptional()
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : [value],
  )
  @IsEnum(PlaceCategory, { each: true })
  categories?: PlaceCategory[];

  @ApiPropertyOptional({
    example: 2,
    description: 'Niveau halal minimum (1–4)',
    minimum: 1,
    maximum: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  minHalal?: number;

  @ApiPropertyOptional({
    example: true,
    description: "Exclure les lieux servant de l'alcool",
  })
  @IsOptional()
  @Transform(({ value }: { value: string | boolean }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  noAlcohol?: boolean;

  @ApiPropertyOptional({ example: 'couscous', description: 'Recherche par nom ou adresse' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
