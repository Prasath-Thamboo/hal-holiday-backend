import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  create(data: Pick<User, 'email' | 'passwordHash' | 'role'>): Promise<User> {
    return this.usersRepo.save(this.usersRepo.create(data));
  }

  findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    return this.usersRepo.find({
      select: { id: true, email: true, role: true, created_at: true },
      order: { created_at: 'DESC' },
    });
  }
}
