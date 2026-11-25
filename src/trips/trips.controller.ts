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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateTripItemDto } from './dto/create-trip-item.dto';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripItemDto } from './dto/update-trip-item.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Trip } from './entities/trip.entity';
import {
  TripDetail,
  TripItemWithPlace,
  TripsService,
  TripSummary,
} from './trips.service';

/**
 * Planning de séjour de l'utilisateur connecté. Toutes les routes sont
 * protégées JWT et strictement scindées par `user_id` (un utilisateur ne voit
 * et ne modifie que ses propres séjours).
 */
@ApiTags('trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un séjour' })
  @ApiCreatedResponse({ type: Trip })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTripDto): Promise<Trip> {
    return this.tripsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister mes séjours (avec nb de jours et de lieux)' })
  list(@CurrentUser() user: JwtPayload): Promise<TripSummary[]> {
    return this.tripsService.list(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un séjour : lieux groupés par jour' })
  @ApiOkResponse({ description: '{ trip, days: [{ date, items: [...] }] }' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TripDetail> {
    return this.tripsService.findOne(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un séjour (titre, dates)' })
  @ApiOkResponse({ type: Trip })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTripDto,
  ): Promise<Trip> {
    return this.tripsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un séjour et ses lieux planifiés' })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.tripsService.remove(user.sub, id);
  }

  // ── Items ───────────────────────────────────────────────────────────────

  @Post(':id/items')
  @ApiOperation({ summary: 'Ajouter un lieu à un jour/créneau du séjour' })
  addItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTripItemDto,
  ): Promise<TripItemWithPlace> {
    return this.tripsService.addItem(user.sub, id, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Modifier / déplacer / réordonner un lieu planifié' })
  updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateTripItemDto,
  ): Promise<TripItemWithPlace> {
    return this.tripsService.updateItem(user.sub, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retirer un lieu du séjour' })
  @ApiNoContentResponse()
  removeItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    return this.tripsService.removeItem(user.sub, id, itemId);
  }
}
