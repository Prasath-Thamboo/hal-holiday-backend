import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsers1750000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE user_role AS ENUM ('admin', 'user')
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        email         VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(60)  NOT NULL,
        role          user_role    NOT NULL DEFAULT 'user',
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role`);
  }
}
