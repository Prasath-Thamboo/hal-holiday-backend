import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAccountFields1750000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN phone_number VARCHAR(20) NULL,
        ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'fr',
        ADD COLUMN halal_strictness_preference SMALLINT NULL,
        ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{"promos": true, "planning_reminders": true, "prayer_times": true}',
        ADD COLUMN accepted_terms_at TIMESTAMPTZ NULL,
        ADD COLUMN accepted_privacy_policy_at TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN phone_number,
        DROP COLUMN language,
        DROP COLUMN halal_strictness_preference,
        DROP COLUMN notification_preferences,
        DROP COLUMN accepted_terms_at,
        DROP COLUMN accepted_privacy_policy_at
    `);
  }
}
