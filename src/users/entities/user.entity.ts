import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';

export interface NotificationPreferences {
  promos: boolean;
  planning_reminders: boolean;
  prayer_times: boolean;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', length: 60 })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role', default: UserRole.USER })
  role!: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'phone_number', length: 20, nullable: true })
  phoneNumber!: string | null;

  @Column({ length: 5, default: 'fr' })
  language!: string;

  @Column({ name: 'halal_strictness_preference', type: 'smallint', nullable: true })
  halalStrictnessPreference!: number | null;

  @Column({
    name: 'notification_preferences',
    type: 'jsonb',
    default: { promos: true, planning_reminders: true, prayer_times: true },
  })
  notificationPreferences!: NotificationPreferences;

  @Column({ name: 'accepted_terms_at', type: 'timestamptz', nullable: true })
  acceptedTermsAt!: Date | null;

  @Column({ name: 'accepted_privacy_policy_at', type: 'timestamptz', nullable: true })
  acceptedPrivacyPolicyAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
