import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

import { AppDataSource } from '../datasource';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { User } from '../../src/users/entities/user.entity';

async function seedAdmin(): Promise<void> {
  const email = process.env['ADMIN_EMAIL'];
  const password = process.env['ADMIN_PASSWORD'];

  if (!email || !password) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  await AppDataSource.initialize();
  const usersRepo = AppDataSource.getRepository(User);

  try {
    const existing = await usersRepo.findOne({ where: { email } });

    if (existing) {
      if (existing.role === UserRole.ADMIN) {
        console.log(`Admin "${email}" already exists — nothing to do.`);
      } else {
        existing.role = UserRole.ADMIN;
        await usersRepo.save(existing);
        console.log(`User "${email}" promoted to admin.`);
      }
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await usersRepo.save(
        usersRepo.create({ email, passwordHash, role: UserRole.ADMIN }),
      );
      console.log(`Admin "${email}" created successfully.`);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

seedAdmin().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
