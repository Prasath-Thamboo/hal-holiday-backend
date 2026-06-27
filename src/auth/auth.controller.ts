import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthService, AuthTokens } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './strategies/jwt.strategy';

// Tighter throttle on auth mutation routes: 10 requests / minute per IP
const AUTH_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

const TOKEN_EXAMPLE = { access_token: 'eyJ...', refresh_token: 'a1b2c3...' };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Créer un compte utilisateur' })
  @ApiCreatedResponse({ schema: { example: TOKEN_EXAMPLE } })
  register(@Body() dto: RegisterDto): Promise<AuthTokens> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Se connecter et obtenir des tokens JWT' })
  @ApiOkResponse({ schema: { example: TOKEN_EXAMPLE } })
  login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtenir un nouveau pair de tokens via refresh token' })
  @ApiOkResponse({ schema: { example: TOKEN_EXAMPLE } })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Révoquer le refresh token (déconnexion)' })
  @ApiNoContentResponse()
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(dto);
  }

  @Get('me')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  @ApiOkResponse({
    schema: { example: { id: 'uuid...', email: 'user@halholiday.fr', role: 'user' } },
  })
  getMe(
    @CurrentUser() user: JwtPayload,
  ): { id: string; email: string; role: UserRole } {
    return { id: user.sub, email: user.email, role: user.role };
  }
}
