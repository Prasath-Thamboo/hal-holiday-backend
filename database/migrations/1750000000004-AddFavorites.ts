import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFavorites1750000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE favorites (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        place_id    UUID         NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        UNIQUE (user_id, place_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_favorites_user_id ON favorites (user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS favorites`);
  }
}
