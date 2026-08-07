import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtPayload } from './strategies/jwt.strategy';

const SALT_ROUNDS = 10;

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {
    const raw = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
    this.refreshTtlMs = parseDurationToMs(raw);
  }

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      role: UserRole.USER,
    });

    return this.issueTokenPair(user.id, user.email, user.role);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    return this.issueTokenPair(user.id, user.email, user.role);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokens> {
    const hash = sha256(dto.refresh_token);

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash: hash, expiresAt: MoreThan(new Date()) },
      relations: ['user'],
    });
    if (!stored) throw new UnauthorizedException('Invalid or expired refresh token');

    // Rotate: delete old token before issuing new pair
    await this.refreshTokenRepo.delete(stored.id);

    const { user } = stored;
    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    return this.issueTokenPair(user.id, user.email, user.role);
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    const hash = sha256(dto.refresh_token);
    await this.refreshTokenRepo.delete({ tokenHash: hash });
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, role };
    const access_token = this.jwtService.sign(payload);

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({ userId, tokenHash, expiresAt }),
    );

    return { access_token, refresh_token: rawToken };
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d|w)$/.exec(duration);
  if (!match) throw new Error(`Invalid JWT_REFRESH_EXPIRES_IN: "${duration}"`);
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const factors: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  return n * factors[unit]!;
}
