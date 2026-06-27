import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlaceType } from '../../common/enums/place-type.enum';

export class CreatePlaceDto {
  @ApiProperty({ enum: PlaceType, example: PlaceType.RESTAURANT })
  @IsEnum(PlaceType)
  type!: PlaceType;

  @ApiProperty({ example: 'Le Jardin de Marrakech' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'le-jardin-de-marrakech' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  slug!: string;

  @ApiPropertyOptional({ example: 'Un restaurant marocain halal certifié.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '12 rue de la Paix, 75002 Paris' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @ApiProperty({ example: 2, description: 'Numéro arrondissement (1–20)' })
  @IsInt()
  @Min(1)
  @Max(20)
  arrondissement!: number;

  @ApiPropertyOptional({ example: 'Paris' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ example: 48.8698, description: 'Latitude WGS84' })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 2.3309, description: 'Longitude WGS84' })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({
    example: 3,
    description: '1 = déclaratif, 2 = mosquée validée, 3 = certifié, 4 = 100% halal',
    minimum: 1,
    maximum: 4,
  })
  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(1)
  @Max(4)
  halal_level?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  serves_alcohol?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  prayer_room?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
