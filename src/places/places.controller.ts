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
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreatePlaceDto } from './dto/create-place.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { Place } from './entities/place.entity';
import { NearbyResult, PaginatedResult, PlacesService } from './places.service';

@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  // ── Admin routes (JWT-protected, skip throttle) ──────────────────────────

  @Post()
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un lieu (admin)' })
  @ApiCreatedResponse({ type: Place })
  create(@Body() dto: CreatePlaceDto): Promise<Place> {
    return this.placesService.create(dto);
  }

  @Patch(':id')
  @SkipThrottle()
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
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un lieu (admin)' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.placesService.remove(id);
  }

  // ── Public routes (throttled at 60 req/min by default) ───────────────────

  @Get()
  @ApiOperation({ summary: 'Lister tous les lieux (paginé)' })
  @ApiOkResponse({ description: '{ data: Place[], meta: { total, page, limit, totalPages } }' })
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResult<Place>> {
    return this.placesService.findAll(query);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Lieux publiés dans un rayon, triés par distance croissante' })
  @ApiOkResponse({ description: 'Liste des lieux avec distance_m' })
  findNearby(@Query() query: NearbyQueryDto): Promise<NearbyResult[]> {
    return this.placesService.findNearby(query);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Obtenir un lieu publié par son slug' })
  @ApiOkResponse({ type: Place })
  findBySlug(@Param('slug') slug: string): Promise<Place> {
    return this.placesService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un lieu par ID' })
  @ApiOkResponse({ type: Place })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Place> {
    return this.placesService.findOne(id);
  }
}
