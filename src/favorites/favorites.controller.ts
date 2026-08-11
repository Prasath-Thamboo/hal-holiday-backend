import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Place } from '../places/entities/place.entity';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les lieux favoris de l\'utilisateur connecté' })
  @ApiOkResponse({ type: Place, isArray: true })
  list(@CurrentUser() user: JwtPayload): Promise<Place[]> {
    return this.favoritesService.listPlaces(user.sub);
  }

  @Get('ids')
  @ApiOperation({ summary: 'Lister les IDs des lieux favoris (léger, pour l\'état des cœurs)' })
  @ApiOkResponse({ type: String, isArray: true })
  listIds(@CurrentUser() user: JwtPayload): Promise<string[]> {
    return this.favoritesService.listIds(user.sub);
  }

  @Post(':placeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ajouter un lieu aux favoris (idempotent)' })
  @ApiNoContentResponse()
  add(
    @CurrentUser() user: JwtPayload,
    @Param('placeId', ParseUUIDPipe) placeId: string,
  ): Promise<void> {
    return this.favoritesService.add(user.sub, placeId);
  }

  @Delete(':placeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retirer un lieu des favoris (idempotent)' })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('placeId', ParseUUIDPipe) placeId: string,
  ): Promise<void> {
    return this.favoritesService.remove(user.sub, placeId);
  }
}
