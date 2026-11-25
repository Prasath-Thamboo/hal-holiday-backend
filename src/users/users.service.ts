import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { FavoritesService } from '../favorites/favorites.service';
import { TripsService } from '../trips/trips.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { User } from './entities/user.entity';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly favoritesService: FavoritesService,
    private readonly tripsService: TripsService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  create(
    data: Pick<User, 'email' | 'passwordHash' | 'role'> &
      Partial<Pick<User, 'acceptedTermsAt' | 'acceptedPrivacyPolicyAt'>>,
  ): Promise<User> {
    return this.usersRepo.save(this.usersRepo.create(data));
  }

  async createByAdmin(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.create({
      email: dto.email,
      passwordHash,
      role: dto.role ?? UserRole.USER,
    });
    const { passwordHash: _omit, ...rest } = user;
    return rest;
  }

  async updateRole(id: string, role: UserRole): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findByIdOrThrow(id);
    user.role = role;
    const saved = await this.usersRepo.save(user);
    const { passwordHash: _omit, ...rest } = saved;
    return rest;
  }

  async setActive(id: string, isActive: boolean): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findByIdOrThrow(id);
    user.isActive = isActive;
    const saved = await this.usersRepo.save(user);
    const { passwordHash: _omit, ...rest } = saved;
    return rest;
  }

  findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    return this.usersRepo.find({
      select: { id: true, email: true, role: true, isActive: true, created_at: true },
      order: { created_at: 'DESC' },
    });
  }

  // ── Compte (self-service) ─────────────────────────────────────────────────

  private async verifyPassword(user: User, password: string): Promise<void> {
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Mot de passe incorrect');
  }

  async updateEmail(
    userId: string,
    newEmail: string,
    password: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findByIdOrThrow(userId);
    await this.verifyPassword(user, password);

    if (newEmail !== user.email) {
      const existing = await this.findByEmail(newEmail);
      if (existing) throw new ConflictException('Email already in use');
    }

    user.email = newEmail;
    const saved = await this.usersRepo.save(user);
    const { passwordHash: _omit, ...rest } = saved;
    return rest;
  }

  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    await this.verifyPassword(user, currentPassword);

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.usersRepo.save(user);
  }

  async updatePhone(
    userId: string,
    phoneNumber: string | null | undefined,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findByIdOrThrow(userId);
    user.phoneNumber = phoneNumber ?? null;
    const saved = await this.usersRepo.save(user);
    const { passwordHash: _omit, ...rest } = saved;
    return rest;
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findByIdOrThrow(userId);

    if (dto.language !== undefined) user.language = dto.language;
    if (dto.halalStrictnessPreference !== undefined) {
      user.halalStrictnessPreference = dto.halalStrictnessPreference;
    }
    if (dto.notificationPreferences !== undefined) {
      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...dto.notificationPreferences,
      };
    }

    const saved = await this.usersRepo.save(user);
    const { passwordHash: _omit, ...rest } = saved;
    return rest;
  }

  /**
   * Export RGPD (art. 20) : instantané des données personnelles du compte.
   * `profile` inclut les préférences (langue, rigueur halal, notifications,
   * consentements) ; `favorites` et `trips` (séjours + items de planning)
   * couvrent les données créées par l'utilisateur.
   */
  async exportData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.findByIdOrThrow(userId);
    const { passwordHash: _omit, ...profile } = user;
    const [favorites, trips] = await Promise.all([
      this.favoritesService.listForExport(userId),
      this.tripsService.listForExport(userId),
    ]);
    return {
      exported_at: new Date().toISOString(),
      profile,
      favorites,
      trips,
    };
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    await this.verifyPassword(user, password);
    // Suppression définitive : les données liées (favoris, séjours + items de
    // planning) sont retirées en cascade via les FK ON DELETE CASCADE.
    await this.usersRepo.delete(user.id);
  }
}
