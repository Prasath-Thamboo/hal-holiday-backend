import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1750000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostGIS extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    // Enum type
    await queryRunner.query(`
      CREATE TYPE place_type AS ENUM ('restaurant', 'mosque', 'activity')
    `);

    // Places table
    await queryRunner.query(`
      CREATE TABLE places (
        id            UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
        type          place_type              NOT NULL,
        name          VARCHAR(255)            NOT NULL,
        slug          VARCHAR(255)            NOT NULL UNIQUE,
        description   TEXT,
        address       VARCHAR(500)            NOT NULL,
        arrondissement SMALLINT              NOT NULL,
        city          VARCHAR(100)            NOT NULL DEFAULT 'Paris',
        location      geography(Point, 4326)  NOT NULL,
        halal_level   SMALLINT               CHECK (halal_level BETWEEN 1 AND 4),
        serves_alcohol BOOLEAN               NOT NULL DEFAULT false,
        prayer_room   BOOLEAN                NOT NULL DEFAULT false,
        published     BOOLEAN                NOT NULL DEFAULT false,
        created_at    TIMESTAMPTZ            NOT NULL DEFAULT now()
      )
    `);

    // GIST index on location for ST_DWithin / ST_Distance
    await queryRunner.query(`
      CREATE INDEX idx_places_location_gist ON places USING GIST (location)
    `);

    // BTree index on arrondissement for filtering
    await queryRunner.query(`
      CREATE INDEX idx_places_arrondissement ON places (arrondissement)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS places`);
    await queryRunner.query(`DROP TYPE IF EXISTS place_type`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS postgis`);
  }
}
