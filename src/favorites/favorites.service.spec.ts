import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Place } from '../places/entities/place.entity';
import { Favorite } from './entities/favorite.entity';
import { FavoritesService } from './favorites.service';

const mockFavoritesRepo = () => ({
  query: jest.fn(),
  delete: jest.fn(),
  find: jest.fn(),
});

const mockPlacesRepo = () => ({
  findOne: jest.fn(),
  query: jest.fn(),
});

describe('FavoritesService', () => {
  let service: FavoritesService;
  let favoritesRepo: ReturnType<typeof mockFavoritesRepo>;
  let placesRepo: ReturnType<typeof mockPlacesRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(Favorite), useFactory: mockFavoritesRepo },
        { provide: getRepositoryToken(Place), useFactory: mockPlacesRepo },
      ],
    }).compile();

    service = module.get(FavoritesService);
    favoritesRepo = module.get(getRepositoryToken(Favorite));
    placesRepo = module.get(getRepositoryToken(Place));
  });

  // ── add ──────────────────────────────────────────────────────────────────

  describe('add', () => {
    it('throws NotFoundException when the place does not exist', async () => {
      placesRepo.findOne.mockResolvedValue(null);
      await expect(service.add('user-1', 'missing-place')).rejects.toThrow(NotFoundException);
      expect(favoritesRepo.query).not.toHaveBeenCalled();
    });

    it('inserts with ON CONFLICT DO NOTHING when the place exists', async () => {
      placesRepo.findOne.mockResolvedValue({ id: 'place-1' } as Place);
      favoritesRepo.query.mockResolvedValue(undefined);

      await service.add('user-1', 'place-1');

      expect(favoritesRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (user_id, place_id) DO NOTHING'),
        ['user-1', 'place-1'],
      );
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes by userId and placeId regardless of whether a row matched', async () => {
      favoritesRepo.delete.mockResolvedValue({ affected: 0 });
      await service.remove('user-1', 'place-1');
      expect(favoritesRepo.delete).toHaveBeenCalledWith({ userId: 'user-1', placeId: 'place-1' });
    });
  });

  // ── listIds ──────────────────────────────────────────────────────────────

  describe('listIds', () => {
    it('returns only placeId values for the given user', async () => {
      favoritesRepo.find.mockResolvedValue([{ placeId: 'a' }, { placeId: 'b' }]);
      const result = await service.listIds('user-1');
      expect(favoritesRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: ['placeId'],
      });
      expect(result).toEqual(['a', 'b']);
    });
  });

  // ── listPlaces ───────────────────────────────────────────────────────────

  describe('listPlaces', () => {
    it('joins favorites to published places ordered by favorited_at desc', async () => {
      placesRepo.query.mockResolvedValue([{ id: 'place-1' }]);
      const result = await service.listPlaces('user-1');

      const [sql, params] = placesRepo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INNER JOIN favorites f ON f.place_id = p.id');
      expect(sql).toContain('p.published = true');
      expect(sql).toContain('ORDER BY f.created_at DESC');
      expect(params).toEqual(['user-1']);
      expect(result).toEqual([{ id: 'place-1' }]);
    });
  });

  // ── listForExport ────────────────────────────────────────────────────────

  describe('listForExport', () => {
    it('LEFT JOINs places (keeps rows to unpublished/removed places) for the user', async () => {
      const rows = [
        {
          place_id: 'place-1',
          added_at: '2026-01-02T10:00:00.000Z',
          name: 'Le Jardin de Marrakech',
          slug: 'le-jardin-de-marrakech',
          address: '14 rue des Lombards, 75004 Paris',
        },
      ];
      favoritesRepo.query.mockResolvedValue(rows);

      const result = await service.listForExport('user-1');

      const [sql, params] = favoritesRepo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('LEFT JOIN places p ON p.id = f.place_id');
      expect(sql).not.toContain('p.published = true');
      expect(sql).toContain('WHERE f.user_id = $1');
      expect(params).toEqual(['user-1']);
      expect(result).toEqual(rows);
    });
  });
});
