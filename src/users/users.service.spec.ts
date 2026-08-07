import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

const mockUsersRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn().mockImplementation((data: unknown) => Promise.resolve(data)),
  create: jest.fn().mockImplementation((data: unknown) => data),
});

describe('UsersService', () => {
  let service: UsersService;
  let repo: ReturnType<typeof mockUsersRepo>;

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
        UsersService,
        { provide: getRepositoryToken(User), useFactory: mockUsersRepo },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));

    jest.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
  });

  describe('createByAdmin', () => {
    it('throws ConflictException when email is already taken', async () => {
      repo.findOne.mockResolvedValue(fakeUser);
      await expect(
        service.createByAdmin({ email: fakeUser.email, password: 'pass1234' }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password and defaults role to USER', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.createByAdmin({
        email: 'new@halholiday.fr',
        password: 'pass1234',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('pass1234', 10);
      expect(result).toMatchObject({ email: 'new@halholiday.fr', role: UserRole.USER });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateRole', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.updateRole('missing-id', UserRole.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates the role and strips the password hash', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });

      const result = await service.updateRole(fakeUser.id, UserRole.ADMIN);

      expect(result).toMatchObject({ id: fakeUser.id, role: UserRole.ADMIN });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('setActive', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.setActive('missing-id', false)).rejects.toThrow(NotFoundException);
    });

    it('flips isActive and strips the password hash', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });

      const result = await service.setActive(fakeUser.id, false);

      expect(result).toMatchObject({ id: fakeUser.id, isActive: false });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
