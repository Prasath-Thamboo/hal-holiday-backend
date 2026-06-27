import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

// Load .env manually for CLI usage (outside NestJS DI)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USER'] ?? 'halholiday',
  password: process.env['DB_PASSWORD'] ?? 'halholiday_secret',
  database: process.env['DB_NAME'] ?? 'halholiday',
  entities: [path.join(__dirname, '../src/**/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations/*.{ts,js}')],
  synchronize: false,
  logging: false,
});
