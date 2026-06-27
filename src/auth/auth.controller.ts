import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService, AuthTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

// Tighter throttle on auth routes: 10 requests / minute per IP
const AUTH_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

const TOKEN_EXAMPLE = { access_token: 'eyJ...', refresh_token: 'a1b2c3...' };

@ApiTags('auth')
@Throttle(AUTH_THROTTLE)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Créer un compte utilisateur' })
  @ApiCreatedResponse({ schema: { example: TOKEN_EXAMPLE } })
  register(@Body() dto: RegisterDto): Promise<AuthTokens> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Se connecter et obtenir des tokens JWT' })
  @ApiOkResponse({ schema: { example: TOKEN_EXAMPLE } })
  login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtenir un nouveau pair de tokens via refresh token' })
  @ApiOkResponse({ schema: { example: TOKEN_EXAMPLE } })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Révoquer le refresh token (déconnexion)' })
  @ApiNoContentResponse()
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(dto);
  }
}
