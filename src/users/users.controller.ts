import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'Lister tous les comptes (admin)' })
  @ApiOkResponse({ description: 'Liste des utilisateurs sans passwordHash' })
  findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    return this.usersService.findAll();
  }

  @Post()
  @SkipThrottle()
  @ApiOperation({ summary: 'Créer un compte utilisateur (admin)' })
  create(@Body() dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    return this.usersService.createByAdmin(dto);
  }

  @Patch(':id/role')
  @SkipThrottle()
  @ApiOperation({ summary: "Changer le rôle d'un utilisateur (admin)" })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<Omit<User, 'passwordHash'>> {
    if (id === currentUser.sub) {
      throw new ForbiddenException('You cannot change your own role');
    }
    return this.usersService.updateRole(id, dto.role);
  }

  @Patch(':id/status')
  @SkipThrottle()
  @ApiOperation({ summary: 'Activer/désactiver un compte (admin)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<Omit<User, 'passwordHash'>> {
    if (id === currentUser.sub) {
      throw new ForbiddenException('You cannot change your own status');
    }
    return this.usersService.setActive(id, dto.isActive);
  }
}
