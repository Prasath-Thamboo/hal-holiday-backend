import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TripSlot } from '../../common/enums/trip-slot.enum';

/**
 * Un lieu placé dans un séjour, sur une date + un créneau donnés.
 * `position` ordonne les items d'un même groupe (trip, date, slot).
 */
@Entity('trip_items')
@Index('idx_trip_items_trip_id', ['tripId'])
@Index('idx_trip_items_group', ['tripId', 'date', 'slot'])
export class TripItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId!: string;

  @Column({ name: 'place_id', type: 'uuid' })
  placeId!: string;

  /** Jour du séjour, `YYYY-MM-DD`. Toujours dans [trip.start_date … trip.end_date]. */
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 12 })
  slot!: TripSlot;

  /** Heure précise optionnelle, `HH:MM`. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  time!: string | null;

  /** Rang dans le groupe (trip, date, slot), 0-indexé. */
  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
