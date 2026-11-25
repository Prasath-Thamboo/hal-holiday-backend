import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlaceType } from '../common/enums/place-type.enum';
import { Place } from '../places/entities/place.entity';
import { Promotion } from './entities/promotion.entity';
import { PromotionsService } from './promotions.service';

const RAW_ROW = {
  id: 'promo-1',
  placeId: 'place-1',
  title: 'Promo',
  description: null,
  imageUrl: null,
  startDate: '2026-05-01',
  endDate: '2026-06-30',
  code: null,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  p_id: 'place-1',
  p_name: 'Resto',
  p_slug: 'resto',
  p_type: 'restaurant',
  p_arr: 11,
  p_address: '1 rue e2e',
};

const mockPromosRepo = () => ({
  query: jest.fn().mockResolvedValue([RAW_ROW]),
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((d: unknown) => d),
  save: jest.fn().mockResolvedValue({ id: 'promo-1' }),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
});

const mockPlacesRepo = () => ({ findOne: jest.fn() });

describe('PromotionsService', () => {
  let service: PromotionsService;
  let promos: ReturnType<typeof mockPromosRepo>;
  let places: ReturnType<typeof mockPlacesRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: getRepositoryToken(Promotion), useFactory: mockPromosRepo },
        { provide: getRepositoryToken(Place), useFactory: mockPlacesRepo },
      ],
    }).compile();

    service = module.get(PromotionsService);
    promos = module.get(getRepositoryToken(Promotion));
    places = module.get(getRepositoryToken(Place));
  });

  // ── findActive ─────────────────────────────────────────────────────────

  describe('findActive', () => {
    it('restricts to active promos in their window on published places', async () => {
      await service.findActive({});
      const [sql] = promos.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('pr.active = true');
      expect(sql).toContain('CURRENT_DATE BETWEEN pr.start_date AND pr.end_date');
      expect(sql).toContain('p.published = true');
    });

    it('adds arrondissement and type filters when provided', async () => {
      await service.findActive({ arrondissement: 11, type: PlaceType.RESTAURANT });
      const calls = promos.query.mock.calls as [string, unknown[]][];
      const listCall = calls.find(([sql]) => sql.includes('LIMIT'))!;
      expect(listCall[0]).toContain('p.arrondissement = $1');
      expect(listCall[0]).toContain('p.type = $2');
      expect(listCall[1]).toEqual(expect.arrayContaining([11, PlaceType.RESTAURANT]));
    });
  });

  // ── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      placeId: '11111111-1111-1111-1111-111111111111',
      title: '  Menu -20%  ',
      startDate: '2026-05-01',
      endDate: '2026-06-30',
    };

    it('rejects endDate before startDate', async () => {
      await expect(
        service.create({ ...dto, startDate: '2026-06-30', endDate: '2026-05-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when the place does not exist', async () => {
      places.findOne.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('trims the title and defaults active to true', async () => {
      places.findOne.mockResolvedValue({ id: dto.placeId } as Place);
      await service.create(dto);
      expect(promos.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Menu -20%', active: true }),
      );
    });
  });

  // ── toggleActive ──────────────────────────────────────────────────────

  describe('toggleActive', () => {
    it('flips the active flag', async () => {
      promos.findOne.mockResolvedValue({ id: 'promo-1', active: true } as Promotion);
      await service.toggleActive('promo-1');
      expect(promos.update).toHaveBeenCalledWith('promo-1', { active: false });
    });

    it('throws NotFound for an unknown promotion', async () => {
      promos.findOne.mockResolvedValue(null);
      await expect(service.toggleActive('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── update / remove ───────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFound when the promotion does not exist', async () => {
      promos.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { title: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('validates a new date range', async () => {
      promos.findOne.mockResolvedValue({
        id: 'promo-1',
        startDate: '2026-05-01',
        endDate: '2026-06-30',
        placeId: 'place-1',
      } as Promotion);
      await expect(
        service.update('promo-1', { endDate: '2026-04-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('throws NotFound when nothing was deleted', async () => {
      promos.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
