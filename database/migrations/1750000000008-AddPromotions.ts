import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotions1750000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE promotions (
        id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        place_id    UUID          NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        title       VARCHAR(120)  NOT NULL,
        description TEXT          NULL,
        image_url   VARCHAR(1000) NULL,
        start_date  DATE          NOT NULL,
        end_date    DATE          NOT NULL,
        code        VARCHAR(40)   NULL,
        active      BOOLEAN       NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT chk_promotions_dates CHECK (end_date >= start_date)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_promotions_place_id ON promotions (place_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_promotions_active_window ON promotions (active, start_date, end_date)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS promotions`);
  }
}
