import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from '../places/entities/place.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { Promotion } from './entities/promotion.entity';

export interface PromotionPlaceInfo {
  id: string;
  name: string;
  slug: string;
  type: string;
  arrondissement: number;
  address: string;
}

export interface PromotionWithPlace {
  id: string;
  placeId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startDate: string;
  endDate: string;
  code: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  place: PromotionPlaceInfo;
}

export interface PaginatedPromotions {
  data: PromotionWithPlace[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const SELECT_COLS = `
  pr.id,
  pr.place_id        AS "placeId",
  pr.title,
  pr.description,
  pr.image_url       AS "imageUrl",
  pr.start_date      AS "startDate",
  pr.end_date        AS "endDate",
  pr.code,
  pr.active,
  pr.created_at      AS "createdAt",
  pr.updated_at      AS "updatedAt",
  p.id              AS p_id,
  p.name            AS p_name,
  p.slug            AS p_slug,
  p.type            AS p_type,
  p.arrondissement  AS p_arr,
  p.address         AS p_address
`;

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promosRepo: Repository<Promotion>,
    @InjectRepository(Place)
    private readonly placesRepo: Repository<Place>,
  ) {}

  // ── Public ──────────────────────────────────────────────────────────────

  /** Promos actives, dans leur fenêtre de validité, sur un lieu publié. */
  async findActive(query: PromotionQueryDto): Promise<PaginatedPromotions> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filters: string[] = [
      `pr.active = true`,
      `CURRENT_DATE BETWEEN pr.start_date AND pr.end_date`,
      `p.published = true`,
    ];
    const params: (number | string)[] = [];
    if (query.arrondissement !== undefined) {
      params.push(query.arrondissement);
      filters.push(`p.arrondissement = $${params.length}`);
    }
    if (query.type !== undefined) {
      params.push(query.type);
      filters.push(`p.type = $${params.length}`);
    }
    const where = filters.join(' AND ');

    const countRows = (await this.promosRepo.query(
      `SELECT COUNT(*)::int AS total
       FROM promotions pr JOIN places p ON p.id = pr.place_id
       WHERE ${where}`,
      params,
    )) as { total: number }[];
    const total = countRows[0]?.total ?? 0;

    const rows = (await this.promosRepo.query(
      `SELECT ${SELECT_COLS}
       FROM promotions pr JOIN places p ON p.id = pr.place_id
       WHERE ${where}
       ORDER BY pr.end_date ASC, pr.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    )) as RawPromotionRow[];

    return {
      data: rows.map(mapRow),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOne(id: string): Promise<PromotionWithPlace> {
    const rows = (await this.promosRepo.query(
      `SELECT ${SELECT_COLS}
       FROM promotions pr JOIN places p ON p.id = pr.place_id
       WHERE pr.id = $1`,
      [id],
    )) as RawPromotionRow[];
    if (!rows.length) throw new NotFoundException(`Promotion ${id} not found`);
    return mapRow(rows[0]);
  }

  // ── Admin ───────────────────────────────────────────────────────────────

  /** Toutes les promos (inactives / expirées comprises), pour le back-office. */
  async findAllForAdmin(query: PromotionQueryDto): Promise<PaginatedPromotions> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const countRows = (await this.promosRepo.query(
      `SELECT COUNT(*)::int AS total FROM promotions`,
    )) as { total: number }[];
    const total = countRows[0]?.total ?? 0;

    const rows = (await this.promosRepo.query(
      `SELECT ${SELECT_COLS}
       FROM promotions pr JOIN places p ON p.id = pr.place_id
       ORDER BY pr.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, (page - 1) * limit],
    )) as RawPromotionRow[];

    return {
      data: rows.map(mapRow),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async create(dto: CreatePromotionDto): Promise<PromotionWithPlace> {
    this.assertDates(dto.startDate, dto.endDate);
    await this.assertPlaceExists(dto.placeId);

    const saved = await this.promosRepo.save(
      this.promosRepo.create({
        placeId: dto.placeId,
        title: dto.title.trim(),
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        code: dto.code ?? null,
        active: dto.active ?? true,
      }),
    );
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdatePromotionDto): Promise<PromotionWithPlace> {
    const promo = await this.promosRepo.findOne({ where: { id } });
    if (!promo) throw new NotFoundException(`Promotion ${id} not found`);

    const startDate = dto.startDate ?? promo.startDate;
    const endDate = dto.endDate ?? promo.endDate;
    if (dto.startDate || dto.endDate) this.assertDates(startDate, endDate);
    if (dto.placeId && dto.placeId !== promo.placeId) {
      await this.assertPlaceExists(dto.placeId);
    }

    await this.promosRepo.update(id, {
      ...(dto.placeId !== undefined && { placeId: dto.placeId }),
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description ?? null }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl ?? null }),
      ...(dto.startDate !== undefined && { startDate }),
      ...(dto.endDate !== undefined && { endDate }),
      ...(dto.code !== undefined && { code: dto.code ?? null }),
      ...(dto.active !== undefined && { active: dto.active }),
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.promosRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException(`Promotion ${id} not found`);
  }

  async toggleActive(id: string): Promise<PromotionWithPlace> {
    const promo = await this.promosRepo.findOne({ where: { id } });
    if (!promo) throw new NotFoundException(`Promotion ${id} not found`);
    await this.promosRepo.update(id, { active: !promo.active });
    return this.findOne(id);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private assertDates(startDate: string, endDate: string): void {
    const start = Date.parse(`${startDate}T00:00:00Z`);
    const end = Date.parse(`${endDate}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new BadRequestException('Dates invalides');
    }
    if (end < start) {
      throw new BadRequestException('endDate doit être ≥ startDate');
    }
  }

  private async assertPlaceExists(placeId: string): Promise<void> {
    const place = await this.placesRepo.findOne({ where: { id: placeId } });
    if (!place) throw new NotFoundException(`Place ${placeId} not found`);
  }
}

interface RawPromotionRow {
  id: string;
  placeId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startDate: string;
  endDate: string;
  code: string | null;
  active: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  p_id: string;
  p_name: string;
  p_slug: string;
  p_type: string;
  p_arr: number;
  p_address: string;
}

function mapRow(r: RawPromotionRow): PromotionWithPlace {
  return {
    id: r.id,
    placeId: r.placeId,
    title: r.title,
    description: r.description,
    imageUrl: r.imageUrl,
    startDate: r.startDate,
    endDate: r.endDate,
    code: r.code,
    active: r.active,
    createdAt: String(r.createdAt),
    updatedAt: String(r.updatedAt),
    place: {
      id: r.p_id,
      name: r.p_name,
      slug: r.p_slug,
      type: r.p_type,
      arrondissement: r.p_arr,
      address: r.p_address,
    },
  };
}
