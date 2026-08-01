import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlaceType } from '../common/enums/place-type.enum';
import { Place } from './entities/place.entity';
import { PlacesService } from './places.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  query: jest.fn(),
  remove: jest.fn(),
  update: jest.fn(),
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
      repo.findAndCount.mockResolvedValue([places, 1]);

      const result = await service.findAll({});

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { created_at: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toBe(places);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('applies page and limit correctly (page=3, limit=10 → skip=20)', async () => {
      repo.findAndCount.mockResolvedValue([[], 50]);

      const result = await service.findAll({ page: 3, limit: 10 });

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { created_at: 'DESC' },
        skip: 20,
        take: 10,
      });
      expect(result.meta.totalPages).toBe(5);
    });

    it('rounds totalPages up when total is not divisible by limit', async () => {
      repo.findAndCount.mockResolvedValue([[], 21]);
      const result = await service.findAll({ limit: 10 });
      expect(result.meta.totalPages).toBe(3);
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
  });

  // ── findBySlug ───────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('returns the place when the slug matches a published place', async () => {
      const place = { id: 'abc', slug: 'mon-resto', published: true } as Place;
      repo.findOne.mockResolvedValue(place);

      expect(await service.findBySlug('mon-resto')).toBe(place);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { slug: 'mon-resto', published: true },
      });
    });

    it('throws NotFoundException when slug is not found or place is unpublished', async () => {
      repo.findOne.mockResolvedValue(null);
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
  });
});
