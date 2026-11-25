import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enums/user-role.enum';
import { FavoritesService } from '../favorites/favorites.service';
import { TripsService } from '../trips/trips.service';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockUsersRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn().mockImplementation((data: unknown) => Promise.resolve(data)),
  create: jest.fn().mockImplementation((data: unknown) => data),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
});

const mockFavoritesService = () => ({
  listForExport: jest.fn().mockResolvedValue([]),
});

const mockTripsService = () => ({
  listForExport: jest.fn().mockResolvedValue([]),
});

describe('UsersService', () => {
  let service: UsersService;
  let repo: ReturnType<typeof mockUsersRepo>;
  let favorites: ReturnType<typeof mockFavoritesService>;
  let trips: ReturnType<typeof mockTripsService>;

  const fakeUser: User = {
    id: 'user-uuid',
    email: 'test@halholiday.fr',
    passwordHash: '$2b$10$fakeHash',
    role: UserRole.USER,
    isActive: true,
    phoneNumber: null,
    language: 'fr',
    halalStrictnessPreference: null,
    notificationPreferences: { promos: true, planning_reminders: true, prayer_times: true },
    acceptedTermsAt: new Date(),
    acceptedPrivacyPolicyAt: new Date(),
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useFactory: mockUsersRepo },
        { provide: FavoritesService, useFactory: mockFavoritesService },
        { provide: TripsService, useFactory: mockTripsService },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
    favorites = module.get(FavoritesService);
    trips = module.get(TripsService);

    jest.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
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

  describe('updateEmail', () => {
    it('throws UnauthorizedException when the password is wrong', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
      await expect(
        service.updateEmail(fakeUser.id, 'new@halholiday.fr', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ConflictException when the new email is already taken by someone else', async () => {
      repo.findOne
        .mockResolvedValueOnce({ ...fakeUser })
        .mockResolvedValueOnce({ ...fakeUser, id: 'other-id' });
      await expect(
        service.updateEmail(fakeUser.id, 'taken@halholiday.fr', 'correct'),
      ).rejects.toThrow(ConflictException);
    });

    it('updates the email and strips the password hash', async () => {
      repo.findOne.mockResolvedValueOnce({ ...fakeUser }).mockResolvedValueOnce(null);
      const result = await service.updateEmail(fakeUser.id, 'new@halholiday.fr', 'correct');
      expect(result).toMatchObject({ email: 'new@halholiday.fr' });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('updatePassword', () => {
    it('throws UnauthorizedException when the current password is wrong', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
      await expect(
        service.updatePassword(fakeUser.id, 'wrong', 'newpassword123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('hashes and saves the new password', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      await service.updatePassword(fakeUser.id, 'correct', 'newpassword123');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('updatePhone', () => {
    it('sets the phone number and strips the password hash', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      const result = await service.updatePhone(fakeUser.id, '+33612345678');
      expect(result).toMatchObject({ phoneNumber: '+33612345678' });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('clears the phone number when given null', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser, phoneNumber: '+33612345678' });
      const result = await service.updatePhone(fakeUser.id, null);
      expect(result.phoneNumber).toBeNull();
    });
  });

  describe('updatePreferences', () => {
    it('merges notification preferences instead of overwriting them entirely', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      const result = await service.updatePreferences(fakeUser.id, {
        notificationPreferences: { promos: false },
      });
      expect(result.notificationPreferences).toMatchObject({
        promos: false,
        planning_reminders: true,
        prayer_times: true,
      });
    });

    it('updates language and halal strictness preference', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      const result = await service.updatePreferences(fakeUser.id, {
        language: 'en',
        halalStrictnessPreference: 3,
      });
      expect(result).toMatchObject({ language: 'en', halalStrictnessPreference: 3 });
    });
  });

  describe('exportData', () => {
    it('returns the profile without the password hash', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      const result = await service.exportData(fakeUser.id);
      expect(result.profile).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('exported_at');
    });

    it('includes the user favorites (RGPD portability, art. 20)', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      const favRows = [
        {
          place_id: 'place-1',
          added_at: '2026-01-02T10:00:00.000Z',
          name: 'Le Jardin de Marrakech',
          slug: 'le-jardin-de-marrakech',
          address: '14 rue des Lombards, 75004 Paris',
        },
      ];
      favorites.listForExport.mockResolvedValue(favRows);

      const result = await service.exportData(fakeUser.id);

      expect(favorites.listForExport).toHaveBeenCalledWith(fakeUser.id);
      expect(result.favorites).toEqual(favRows);
    });

    it('exports an empty favorites array when the user has none', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      favorites.listForExport.mockResolvedValue([]);

      const result = await service.exportData(fakeUser.id);

      expect(result.favorites).toEqual([]);
    });

    it('includes the user trips + planning items (RGPD portability, art. 20)', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      const tripRows = [
        {
          id: 'trip-1',
          title: 'Weekend à Paris',
          start_date: '2026-05-01',
          end_date: '2026-05-03',
          created_at: '2026-01-02T10:00:00.000Z',
          items: [
            {
              date: '2026-05-01',
              slot: 'midi',
              time: '12:30',
              position: 0,
              note: null,
              place: {
                id: 'place-1',
                name: 'Le Jardin de Marrakech',
                slug: 'le-jardin-de-marrakech',
                address: '14 rue des Lombards, 75004 Paris',
              },
            },
          ],
        },
      ];
      trips.listForExport.mockResolvedValue(tripRows);

      const result = await service.exportData(fakeUser.id);

      expect(trips.listForExport).toHaveBeenCalledWith(fakeUser.id);
      expect(result.trips).toEqual(tripRows);
    });

    it('exports an empty trips array when the user has none', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      trips.listForExport.mockResolvedValue([]);

      const result = await service.exportData(fakeUser.id);

      expect(result.trips).toEqual([]);
    });

    it('throws NotFoundException for an unknown user', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.exportData('missing-id')).rejects.toThrow(NotFoundException);
      expect(favorites.listForExport).not.toHaveBeenCalled();
      expect(trips.listForExport).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('throws UnauthorizedException when the password is wrong', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
      await expect(service.deleteAccount(fakeUser.id, 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deletes the user row on correct password', async () => {
      repo.findOne.mockResolvedValue({ ...fakeUser });
      await service.deleteAccount(fakeUser.id, 'correct');
      expect(repo.delete).toHaveBeenCalledWith(fakeUser.id);
    });
  });
});
