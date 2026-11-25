import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TRIP_SLOT_ORDER, TripSlot } from '../common/enums/trip-slot.enum';
import { Place } from '../places/entities/place.entity';
import { CreateTripItemDto } from './dto/create-trip-item.dto';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripItemDto } from './dto/update-trip-item.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Trip } from './entities/trip.entity';
import { TripItem } from './entities/trip-item.entity';

const MAX_TRIP_DAYS = 90;

export interface TripItemPlace {
  id: string;
  name: string;
  slug: string;
  type: string;
  address: string;
  category: string | null;
  latitude: number;
  longitude: number;
}

export interface TripItemWithPlace {
  id: string;
  tripId: string;
  date: string;
  slot: TripSlot;
  time: string | null;
  position: number;
  note: string | null;
  place: TripItemPlace;
}

export interface TripDay {
  date: string;
  items: TripItemWithPlace[];
}

export interface TripDetail {
  trip: Trip;
  days: TripDay[];
}

export interface TripSummary extends Trip {
  dayCount: number;
  itemCount: number;
}

export interface TripExportItem {
  date: string;
  slot: TripSlot;
  time: string | null;
  position: number;
  note: string | null;
  place: {
    id: string;
    name: string | null;
    slug: string | null;
    address: string | null;
  };
}

export interface TripExportRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_at: string;
  items: TripExportItem[];
}

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(TripItem)
    private readonly itemsRepo: Repository<TripItem>,
    @InjectRepository(Place)
    private readonly placesRepo: Repository<Place>,
  ) {}

  // ── Séjours ─────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateTripDto): Promise<Trip> {
    this.assertRange(dto.startDate, dto.endDate);
    return this.tripsRepo.save(
      this.tripsRepo.create({
        userId,
        title: dto.title.trim(),
        startDate: dto.startDate,
        endDate: dto.endDate,
      }),
    );
  }

  async list(userId: string): Promise<TripSummary[]> {
    const trips = await this.tripsRepo.find({
      where: { userId },
      order: { startDate: 'ASC', createdAt: 'ASC' },
    });
    if (trips.length === 0) return [];

    const counts = (await this.itemsRepo
      .createQueryBuilder('i')
      .select('i.trip_id', 'tripId')
      .addSelect('COUNT(*)', 'count')
      .where('i.trip_id IN (:...ids)', { ids: trips.map((t) => t.id) })
      .groupBy('i.trip_id')
      .getRawMany()) as { tripId: string; count: string }[];

    const countByTrip = new Map(counts.map((c) => [c.tripId, Number(c.count)]));

    return trips.map((trip) => ({
      ...trip,
      dayCount: this.enumerateDates(trip.startDate, trip.endDate).length,
      itemCount: countByTrip.get(trip.id) ?? 0,
    }));
  }

  async findOne(userId: string, tripId: string): Promise<TripDetail> {
    const trip = await this.getOwnedTrip(userId, tripId);
    const items = await this.loadItems(tripId);

    const byDate = new Map<string, TripItemWithPlace[]>();
    for (const item of items) {
      const bucket = byDate.get(item.date) ?? [];
      bucket.push(item);
      byDate.set(item.date, bucket);
    }

    const days: TripDay[] = this.enumerateDates(trip.startDate, trip.endDate).map(
      (date) => ({
        date,
        items: (byDate.get(date) ?? []).sort(compareItems),
      }),
    );

    return { trip, days };
  }

  async update(userId: string, tripId: string, dto: UpdateTripDto): Promise<Trip> {
    const trip = await this.getOwnedTrip(userId, tripId);

    const startDate = dto.startDate ?? trip.startDate;
    const endDate = dto.endDate ?? trip.endDate;
    if (dto.startDate || dto.endDate) this.assertRange(startDate, endDate);

    if (dto.title !== undefined) trip.title = dto.title.trim();
    trip.startDate = startDate;
    trip.endDate = endDate;
    const saved = await this.tripsRepo.save(trip);

    // Retire les lieux qui tombent hors de la nouvelle plage de dates.
    await this.itemsRepo
      .createQueryBuilder()
      .delete()
      .where('trip_id = :tripId', { tripId })
      .andWhere('(date < :startDate OR date > :endDate)', { startDate, endDate })
      .execute();

    return saved;
  }

  async remove(userId: string, tripId: string): Promise<void> {
    await this.getOwnedTrip(userId, tripId);
    await this.tripsRepo.delete(tripId); // cascade → trip_items
  }

  // ── Items ───────────────────────────────────────────────────────────────

  async addItem(
    userId: string,
    tripId: string,
    dto: CreateTripItemDto,
  ): Promise<TripItemWithPlace> {
    const trip = await this.getOwnedTrip(userId, tripId);
    this.assertDateWithin(dto.date, trip);

    const place = await this.placesRepo.findOne({ where: { id: dto.placeId } });
    if (!place) throw new NotFoundException(`Place ${dto.placeId} not found`);

    const last = await this.itemsRepo.findOne({
      where: { tripId, date: dto.date, slot: dto.slot },
      order: { position: 'DESC' },
    });

    const item = await this.itemsRepo.save(
      this.itemsRepo.create({
        tripId,
        placeId: dto.placeId,
        date: dto.date,
        slot: dto.slot,
        time: dto.time ?? null,
        note: dto.note ?? null,
        position: last ? last.position + 1 : 0,
      }),
    );

    const [withPlace] = await this.loadItems(tripId, item.id);
    return withPlace;
  }

  async updateItem(
    userId: string,
    tripId: string,
    itemId: string,
    dto: UpdateTripItemDto,
  ): Promise<TripItemWithPlace> {
    const trip = await this.getOwnedTrip(userId, tripId);
    const item = await this.itemsRepo.findOne({ where: { id: itemId } });
    if (!item || item.tripId !== tripId) {
      throw new NotFoundException(`Trip item ${itemId} not found`);
    }

    const oldGroup = { date: item.date, slot: item.slot };
    const targetDate = dto.date ?? item.date;
    const targetSlot = dto.slot ?? item.slot;
    if (dto.date) this.assertDateWithin(targetDate, trip);

    if (dto.placeId) {
      const place = await this.placesRepo.findOne({ where: { id: dto.placeId } });
      if (!place) throw new NotFoundException(`Place ${dto.placeId} not found`);
      item.placeId = dto.placeId;
    }
    if (dto.time !== undefined) item.time = dto.time ?? null;
    if (dto.note !== undefined) item.note = dto.note ?? null;

    const groupChanged =
      targetDate !== oldGroup.date || targetSlot !== oldGroup.slot;

    if (groupChanged) {
      item.date = targetDate;
      item.slot = targetSlot;
      item.position = await this.nextPosition(tripId, targetDate, targetSlot);
      await this.itemsRepo.save(item);
      await this.renormalize(tripId, oldGroup.date, oldGroup.slot);
      if (dto.position !== undefined) {
        await this.moveWithinGroup(tripId, targetDate, targetSlot, itemId, dto.position);
      }
    } else {
      await this.itemsRepo.save(item);
      if (dto.position !== undefined) {
        await this.moveWithinGroup(tripId, targetDate, targetSlot, itemId, dto.position);
      }
    }

    const [withPlace] = await this.loadItems(tripId, itemId);
    return withPlace;
  }

  async removeItem(userId: string, tripId: string, itemId: string): Promise<void> {
    await this.getOwnedTrip(userId, tripId);
    const item = await this.itemsRepo.findOne({ where: { id: itemId } });
    if (!item || item.tripId !== tripId) {
      throw new NotFoundException(`Trip item ${itemId} not found`);
    }
    await this.itemsRepo.delete(itemId);
    await this.renormalize(tripId, item.date, item.slot);
  }

  /**
   * Séjours de l'utilisateur au format export RGPD (art. 20) : tous les
   * séjours avec leurs items (créneau, heure, note) et un instantané minimal
   * du lieu associé. `LEFT JOIN` par prudence même si la FK `trip_items →
   * places` est `ON DELETE CASCADE`.
   */
  async listForExport(userId: string): Promise<TripExportRow[]> {
    const trips = (await this.tripsRepo.query(
      `SELECT id, title, start_date, end_date, created_at
       FROM trips
       WHERE user_id = $1
       ORDER BY start_date ASC, created_at ASC`,
      [userId],
    )) as {
      id: string;
      title: string;
      start_date: string | Date;
      end_date: string | Date;
      created_at: string | Date;
    }[];
    if (trips.length === 0) return [];

    const tripIds = trips.map((t) => t.id);
    const rows = (await this.itemsRepo.query(
      `SELECT
         i.trip_id, i.date, i.slot, i.time, i.position, i.note,
         p.id AS p_id, p.name AS p_name, p.slug AS p_slug, p.address AS p_address
       FROM trip_items i
       LEFT JOIN places p ON p.id = i.place_id
       WHERE i.trip_id IN (${tripIds.map((_, idx) => `$${idx + 1}`).join(', ')})
       ORDER BY i.date ASC, i.position ASC`,
      tripIds,
    )) as RawTripExportItemRow[];

    const itemsByTrip = new Map<string, TripExportItem[]>();
    for (const r of rows) {
      const bucket = itemsByTrip.get(r.trip_id) ?? [];
      bucket.push({
        date: formatDate(r.date),
        slot: r.slot as TripSlot,
        time: r.time,
        position: r.position,
        note: r.note,
        place: {
          id: r.p_id,
          name: r.p_name,
          slug: r.p_slug,
          address: r.p_address,
        },
      });
      itemsByTrip.set(r.trip_id, bucket);
    }

    return trips.map((t) => ({
      id: t.id,
      title: t.title,
      start_date: formatDate(t.start_date),
      end_date: formatDate(t.end_date),
      created_at:
        t.created_at instanceof Date ? t.created_at.toISOString() : t.created_at,
      items: itemsByTrip.get(t.id) ?? [],
    }));
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async getOwnedTrip(userId: string, tripId: string): Promise<Trip> {
    const trip = await this.tripsRepo.findOne({ where: { id: tripId } });
    if (!trip || trip.userId !== userId) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
    return trip;
  }

  private assertRange(startDate: string, endDate: string): void {
    const start = Date.parse(`${startDate}T00:00:00Z`);
    const end = Date.parse(`${endDate}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new BadRequestException('Dates invalides');
    }
    if (end < start) {
      throw new BadRequestException('endDate doit être ≥ startDate');
    }
    const days = Math.round((end - start) / 86_400_000) + 1;
    if (days > MAX_TRIP_DAYS) {
      throw new BadRequestException(`Un séjour ne peut dépasser ${MAX_TRIP_DAYS} jours`);
    }
  }

  private assertDateWithin(date: string, trip: Trip): void {
    if (date < trip.startDate || date > trip.endDate) {
      throw new BadRequestException(
        `La date ${date} est hors du séjour (${trip.startDate} → ${trip.endDate})`,
      );
    }
  }

  private enumerateDates(startDate: string, endDate: string): string[] {
    const out: string[] = [];
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    while (cursor <= end) {
      out.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
  }

  private async nextPosition(
    tripId: string,
    date: string,
    slot: TripSlot,
  ): Promise<number> {
    const last = await this.itemsRepo.findOne({
      where: { tripId, date, slot },
      order: { position: 'DESC' },
    });
    return last ? last.position + 1 : 0;
  }

  private async renormalize(
    tripId: string,
    date: string,
    slot: TripSlot,
  ): Promise<void> {
    const rows = await this.itemsRepo.find({
      where: { tripId, date, slot },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    await Promise.all(
      rows.map((row, i) =>
        row.position === i ? undefined : this.itemsRepo.update(row.id, { position: i }),
      ),
    );
  }

  private async moveWithinGroup(
    tripId: string,
    date: string,
    slot: TripSlot,
    itemId: string,
    targetIndex: number,
  ): Promise<void> {
    const rows = await this.itemsRepo.find({
      where: { tripId, date, slot },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    const from = rows.findIndex((r) => r.id === itemId);
    if (from === -1) return;
    const [moved] = rows.splice(from, 1);
    rows.splice(Math.max(0, Math.min(targetIndex, rows.length)), 0, moved);
    await Promise.all(
      rows.map((row, i) =>
        row.position === i ? undefined : this.itemsRepo.update(row.id, { position: i }),
      ),
    );
  }

  private async loadItems(
    tripId: string,
    itemId?: string,
  ): Promise<TripItemWithPlace[]> {
    const params: string[] = [tripId];
    let sql = `
      SELECT
        i.id, i.trip_id, i.date, i.slot, i.time, i.position, i.note,
        p.id   AS p_id,
        p.name AS p_name,
        p.slug AS p_slug,
        p.type AS p_type,
        p.address AS p_address,
        p.category AS p_category,
        ST_Y(p.location::geometry) AS p_lat,
        ST_X(p.location::geometry) AS p_lng
      FROM trip_items i
      JOIN places p ON p.id = i.place_id
      WHERE i.trip_id = $1
    `;
    if (itemId) {
      sql += ` AND i.id = $2`;
      params.push(itemId);
    }
    sql += ` ORDER BY i.date ASC, i.position ASC`;

    const rows = (await this.itemsRepo.query(sql, params)) as RawTripItemRow[];
    return rows.map((r) => ({
      id: r.id,
      tripId: r.trip_id,
      date: formatDate(r.date),
      slot: r.slot as TripSlot,
      time: r.time,
      position: r.position,
      note: r.note,
      place: {
        id: r.p_id,
        name: r.p_name,
        slug: r.p_slug,
        type: r.p_type,
        address: r.p_address,
        category: r.p_category,
        latitude: Number(r.p_lat),
        longitude: Number(r.p_lng),
      },
    }));
  }
}

interface RawTripItemRow {
  id: string;
  trip_id: string;
  date: string | Date;
  slot: string;
  time: string | null;
  position: number;
  note: string | null;
  p_id: string;
  p_name: string;
  p_slug: string;
  p_type: string;
  p_address: string;
  p_category: string | null;
  p_lat: string;
  p_lng: string;
}

interface RawTripExportItemRow {
  trip_id: string;
  date: string | Date;
  slot: string;
  time: string | null;
  position: number;
  note: string | null;
  p_id: string;
  p_name: string | null;
  p_slug: string | null;
  p_address: string | null;
}

/** Le driver pg renvoie parfois un objet Date pour les colonnes `date`. */
function formatDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function compareItems(a: TripItemWithPlace, b: TripItemWithPlace): number {
  const slotDiff = TRIP_SLOT_ORDER[a.slot] - TRIP_SLOT_ORDER[b.slot];
  if (slotDiff !== 0) return slotDiff;
  if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
  if (a.time && !b.time) return -1;
  if (!a.time && b.time) return 1;
  return a.position - b.position;
}
