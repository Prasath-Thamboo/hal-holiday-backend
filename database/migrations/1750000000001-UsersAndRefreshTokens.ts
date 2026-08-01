import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersAndRefreshTokens1750000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS user_role AS ENUM ('user', 'admin')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        email         VARCHAR(255)  NOT NULL UNIQUE,
        password_hash VARCHAR(60)   NOT NULL,
        role          user_role     NOT NULL DEFAULT 'user',
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  VARCHAR(64)   NOT NULL,
        expires_at  TIMESTAMPTZ   NOT NULL,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_refresh_tokens_token_hash ON refresh_tokens (token_hash)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role`);
  }
}
