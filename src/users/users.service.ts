import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  create(data: Pick<User, 'email' | 'passwordHash' | 'role'>): Promise<User> {
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
}
