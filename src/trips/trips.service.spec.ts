import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TripSlot } from '../common/enums/trip-slot.enum';
import { Place } from '../places/entities/place.entity';
import { Trip } from './entities/trip.entity';
import { TripItem } from './entities/trip-item.entity';
import { TripsService } from './trips.service';

function chainableQb() {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'delete']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.execute = jest.fn().mockResolvedValue({ affected: 0 });
  return qb;
}

const mockTripsRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((d: unknown) => d),
  save: jest.fn().mockImplementation((d: unknown) => Promise.resolve({ id: 'trip-1', ...(d as object) })),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
});

const mockItemsRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((d: unknown) => d),
  save: jest.fn().mockImplementation((d: unknown) => Promise.resolve({ id: 'item-1', ...(d as object) })),
  update: jest.fn(),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  query: jest.fn().mockResolvedValue([]),
  createQueryBuilder: jest.fn(() => chainableQb()),
});

const mockPlacesRepo = () => ({ findOne: jest.fn() });

const TRIP = {
  id: 'trip-1',
  userId: 'user-1',
  title: 'Séjour',
  startDate: '2026-05-01',
  endDate: '2026-05-04',
} as Trip;

describe('TripsService', () => {
  let service: TripsService;
  let trips: ReturnType<typeof mockTripsRepo>;
  let items: ReturnType<typeof mockItemsRepo>;
  let places: ReturnType<typeof mockPlacesRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        { provide: getRepositoryToken(Trip), useFactory: mockTripsRepo },
        { provide: getRepositoryToken(TripItem), useFactory: mockItemsRepo },
        { provide: getRepositoryToken(Place), useFactory: mockPlacesRepo },
      ],
    }).compile();

    service = module.get(TripsService);
    trips = module.get(getRepositoryToken(Trip));
    items = module.get(getRepositoryToken(TripItem));
    places = module.get(getRepositoryToken(Place));
  });

  // ── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('rejects endDate before startDate', async () => {
      await expect(
        service.create('user-1', { title: 'x', startDate: '2026-05-04', endDate: '2026-05-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a span longer than 90 days', async () => {
      await expect(
        service.create('user-1', { title: 'x', startDate: '2026-01-01', endDate: '2026-12-31' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('trims the title and persists the range', async () => {
      await service.create('user-1', {
        title: '  Week-end  ',
        startDate: '2026-05-01',
        endDate: '2026-05-04',
      });
      expect(trips.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', title: 'Week-end', startDate: '2026-05-01' }),
      );
    });
  });

  // ── ownership ──────────────────────────────────────────────────────────

  describe('ownership', () => {
    it('findOne throws NotFound when the trip belongs to someone else', async () => {
      trips.findOne.mockResolvedValue({ ...TRIP, userId: 'other' });
      await expect(service.findOne('user-1', 'trip-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('remove throws NotFound when the trip does not exist', async () => {
      trips.findOne.mockResolvedValue(null);
      await expect(service.remove('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── findOne (day grouping) ─────────────────────────────────────────────

  describe('findOne', () => {
    it('returns one entry per day of the range, empty days included', async () => {
      trips.findOne.mockResolvedValue({ ...TRIP });
      items.query.mockResolvedValue([]);

      const result = await service.findOne('user-1', 'trip-1');

      expect(result.days.map((d) => d.date)).toEqual([
        '2026-05-01',
        '2026-05-02',
        '2026-05-03',
        '2026-05-04',
      ]);
      expect(result.days.every((d) => d.items.length === 0)).toBe(true);
    });
  });

  // ── addItem ────────────────────────────────────────────────────────────

  describe('addItem', () => {
    beforeEach(() => {
      trips.findOne.mockResolvedValue({ ...TRIP });
    });

    it('rejects a date outside the trip range', async () => {
      await expect(
        service.addItem('user-1', 'trip-1', {
          placeId: '11111111-1111-1111-1111-111111111111',
          date: '2026-06-01',
          slot: TripSlot.MATIN,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when the place does not exist', async () => {
      places.findOne.mockResolvedValue(null);
      await expect(
        service.addItem('user-1', 'trip-1', {
          placeId: '11111111-1111-1111-1111-111111111111',
          date: '2026-05-02',
          slot: TripSlot.MATIN,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('appends after the last position in the same day/slot group', async () => {
      places.findOne.mockResolvedValue({ id: 'place-1' } as Place);
      items.findOne.mockResolvedValue({ position: 2 } as TripItem); // last in group
      items.query.mockResolvedValue([
        {
          id: 'item-1',
          trip_id: 'trip-1',
          date: '2026-05-02',
          slot: 'matin',
          time: null,
          position: 3,
          note: null,
          p_id: 'place-1',
          p_name: 'X',
          p_slug: 'x',
          p_type: 'restaurant',
          p_address: 'addr',
          p_category: null,
          p_lat: '48.8',
          p_lng: '2.3',
        },
      ]);

      await service.addItem('user-1', 'trip-1', {
        placeId: 'place-1',
        date: '2026-05-02',
        slot: TripSlot.MATIN,
      });

      expect(items.save).toHaveBeenCalledWith(expect.objectContaining({ position: 3 }));
    });
  });

  // ── update (date narrowing) ───────────────────────────────────────────

  describe('update', () => {
    it('removes items that fall outside a narrowed date range', async () => {
      trips.findOne.mockResolvedValue({ ...TRIP });
      const qb = chainableQb();
      items.createQueryBuilder.mockReturnValue(qb);

      await service.update('user-1', 'trip-1', { endDate: '2026-05-02' });

      expect(qb.delete).toHaveBeenCalled();
      expect(qb.execute).toHaveBeenCalled();
    });
  });
});
