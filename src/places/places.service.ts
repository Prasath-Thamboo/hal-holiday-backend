import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePlaceDto } from './dto/create-place.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { Place } from './entities/place.entity';

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place)
    private readonly placesRepo: Repository<Place>,
  ) {}

  async create(dto: CreatePlaceDto): Promise<Place> {
    const existing = await this.placesRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" already in use`);

    // Use raw SQL so PostGIS receives ST_MakePoint instead of a raw string cast
    const rows = await this.placesRepo.query(
      `INSERT INTO places
         (type, name, slug, description, address, arrondissement, city,
          location, halal_level, serves_alcohol, prayer_room, published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
               ST_SetSRID(ST_MakePoint($8,$9), 4326)::geography,
               $10,$11,$12,$13)
       RETURNING id`,
      [
        dto.type, dto.name, dto.slug, dto.description ?? null,
        dto.address, dto.arrondissement, dto.city ?? 'Paris',
        dto.longitude, dto.latitude,
        dto.halal_level ?? null, dto.serves_alcohol ?? false,
        dto.prayer_room ?? false, dto.published ?? false,
      ],
    ) as { id: string }[];

    return this.findOne(rows[0].id);
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Place>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await this.placesRepo.findAndCount({
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<Place> {
    const place = await this.placesRepo.findOne({ where: { id } });
    if (!place) throw new NotFoundException(`Place ${id} not found`);
    return place;
  }

  async update(id: string, dto: UpdatePlaceDto): Promise<Place> {
    const place = await this.findOne(id);

    if (dto.slug && dto.slug !== place.slug) {
      const conflict = await this.placesRepo.findOne({ where: { slug: dto.slug } });
      if (conflict) throw new ConflictException(`Slug "${dto.slug}" already in use`);
    }

    const { latitude, longitude, ...scalarFields } = dto;

    // Update non-spatial columns via TypeORM
    if (Object.keys(scalarFields).length > 0) {
      await this.placesRepo.update(id, scalarFields as Partial<Place>);
    }

    // Update location via raw SQL if any coordinate provided
    if (latitude !== undefined || longitude !== undefined) {
      const raw = await this.placesRepo.query(
        `SELECT ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
         FROM places WHERE id = $1`,
        [id],
      ) as { lng: number; lat: number }[];
      const cur = raw[0];
      if (cur) {
        await this.placesRepo.query(
          `UPDATE places
           SET location = ST_SetSRID(ST_MakePoint($1,$2), 4326)::geography
           WHERE id = $3`,
          [longitude ?? cur.lng, latitude ?? cur.lat, id],
        );
      }
    }

    return this.findOne(id);
  }

  async findBySlug(slug: string): Promise<Place> {
    const place = await this.placesRepo.findOne({ where: { slug, published: true } });
    if (!place) throw new NotFoundException(`Place "${slug}" not found`);
    return place;
  }

  async remove(id: string): Promise<void> {
    const place = await this.findOne(id);
    await this.placesRepo.remove(place);
  }

  async findNearby(dto: NearbyQueryDto): Promise<NearbyResult[]> {
    const radius = dto.radius ?? 1000;

    const params: (number | string | string[])[] = [
      dto.lng,
      dto.lat,
      radius,
    ];
    let paramIndex = 4;

    let sql = `
      SELECT
        id, type, name, slug, description, address,
        arrondissement, city, halal_level,
        serves_alcohol, prayer_room, published, created_at,
        ST_X(location::geometry)              AS longitude,
        ST_Y(location::geometry)              AS latitude,
        ROUND(ST_Distance(
          location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::numeric, 1)                        AS distance_m
      FROM places
      WHERE
        published = true
        AND ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
    `;

    if (dto.types && dto.types.length > 0) {
      const placeholders = dto.types
        .map((_, i) => `$${paramIndex + i}`)
        .join(', ');
      sql += ` AND type IN (${placeholders})`;
      params.push(...dto.types);
      paramIndex += dto.types.length;
    }

    if (dto.minHalal !== undefined) {
      sql += ` AND halal_level >= $${paramIndex}`;
      params.push(dto.minHalal);
      paramIndex++;
    }

    if (dto.noAlcohol === true) {
      sql += ` AND serves_alcohol = false`;
    }

    sql += ` ORDER BY distance_m ASC`;

    return this.placesRepo.query(sql, params) as Promise<NearbyResult[]>;
  }
}

export interface NearbyResult {
  id: string;
  type: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  arrondissement: number;
  city: string;
  halal_level: number | null;
  serves_alcohol: boolean;
  prayer_room: boolean;
  published: boolean;
  created_at: string;
  latitude: number;
  longitude: number;
  distance_m: number;
}
