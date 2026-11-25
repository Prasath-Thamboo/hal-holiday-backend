import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaceCategoryAndOpeningHours1750000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE places
        ADD COLUMN category VARCHAR(20) NULL,
        ADD COLUMN opening_hours JSONB NULL
    `);
    await queryRunner.query(`
      ALTER TABLE places
        ADD CONSTRAINT chk_places_category
        CHECK (category IS NULL OR category IN ('touristique', 'divertissement'))
    `);
    await queryRunner.query(`
      CREATE INDEX idx_places_category ON places (category)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_places_category`);
    await queryRunner.query(`ALTER TABLE places DROP CONSTRAINT IF EXISTS chk_places_category`);
    await queryRunner.query(`
      ALTER TABLE places
        DROP COLUMN opening_hours,
        DROP COLUMN category
    `);
  }
}
