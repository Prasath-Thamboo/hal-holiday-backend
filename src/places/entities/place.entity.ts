import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlaceCategory } from '../../common/enums/place-category.enum';
import { PlaceType } from '../../common/enums/place-type.enum';
import { OpeningHours } from '../types/opening-hours';

@Entity('places')
export class Place {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: PlaceType, enumName: 'place_type' })
  type!: PlaceType;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 255, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 500 })
  address!: string;

  @Index('idx_places_arrondissement')
  @Column({ type: 'smallint' })
  arrondissement!: number;

  @Column({ length: 100, default: 'Paris' })
  city!: string;

  @Index('idx_places_location_gist', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: false,
  })
  location!: string;

  /**
   * Sous-catégorie, uniquement renseignée pour `type = activity`
   * (`touristique` ou `divertissement`). `null` sinon.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  category!: PlaceCategory | null;

  /** Horaires d'ouverture structurés (par jour + exceptions). `null` si inconnu. */
  @Column({ type: 'jsonb', nullable: true })
  opening_hours!: OpeningHours | null;

  @Column({ type: 'smallint', nullable: true })
  halal_level!: number | null;

  @Column({ default: false })
  serves_alcohol!: boolean;

  @Column({ default: false })
  prayer_room!: boolean;

  @Column({ default: false })
  published!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
