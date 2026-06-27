import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    username: process.env['DB_USER'] ?? 'halholiday',
    password: process.env['DB_PASSWORD'] ?? 'halholiday_secret',
    database: process.env['DB_NAME'] ?? 'halholiday',
    entities: [path.join(__dirname, '../**/*.entity.{ts,js}')],
    migrations: [path.join(__dirname, '../../database/migrations/*.{ts,js}')],
    synchronize: false,
    logging: process.env['NODE_ENV'] === 'development',
  }),
);
