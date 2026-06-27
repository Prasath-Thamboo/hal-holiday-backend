import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreatePlaceDto } from './dto/create-place.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { Place } from './entities/place.entity';
import { NearbyResult, PlacesService } from './places.service';

@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un lieu (admin)' })
  @ApiCreatedResponse({ type: Place })
  create(@Body() dto: CreatePlaceDto): Promise<Place> {
    return this.placesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les lieux' })
  @ApiOkResponse({ type: [Place] })
  findAll(): Promise<Place[]> {
    return this.placesService.findAll();
  }

  @Get('nearby')
  @ApiOperation({
    summary: 'Lieux publiés dans un rayon, triés par distance croissante',
  })
  @ApiOkResponse({ description: 'Liste des lieux avec distance_m' })
  findNearby(@Query() query: NearbyQueryDto): Promise<NearbyResult[]> {
    return this.placesService.findNearby(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un lieu par ID' })
  @ApiOkResponse({ type: Place })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Place> {
    return this.placesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour un lieu (admin)' })
  @ApiOkResponse({ type: Place })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlaceDto,
  ): Promise<Place> {
    return this.placesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un lieu (admin)' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.placesService.remove(id);
  }
}
