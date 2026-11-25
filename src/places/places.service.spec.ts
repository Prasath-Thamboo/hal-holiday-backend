import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlaceCategory } from '../common/enums/place-category.enum';
import { PlaceType } from '../common/enums/place-type.enum';
import { Place } from './entities/place.entity';
import { PlacesService } from './places.service';

function makeQb(result: [unknown[], number] = [[], 0]) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['orderBy', 'skip', 'take', 'andWhere']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getManyAndCount = jest.fn().mockResolvedValue(result);
  return qb;
}

const mockRepo = () => ({
  findOne: jest.fn(),
  query: jest.fn(),
  remove: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => makeQb()),
});

describe('PlacesService', () => {
  let service: PlacesService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        { provide: getRepositoryToken(Place), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(PlacesService);
    repo = module.get(getRepositoryToken(Place));
  });

  // ── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when place does not exist', async () => {
      repo.query.mockResolvedValue([]);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('returns the place when found', async () => {
      const place = { id: 'abc', name: 'Test' } as Place;
      repo.query.mockResolvedValue([place]);
      expect(await service.findOne('abc')).toBe(place);
    });
  });

  // ── findAll (pagination) ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('uses default page=1 and limit=20', async () => {
      const places = [{ id: '1' }] as Place[];
      const qb = makeQb([places, 1]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(qb.orderBy).toHaveBeenCalledWith('p.created_at', 'DESC');
      expect(result.data).toBe(places);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('applies page and limit correctly (page=3, limit=10 → skip=20)', async () => {
      const qb = makeQb([[], 50]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.meta.totalPages).toBe(5);
    });

    it('rounds totalPages up when total is not divisible by limit', async () => {
      repo.createQueryBuilder.mockReturnValue(makeQb([[], 21]));
      const result = await service.findAll({ limit: 10 });
      expect(result.meta.totalPages).toBe(3);
    });

    it('searches name or address (OR) via ILIKE when search is provided', async () => {
      const qb = makeQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ search: 'couscous' });

      const clause = qb.andWhere.mock.calls.find(([sql]) =>
        String(sql).includes('ILIKE'),
      );
      expect(clause?.[0]).toContain('p.name ILIKE');
      expect(clause?.[0]).toContain('p.address ILIKE');
      expect(clause?.[1]).toEqual({ search: '%couscous%' });
    });

    it('narrows only activity rows when categories are provided', async () => {
      const qb = makeQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ categories: [PlaceCategory.TOURISTIQUE] });

      const clause = qb.andWhere.mock.calls.find(([sql]) =>
        String(sql).includes('p.category IN'),
      );
      expect(clause?.[0]).toContain("p.type <> 'activity'");
      expect(clause?.[1]).toEqual({ categories: [PlaceCategory.TOURISTIQUE] });
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      type: PlaceType.RESTAURANT,
      name: 'Mon Resto',
      slug: 'mon-resto',
      address: '1 rue de la Paix, Paris',
      arrondissement: 2,
      latitude: 48.8698,
      longitude: 2.3309,
    };

    it('throws ConflictException when slug already exists', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing' } as Place);
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('inserts via raw SQL and returns the newly created place', async () => {
      const created = { id: 'new-uuid', name: 'Mon Resto' } as Place;
      repo.findOne.mockResolvedValueOnce(null); // slug conflict check
      repo.query
        .mockResolvedValueOnce([{ id: 'new-uuid' }]) // INSERT RETURNING id
        .mockResolvedValueOnce([created]);            // findOne SELECT

      const result = await service.create(dto);

      expect(repo.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO places'),
        expect.arrayContaining([dto.type, dto.name, dto.slug]),
      );
      expect(result).toBe(created);
    });

    it('serialises opening_hours to JSON and forwards category', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      repo.query
        .mockResolvedValueOnce([{ id: 'new-uuid' }])
        .mockResolvedValueOnce([{ id: 'new-uuid' } as Place]);

      const openingHours = { mon: [{ open: '09:00', close: '18:00' }] };
      await service.create({
        ...dto,
        type: PlaceType.ACTIVITY,
        category: PlaceCategory.TOURISTIQUE,
        opening_hours: openingHours,
      });

      const [, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(params).toContain(PlaceCategory.TOURISTIQUE);
      expect(params).toContain(JSON.stringify(openingHours));
    });

    it('passes null opening_hours when none provided', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      repo.query
        .mockResolvedValueOnce([{ id: 'new-uuid' }])
        .mockResolvedValueOnce([{ id: 'new-uuid' } as Place]);

      await service.create(dto);

      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('opening_hours');
      // category + opening_hours slots both null for a bare restaurant
      expect(params).toContain(null);
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('persists category and opening_hours through the scalar update', async () => {
      repo.query.mockResolvedValue([{ id: 'p1', slug: 'resto' }]);
      repo.findOne.mockResolvedValue(null);

      const openingHours = { fri: [{ open: '09:00', close: '17:00' }] };
      await service.update('p1', {
        category: PlaceCategory.TOURISTIQUE,
        opening_hours: openingHours,
      });

      expect(repo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          category: PlaceCategory.TOURISTIQUE,
          opening_hours: openingHours,
        }),
      );
    });
  });

  // ── findBySlug ───────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('returns the place with latitude/longitude when the slug matches a published place', async () => {
      const place = {
        id: 'abc',
        slug: 'mon-resto',
        published: true,
        latitude: 48.8566,
        longitude: 2.3522,
      };
      repo.query.mockResolvedValue([place]);

      expect(await service.findBySlug('mon-resto')).toBe(place);
      expect(repo.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE slug = $1 AND published = true'),
        ['mon-resto'],
      );
    });

    it('throws NotFoundException when slug is not found or place is unpublished', async () => {
      repo.query.mockResolvedValue([]);
      await expect(service.findBySlug('missing-slug')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findNearby ───────────────────────────────────────────────────────────

  describe('findNearby', () => {
    it('queries with ST_DWithin using lng, lat, radius', async () => {
      repo.query.mockResolvedValue([]);
      await service.findNearby({ lat: 48.8566, lng: 2.3522 });

      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ST_DWithin');
      expect(params).toEqual(expect.arrayContaining([2.3522, 48.8566, 1000]));
    });

    it('defaults radius to 1000 m when not provided', async () => {
      repo.query.mockResolvedValue([]);
      await service.findNearby({ lat: 48.8566, lng: 2.3522 });

      const [, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(params[2]).toBe(1000);
    });

    it('adds type filter when types are provided', async () => {
      repo.query.mockResolvedValue([]);
      await service.findNearby({ lat: 48.8566, lng: 2.3522, types: [PlaceType.RESTAURANT] });

      const [sql] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('AND type IN');
    });

    it('selects category and opening_hours columns', async () => {
      repo.query.mockResolvedValue([]);
      await service.findNearby({ lat: 48.8566, lng: 2.3522 });

      const [sql] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('category');
      expect(sql).toContain('opening_hours');
    });

    it('adds sub-category filter when categories are provided', async () => {
      repo.query.mockResolvedValue([]);
      await service.findNearby({
        lat: 48.8566,
        lng: 2.3522,
        categories: [PlaceCategory.DIVERTISSEMENT],
      });

      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('category IN');
      expect(sql).toContain("type <> 'activity'");
      expect(params).toContain(PlaceCategory.DIVERTISSEMENT);
    });

    it('adds serves_alcohol filter when noAlcohol=true', async () => {
      repo.query.mockResolvedValue([]);
      await service.findNearby({ lat: 48.8566, lng: 2.3522, noAlcohol: true });

      const [sql] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('serves_alcohol = false');
    });

    it('adds halal_level filter when minHalal is provided', async () => {
      repo.query.mockResolvedValue([]);
      await service.findNearby({ lat: 48.8566, lng: 2.3522, minHalal: 2 });

      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('halal_level >=');
      expect(params).toContain(2);
    });

    it('orders results by distance_m ASC', async () => {
      repo.query.mockResolvedValue([]);
      await service.findNearby({ lat: 48.8566, lng: 2.3522 });

      const [sql] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ORDER BY distance_m ASC');
    });

    it('adds name/address ILIKE filter when search is provided', async () => {
      repo.query.mockResolvedValue([]);
      await service.findNearby({ lat: 48.8566, lng: 2.3522, search: 'couscous' });

      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('name ILIKE');
      expect(sql).toContain('address ILIKE');
      expect(params).toContain('%couscous%');
    });
  });
});
