import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrips1750000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE trips (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title       VARCHAR(120) NOT NULL,
        start_date  DATE         NOT NULL,
        end_date    DATE         NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT chk_trips_dates CHECK (end_date >= start_date)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_trips_user_id ON trips (user_id)`);

    await queryRunner.query(`
      CREATE TABLE trip_items (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id     UUID         NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        place_id    UUID         NOT NULL REFERENCES places(id) ON DELETE CASCADE,
        date        DATE         NOT NULL,
        slot        VARCHAR(12)  NOT NULL,
        time        VARCHAR(5)   NULL,
        position    INT          NOT NULL DEFAULT 0,
        note        TEXT         NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT chk_trip_items_slot
          CHECK (slot IN ('matin', 'midi', 'apres_midi', 'soir'))
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_trip_items_trip_id ON trip_items (trip_id)`);
    await queryRunner.query(
      `CREATE INDEX idx_trip_items_group ON trip_items (trip_id, date, slot)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS trip_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS trips`);
  }
}
