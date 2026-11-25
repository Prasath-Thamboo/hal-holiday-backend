import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/enums/user-role.enum';
import { Place } from '../src/places/entities/place.entity';
import { User } from '../src/users/entities/user.entity';

/**
 * E2E for the trip-planning endpoints (Phase 2). Needs PostGIS reachable.
 */
describe('Trips endpoints (e2e)', () => {
  let app: INestApplication;
  let usersRepo: Repository<User>;
  let placesRepo: Repository<Place>;

  const A = { email: 'e2e-trip-a@halholiday.fr', password: 'E2eTripA123!' };
  const B = { email: 'e2e-trip-b@halholiday.fr', password: 'E2eTripB123!' };
  let tokenA = '';
  let tokenB = '';
  let placeId = '';
  let place2Id = '';

  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function makeUser(email: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 10);
    await usersRepo.save(usersRepo.create({ email, passwordHash, role: UserRole.USER }));
  }
  async function login(email: string, password: string): Promise<string> {
    const res = await http().post('/auth/login').send({ email, password });
    return (res.body as { access_token: string }).access_token;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();

    usersRepo = moduleRef.get(getRepositoryToken(User));
    placesRepo = moduleRef.get(getRepositoryToken(Place));

    await usersRepo.query(`DELETE FROM users WHERE email = ANY($1)`, [[A.email, B.email]]);
    await placesRepo.query(`DELETE FROM places WHERE slug LIKE 'e2e-trip-%'`);

    await makeUser(A.email, A.password);
    await makeUser(B.email, B.password);
    tokenA = await login(A.email, A.password);
    tokenB = await login(B.email, B.password);

    const rows = (await placesRepo.query(`
      INSERT INTO places (type, name, slug, address, arrondissement, location, published)
      VALUES
        ('restaurant', 'E2E Trip Place 1', 'e2e-trip-place-1', '1 rue e2e, Paris', 1,
         ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography, true),
        ('activity', 'E2E Trip Place 2', 'e2e-trip-place-2', '2 rue e2e, Paris', 1,
         ST_SetSRID(ST_MakePoint(2.3530, 48.8570), 4326)::geography, true)
      RETURNING id
    `)) as { id: string }[];
    placeId = rows[0].id;
    place2Id = rows[1].id;
  });

  afterAll(async () => {
    await usersRepo.query(`DELETE FROM users WHERE email = ANY($1)`, [[A.email, B.email]]);
    await placesRepo.query(`DELETE FROM places WHERE slug LIKE 'e2e-trip-%'`);
    await app.close();
  });

  let tripId = '';
  let itemId = '';
  let item2Id = '';

  it('requires authentication', async () => {
    expect((await http().get('/trips')).status).toBe(401);
  });

  it('creates a trip (201) and lists it with day/item counts', async () => {
    const res = await http()
      .post('/trips')
      .set(bearer(tokenA))
      .send({ title: 'Week-end à Paris', startDate: '2026-05-01', endDate: '2026-05-03' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Week-end à Paris', startDate: '2026-05-01' });
    tripId = res.body.id as string;

    const list = await http().get('/trips').set(bearer(tokenA));
    expect(list.status).toBe(200);
    const mine = (list.body as { id: string; dayCount: number; itemCount: number }[]).find(
      (t) => t.id === tripId,
    );
    expect(mine).toMatchObject({ dayCount: 3, itemCount: 0 });
  });

  it('rejects a trip with endDate before startDate (400)', async () => {
    const res = await http()
      .post('/trips')
      .set(bearer(tokenA))
      .send({ title: 'x', startDate: '2026-05-05', endDate: '2026-05-01' });
    expect(res.status).toBe(400);
  });

  it('returns the detail grouped by day with every day present', async () => {
    const res = await http().get(`/trips/${tripId}`).set(bearer(tokenA));
    expect(res.status).toBe(200);
    expect((res.body.days as { date: string }[]).map((d) => d.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);
  });

  it('adds two places to the same day/slot with incremental positions', async () => {
    const r1 = await http()
      .post(`/trips/${tripId}/items`)
      .set(bearer(tokenA))
      .send({ placeId, date: '2026-05-02', slot: 'matin' });
    expect(r1.status).toBe(201);
    expect(r1.body).toMatchObject({ position: 0, place: { slug: 'e2e-trip-place-1' } });
    itemId = r1.body.id as string;

    const r2 = await http()
      .post(`/trips/${tripId}/items`)
      .set(bearer(tokenA))
      .send({ placeId: place2Id, date: '2026-05-02', slot: 'matin', time: '10:30' });
    expect(r2.status).toBe(201);
    expect(r2.body.position).toBe(1);
    item2Id = r2.body.id as string;
  });

  it('rejects an item on a date outside the trip (400)', async () => {
    const res = await http()
      .post(`/trips/${tripId}/items`)
      .set(bearer(tokenA))
      .send({ placeId, date: '2026-06-10', slot: 'soir' });
    expect(res.status).toBe(400);
  });

  it('reorders items within a slot via position', async () => {
    const res = await http()
      .patch(`/trips/${tripId}/items/${item2Id}`)
      .set(bearer(tokenA))
      .send({ position: 0 });
    expect(res.status).toBe(200);

    const detail = await http().get(`/trips/${tripId}`).set(bearer(tokenA));
    const day = (detail.body.days as { date: string; items: { id: string }[] }[]).find(
      (d) => d.date === '2026-05-02',
    )!;
    expect(day.items.map((i) => i.id)).toEqual([item2Id, itemId]);
  });

  it('moves an item to another day and renormalises the old slot', async () => {
    const res = await http()
      .patch(`/trips/${tripId}/items/${item2Id}`)
      .set(bearer(tokenA))
      .send({ date: '2026-05-03', slot: 'soir' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ date: '2026-05-03', slot: 'soir', position: 0 });

    const detail = await http().get(`/trips/${tripId}`).set(bearer(tokenA));
    const days = detail.body.days as { date: string; items: { id: string; position: number }[] }[];
    expect(days.find((d) => d.date === '2026-05-02')!.items).toEqual([
      expect.objectContaining({ id: itemId, position: 0 }),
    ]);
    expect(days.find((d) => d.date === '2026-05-03')!.items[0].id).toBe(item2Id);
  });

  it('isolates trips per user (user B cannot read user A\'s trip)', async () => {
    expect((await http().get(`/trips/${tripId}`).set(bearer(tokenB))).status).toBe(404);
    expect(
      (
        await http()
          .post(`/trips/${tripId}/items`)
          .set(bearer(tokenB))
          .send({ placeId, date: '2026-05-02', slot: 'midi' })
      ).status,
    ).toBe(404);
  });

  it('drops out-of-range items when the trip dates are narrowed', async () => {
    // item2 is on 2026-05-03; shrink the trip to end 2026-05-02
    const res = await http()
      .patch(`/trips/${tripId}`)
      .set(bearer(tokenA))
      .send({ endDate: '2026-05-02' });
    expect(res.status).toBe(200);

    const detail = await http().get(`/trips/${tripId}`).set(bearer(tokenA));
    const allItems = (detail.body.days as { items: { id: string }[] }[]).flatMap(
      (d) => d.items,
    );
    expect(allItems.map((i) => i.id)).toEqual([itemId]); // item2 removed
  });

  it('removes an item (204)', async () => {
    const res = await http()
      .delete(`/trips/${tripId}/items/${itemId}`)
      .set(bearer(tokenA));
    expect(res.status).toBe(204);

    const detail = await http().get(`/trips/${tripId}`).set(bearer(tokenA));
    const allItems = (detail.body.days as { items: unknown[] }[]).flatMap((d) => d.items);
    expect(allItems).toHaveLength(0);
  });

  it('deletes the trip (204) and then 404s', async () => {
    expect((await http().delete(`/trips/${tripId}`).set(bearer(tokenA))).status).toBe(204);
    expect((await http().get(`/trips/${tripId}`).set(bearer(tokenA))).status).toBe(404);
  });
});
