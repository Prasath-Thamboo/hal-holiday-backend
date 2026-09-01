import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

/**
 * Gestion du compte de l'utilisateur connecté (onglet Profil) : email,
 * mot de passe, téléphone, préférences, export et suppression RGPD.
 * Séparé de UsersController (réservé aux admins) car ces routes ne
 * requièrent que d'être authentifié, pas d'avoir le rôle admin.
 */
@ApiTags('users-me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('email')
  @ApiOperation({ summary: "Changer l'email du compte (ré-authentification par mot de passe)" })
  @ApiOkResponse({ description: 'Utilisateur mis à jour, sans passwordHash' })
  updateEmail(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateEmailDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    return this.usersService.updateEmail(user.sub, dto.newEmail, dto.password);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Changer le mot de passe (ancien mot de passe requis)' })
  updatePassword(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePasswordDto): Promise<void> {
    return this.usersService.updatePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  @Patch('phone')
  @ApiOperation({ summary: 'Changer (ou retirer) le numéro de téléphone' })
  @ApiOkResponse({ description: 'Utilisateur mis à jour, sans passwordHash' })
  updatePhone(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePhoneDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    return this.usersService.updatePhone(user.sub, dto.phoneNumber);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Mettre à jour les préférences (langue, rigueur halal, notifications)' })
  @ApiOkResponse({ description: 'Utilisateur mis à jour, sans passwordHash' })
  updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    return this.usersService.updatePreferences(user.sub, dto);
  }

  @Get('export')
  @ApiOperation({ summary: 'Exporter mes données personnelles (droit à la portabilité, art. 20 RGPD)' })
  @ApiOkResponse({ description: 'Export JSON des données personnelles du compte' })
  exportData(@CurrentUser() user: JwtPayload): Promise<Record<string, unknown>> {
    return this.usersService.exportData(user.sub);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer définitivement mon compte et mes données (mot de passe requis)' })
  deleteAccount(@CurrentUser() user: JwtPayload, @Body() dto: DeleteAccountDto): Promise<void> {
    return this.usersService.deleteAccount(user.sub, dto.password);
  }
}
