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

/** E2E for the promotions endpoints (Phase 3). Needs PostGIS reachable. */
describe('Promotions endpoints (e2e)', () => {
  let app: INestApplication;
  let usersRepo: Repository<User>;
  let placesRepo: Repository<Place>;

  const ADMIN = { email: 'e2e-promo-admin@halholiday.fr', password: 'E2ePromoA123!' };
  const USER = { email: 'e2e-promo-user@halholiday.fr', password: 'E2ePromoU123!' };
  let adminToken = '';
  let userToken = '';
  let publishedPlaceId = '';
  let publishedPlace2Id = '';
  let draftPlaceId = '';

  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return iso(d);
  };

  async function createPromo(body: Record<string, unknown>): Promise<string> {
    const res = await http().post('/promotions').set(bearer(adminToken)).send(body);
    expect(res.status).toBe(201);
    return res.body.id as string;
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

    await usersRepo.query(`DELETE FROM users WHERE email = ANY($1)`, [
      [ADMIN.email, USER.email],
    ]);
    await placesRepo.query(`DELETE FROM places WHERE slug LIKE 'e2e-promo-%'`);

    for (const [u, role] of [
      [ADMIN, UserRole.ADMIN],
      [USER, UserRole.USER],
    ] as const) {
      await usersRepo.save(
        usersRepo.create({
          email: u.email,
          passwordHash: await bcrypt.hash(u.password, 10),
          role,
        }),
      );
    }
    adminToken = (
      await http().post('/auth/login').send(ADMIN)
    ).body.access_token as string;
    userToken = (
      await http().post('/auth/login').send(USER)
    ).body.access_token as string;

    const rows = (await placesRepo.query(`
      INSERT INTO places (type, name, slug, address, arrondissement, location, published)
      VALUES
        ('restaurant', 'E2E Promo Resto',  'e2e-promo-resto',  '1 rue e2e, Paris', 11,
         ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography, true),
        ('mosque',     'E2E Promo Mosque', 'e2e-promo-mosque', '2 rue e2e, Paris', 5,
         ST_SetSRID(ST_MakePoint(2.3530, 48.8570), 4326)::geography, true),
        ('restaurant', 'E2E Promo Draft',  'e2e-promo-draft',  '3 rue e2e, Paris', 11,
         ST_SetSRID(ST_MakePoint(2.3525, 48.8568), 4326)::geography, false)
      RETURNING id
    `)) as { id: string }[];
    publishedPlaceId = rows[0].id;
    publishedPlace2Id = rows[1].id;
    draftPlaceId = rows[2].id;
  });

  afterAll(async () => {
    await usersRepo.query(`DELETE FROM users WHERE email = ANY($1)`, [
      [ADMIN.email, USER.email],
    ]);
    await placesRepo.query(`DELETE FROM places WHERE slug LIKE 'e2e-promo-%'`);
    await app.close();
  });

  let activePromoId = '';
  let inactivePromoId = '';

  // ── auth / roles ──────────────────────────────────────────────────────

  it('rejects promotion creation without a token (401)', async () => {
    expect((await http().post('/promotions').send({})).status).toBe(401);
  });

  it('rejects promotion creation for a non-admin (403)', async () => {
    const res = await http()
      .post('/promotions')
      .set(bearer(userToken))
      .send({
        placeId: publishedPlaceId,
        title: 'x',
        startDate: plus(0),
        endDate: plus(10),
      });
    expect(res.status).toBe(403);
  });

  it('rejects the admin list for a non-admin (403)', async () => {
    expect(
      (await http().get('/promotions/admin/list').set(bearer(userToken))).status,
    ).toBe(403);
  });

  // ── create validation ────────────────────────────────────────────────

  it('rejects endDate before startDate (400)', async () => {
    const res = await http()
      .post('/promotions')
      .set(bearer(adminToken))
      .send({
        placeId: publishedPlaceId,
        title: 'x',
        startDate: plus(10),
        endDate: plus(0),
      });
    expect(res.status).toBe(400);
  });

  it('404s when the associated place does not exist', async () => {
    const res = await http()
      .post('/promotions')
      .set(bearer(adminToken))
      .send({
        placeId: '00000000-0000-0000-0000-000000000000',
        title: 'x',
        startDate: plus(0),
        endDate: plus(10),
      });
    expect(res.status).toBe(404);
  });

  // ── public listing rules ─────────────────────────────────────────────

  it('lists only active promotions inside their window on a published place', async () => {
    activePromoId = await createPromo({
      placeId: publishedPlaceId,
      title: 'Active now',
      startDate: plus(-2),
      endDate: plus(10),
      code: 'HALAL20',
    });
    await createPromo({
      placeId: publishedPlaceId,
      title: 'Future',
      startDate: plus(20),
      endDate: plus(30),
    });
    inactivePromoId = await createPromo({
      placeId: publishedPlaceId,
      title: 'Disabled',
      startDate: plus(-2),
      endDate: plus(10),
      active: false,
    });
    await createPromo({
      placeId: draftPlaceId,
      title: 'On a draft place',
      startDate: plus(-2),
      endDate: plus(10),
    });
    await createPromo({
      placeId: publishedPlace2Id,
      title: 'Active on mosque',
      startDate: plus(-1),
      endDate: plus(5),
    });

    const res = await http().get('/promotions');
    expect(res.status).toBe(200);
    const titles = (res.body.data as { title: string; place: unknown }[]).map(
      (p) => p.title,
    );
    expect(titles).toEqual(expect.arrayContaining(['Active now', 'Active on mosque']));
    expect(titles).not.toContain('Future');
    expect(titles).not.toContain('Disabled');
    expect(titles).not.toContain('On a draft place');
    expect(res.body.data[0].place).toMatchObject({ slug: expect.any(String) });
  });

  it('filters the public list by arrondissement and by place type', async () => {
    const byArr = await http().get('/promotions').query({ arrondissement: 5 });
    expect(
      (byArr.body.data as { title: string }[]).map((p) => p.title),
    ).toEqual(['Active on mosque']);

    const byType = await http().get('/promotions').query({ type: 'restaurant' });
    const t = (byType.body.data as { title: string }[]).map((p) => p.title);
    expect(t).toContain('Active now');
    expect(t).not.toContain('Active on mosque');
  });

  it('exposes a single promotion by id, even an inactive one', async () => {
    const res = await http().get(`/promotions/${inactivePromoId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Disabled', active: false });
  });

  // ── admin operations ─────────────────────────────────────────────────

  it('lists every promotion (inactive included) on the admin endpoint', async () => {
    const res = await http().get('/promotions/admin/list').set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(5);
  });

  it('toggles a promotion active flag and hides it from the public list', async () => {
    const toggle = await http()
      .patch(`/promotions/${activePromoId}/toggle-active`)
      .set(bearer(adminToken));
    expect(toggle.status).toBe(200);
    expect(toggle.body.active).toBe(false);

    const list = await http().get('/promotions');
    expect(
      (list.body.data as { id: string }[]).some((p) => p.id === activePromoId),
    ).toBe(false);
  });

  it('updates a promotion', async () => {
    const res = await http()
      .patch(`/promotions/${activePromoId}`)
      .set(bearer(adminToken))
      .send({ title: 'Renamed promo' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Renamed promo');
  });

  it('deletes a promotion (204) then 404s', async () => {
    expect(
      (await http().delete(`/promotions/${inactivePromoId}`).set(bearer(adminToken)))
        .status,
    ).toBe(204);
    expect((await http().get(`/promotions/${inactivePromoId}`)).status).toBe(404);
  });

  it('cascade-deletes promotions when their place is removed', async () => {
    await placesRepo.query(`DELETE FROM places WHERE id = $1`, [publishedPlace2Id]);
    const rows = (await placesRepo.query(
      `SELECT id FROM promotions WHERE place_id = $1`,
      [publishedPlace2Id],
    )) as unknown[];
    expect(rows).toHaveLength(0);
  });
});
