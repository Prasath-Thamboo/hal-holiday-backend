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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import {
  PaginatedPromotions,
  PromotionsService,
  PromotionWithPlace,
} from './promotions.service';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  // ── Public ──────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lister les promotions actives (paginé, filtrable)' })
  @ApiOkResponse({ description: '{ data: PromotionWithPlace[], meta }' })
  findActive(@Query() query: PromotionQueryDto): Promise<PaginatedPromotions> {
    return this.promotionsService.findActive(query);
  }

  // ── Admin ───────────────────────────────────────────────────────────────

  @Get('admin/list')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister toutes les promotions, inactives comprises (admin)' })
  findAllForAdmin(@Query() query: PromotionQueryDto): Promise<PaginatedPromotions> {
    return this.promotionsService.findAllForAdmin(query);
  }

  @Post()
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer une promotion (admin)' })
  @ApiCreatedResponse({ description: 'Promotion créée' })
  create(@Body() dto: CreatePromotionDto): Promise<PromotionWithPlace> {
    return this.promotionsService.create(dto);
  }

  @Patch(':id/toggle-active')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activer / désactiver une promotion (admin)' })
  toggleActive(@Param('id', ParseUUIDPipe) id: string): Promise<PromotionWithPlace> {
    return this.promotionsService.toggleActive(id);
  }

  @Patch(':id')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour une promotion (admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<PromotionWithPlace> {
    return this.promotionsService.update(id, dto);
  }

  @Delete(':id')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une promotion (admin)' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.promotionsService.remove(id);
  }

  // Placé après les routes littérales pour ne pas capter "admin".
  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une promotion' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PromotionWithPlace> {
    return this.promotionsService.findOne(id);
  }
}
