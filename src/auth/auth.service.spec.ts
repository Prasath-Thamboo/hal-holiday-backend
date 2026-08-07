import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockRefreshTokenRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn().mockResolvedValue({}),
  create: jest.fn().mockImplementation((data: unknown) => data),
  delete: jest.fn().mockResolvedValue({}),
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let repo: ReturnType<typeof mockRefreshTokenRepo>;

  const fakeUser: User = {
    id: 'user-uuid',
    email: 'test@halholiday.fr',
    passwordHash: '$2b$10$fakeHash',
    role: UserRole.USER,
    isActive: true,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { findByEmail: jest.fn(), create: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-access-token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('30d') },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useFactory: mockRefreshTokenRepo,
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    repo = module.get(getRepositoryToken(RefreshToken));

    jest.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });

  // ── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws ConflictException when email is already taken', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue(fakeUser);
      await expect(
        service.register({ email: fakeUser.email, password: 'pass1234' }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password, creates user, and returns a token pair', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue(null);
      jest.mocked(usersService.create).mockResolvedValue(fakeUser);

      const result = await service.register({ email: fakeUser.email, password: 'pass1234' });

      expect(bcrypt.hash).toHaveBeenCalledWith('pass1234', 10);
      expect(result).toMatchObject({
        access_token: 'mock-access-token',
        refresh_token: expect.any(String) as unknown,
      });
      // Refresh token is a 64-char hex string (32 random bytes)
      expect(result.refresh_token).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UnauthorizedException when user does not exist', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue(null);
      await expect(
        service.login({ email: 'ghost@x.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue(fakeUser);
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
      await expect(
        service.login({ email: fakeUser.email, password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns a token pair on valid credentials', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue(fakeUser);
      jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await service.login({ email: fakeUser.email, password: 'correct' });

      expect(result).toMatchObject({
        access_token: 'mock-access-token',
        refresh_token: expect.any(String) as unknown,
      });
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('throws UnauthorizedException when token is unknown or expired', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.refresh({ refresh_token: 'stale-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deletes the old token (rotation) before issuing a new pair', async () => {
      repo.findOne.mockResolvedValue({ id: 'rt-id', user: fakeUser });

      const result = await service.refresh({ refresh_token: 'valid-raw-token' });

      expect(repo.delete).toHaveBeenCalledWith('rt-id');
      expect(result).toMatchObject({
        access_token: 'mock-access-token',
        refresh_token: expect.any(String) as unknown,
      });
    });

    it('issues a unique refresh token on each call (no reuse)', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 'rt-1', user: fakeUser })
        .mockResolvedValueOnce({ id: 'rt-2', user: fakeUser });

      const { refresh_token: first } = await service.refresh({ refresh_token: 'token-a' });
      const { refresh_token: second } = await service.refresh({ refresh_token: 'token-b' });

      expect(first).not.toBe(second);
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('deletes the refresh token identified by its SHA-256 hash', async () => {
      await service.logout({ refresh_token: 'raw-token-value' });

      expect(repo.delete).toHaveBeenCalledWith({
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) as unknown,
      });
    });

    it('does not throw when the token does not exist (idempotent)', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.logout({ refresh_token: 'unknown' })).resolves.toBeUndefined();
    });
  });
});
