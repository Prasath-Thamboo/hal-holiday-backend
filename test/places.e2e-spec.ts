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
 * E2E tests for the places endpoints (GET /places/nearby, plus validation on
 * POST /places for the Phase 1 fields `category` / `opening_hours`).
 *
 * Prerequisites: docker compose up (PostGIS must be reachable).
 * The suite inserts its own rows and cleans them up — safe to run against
 * the development database.
 */
describe('Places endpoints (e2e)', () => {
  let app: INestApplication;
  let placesRepo: Repository<Place>;
  let usersRepo: Repository<User>;
  let insertedIds: string[] = [];
  let adminId: string;
  let adminToken: string;

  const ADMIN_EMAIL = 'e2e-places-admin@halholiday.fr';
  const ADMIN_PASSWORD = 'E2eAdminPass123!';

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

    placesRepo = moduleRef.get<Repository<Place>>(getRepositoryToken(Place));
    usersRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));

    // Defensive cleanup in case a previous run left rows behind (keeps the
    // suite re-runnable against the dev database).
    await placesRepo.query(`DELETE FROM places WHERE slug LIKE 'e2e-%'`);
    await usersRepo.query(`DELETE FROM users WHERE email = $1`, [ADMIN_EMAIL]);

    // Insert fixtures via raw SQL so PostGIS handles ST_MakePoint correctly.
    // All near Châtelet (48.8566, 2.3522) except "E2E Loin" (~4 km away).
    const rows = (await placesRepo.query(`
      INSERT INTO places
        (type, name, slug, address, arrondissement, location,
         category, opening_hours, halal_level, serves_alcohol, published)
      VALUES
        ('restaurant', 'E2E Resto Halal',   'e2e-resto-halal',   '1 rue e2e, Paris', 1,
         ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography,
         null, '{"mon":[{"open":"12:00","close":"14:30"},{"open":"19:00","close":"22:30"}]}'::jsonb,
         3, false, true),
        ('mosque',     'E2E Mosquée Test',  'e2e-mosquee-test',  '2 rue e2e, Paris', 4,
         ST_SetSRID(ST_MakePoint(2.3530, 48.8570), 4326)::geography,
         null, null, null, false, true),
        ('restaurant', 'E2E Resto Alcool',  'e2e-resto-alcool',  '3 rue e2e, Paris', 1,
         ST_SetSRID(ST_MakePoint(2.3525, 48.8568), 4326)::geography,
         null, null, null, true,  true),
        ('activity',   'E2E Non Published', 'e2e-non-published', '4 rue e2e, Paris', 2,
         ST_SetSRID(ST_MakePoint(2.3520, 48.8565), 4326)::geography,
         null, null, null, false, false),
        ('restaurant', 'E2E Loin',          'e2e-resto-loin',    '5 av. e2e, Paris', 18,
         ST_SetSRID(ST_MakePoint(2.3488, 48.8924), 4326)::geography,
         null, null, 2, false, true),
        ('activity',   'E2E Musée',         'e2e-musee',         '6 rue e2e, Paris', 1,
         ST_SetSRID(ST_MakePoint(2.3524, 48.8567), 4326)::geography,
         'touristique', '{"tue":[{"open":"10:00","close":"18:00"}]}'::jsonb, null, false, true),
        ('activity',   'E2E Hammam',        'e2e-hammam',        '7 rue e2e, Paris', 1,
         ST_SetSRID(ST_MakePoint(2.3526, 48.8569), 4326)::geography,
         'divertissement', null, null, false, true)
      RETURNING id
    `)) as { id: string }[];

    insertedIds = rows.map((r) => r.id);

    // Admin account for the POST /places validation tests.
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const admin = await usersRepo.save(
      usersRepo.create({ email: ADMIN_EMAIL, passwordHash, role: UserRole.ADMIN }),
    );
    adminId = admin.id;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = (loginRes.body as { access_token: string }).access_token;
  });

  afterAll(async () => {
    if (insertedIds.length) {
      await placesRepo.query(`DELETE FROM places WHERE id = ANY($1::uuid[])`, [insertedIds]);
    }
    if (adminId) {
      await usersRepo.query(`DELETE FROM users WHERE id = $1`, [adminId]);
    }
    await app.close();
  });

  // ── basic behaviour ───────────────────────────────────────────────────────

  it('returns 200 with published places and a distance_m field', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({ lat: 48.8566, lng: 2.3522, radius: 500 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const slugs: string[] = res.body.map((p: { slug: string }) => p.slug);
    expect(slugs).toContain('e2e-resto-halal');
    expect(slugs).toContain('e2e-mosquee-test');
    expect(slugs).not.toContain('e2e-non-published'); // published=false excluded
    expect(slugs).not.toContain('e2e-resto-loin');    // outside radius

    // Every result must carry a numeric distance_m
    for (const place of res.body as { distance_m: unknown }[]) {
      expect(typeof place.distance_m).toBe('string'); // ROUND returns numeric → pg driver → string
    }
  });

  it('results are sorted by distance ascending', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({ lat: 48.8566, lng: 2.3522, radius: 50000 });

    expect(res.status).toBe(200);
    const distances = (res.body as { distance_m: string }[]).map((p) =>
      parseFloat(p.distance_m),
    );
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  // ── filter: types ─────────────────────────────────────────────────────────

  it('filters by type=mosque', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({ lat: 48.8566, lng: 2.3522, radius: 5000, types: 'mosque' });

    expect(res.status).toBe(200);
    const types: string[] = res.body.map((p: { type: string }) => p.type);
    expect(types.every((t) => t === 'mosque')).toBe(true);
    expect(types).toContain('mosque');
  });

  // ── filter: noAlcohol ────────────────────────────────────────────────────

  it('excludes places serving alcohol when noAlcohol=true', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({ lat: 48.8566, lng: 2.3522, radius: 5000, noAlcohol: true });

    expect(res.status).toBe(200);
    const slugs: string[] = res.body.map((p: { slug: string }) => p.slug);
    expect(slugs).not.toContain('e2e-resto-alcool');
  });

  // ── filter: minHalal ─────────────────────────────────────────────────────

  it('filters by minHalal=3', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({ lat: 48.8566, lng: 2.3522, radius: 5000, minHalal: 3 });

    expect(res.status).toBe(200);
    const slugs: string[] = res.body.map((p: { slug: string }) => p.slug);
    expect(slugs).toContain('e2e-resto-halal'); // halal_level=3
    expect(slugs).not.toContain('e2e-resto-loin'); // halal_level=2, outside anyway
  });

  // ── filter: categories (sub-type, Phase 1) ──────────────────────────────

  it('narrows activities to a sub-category without hiding mosques/restaurants', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({ lat: 48.8566, lng: 2.3522, radius: 5000, categories: 'touristique' });

    expect(res.status).toBe(200);
    const slugs: string[] = res.body.map((p: { slug: string }) => p.slug);
    expect(slugs).toContain('e2e-musee'); // activity + touristique → kept
    expect(slugs).not.toContain('e2e-hammam'); // activity + divertissement → dropped
    expect(slugs).toContain('e2e-resto-halal'); // non-activity → unaffected
    expect(slugs).toContain('e2e-mosquee-test');
  });

  it('accepts multiple categories', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({
        lat: 48.8566,
        lng: 2.3522,
        radius: 5000,
        categories: ['touristique', 'divertissement'],
      });

    expect(res.status).toBe(200);
    const slugs: string[] = res.body.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual(expect.arrayContaining(['e2e-musee', 'e2e-hammam']));
  });

  it('returns 400 for an unknown category value', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({ lat: 48.8566, lng: 2.3522, categories: 'bistrot' });

    expect(res.status).toBe(400);
  });

  // ── response payload: category + opening_hours (Phase 1) ────────────────

  it('returns category and parsed opening_hours in the payload', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({ lat: 48.8566, lng: 2.3522, radius: 5000 });

    expect(res.status).toBe(200);
    const byslug: Record<string, Record<string, unknown>> = Object.fromEntries(
      (res.body as { slug: string }[]).map((p) => [p.slug, p]),
    );

    expect(byslug['e2e-musee'].category).toBe('touristique');
    expect(byslug['e2e-resto-halal'].opening_hours).toEqual({
      mon: [
        { open: '12:00', close: '14:30' },
        { open: '19:00', close: '22:30' },
      ],
    });
    expect(byslug['e2e-mosquee-test'].category).toBeNull();
    expect(byslug['e2e-mosquee-test'].opening_hours).toBeNull();
  });

  // ── GET /places list: category narrowing ──────────────────────────────

  it('narrows the paginated list to a sub-category without dropping other types', async () => {
    const res = await request(app.getHttpServer())
      .get('/places')
      .query({ limit: 100, published: true, categories: 'touristique' });

    expect(res.status).toBe(200);
    const slugs = (res.body.data as { slug: string }[]).map((p) => p.slug);
    expect(slugs).toContain('e2e-musee'); // activity + touristique
    expect(slugs).not.toContain('e2e-hammam'); // activity + divertissement
    expect(slugs).toContain('e2e-resto-halal'); // restaurant → unaffected
  });

  // ── validation: GET /places/nearby ─────────────────────────────────────

  it('returns 400 when lat/lng are missing', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({ radius: 500 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when radius exceeds 50 000', async () => {
    const res = await request(app.getHttpServer())
      .get('/places/nearby')
      .query({ lat: 48.8566, lng: 2.3522, radius: 99999 });

    expect(res.status).toBe(400);
  });

  // ── validation: POST /places (category + opening_hours DTOs) ───────────

  const basePlace = {
    type: 'activity',
    name: 'E2E Create Check',
    slug: 'e2e-create-check',
    address: '9 rue e2e, Paris',
    arrondissement: 1,
    latitude: 48.857,
    longitude: 2.352,
  };

  it('rejects an out-of-range time in opening_hours (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/places')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...basePlace, opening_hours: { mon: [{ open: '25:00', close: '12:00' }] } });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown category on create (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/places')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...basePlace, category: 'bistrot' });

    expect(res.status).toBe(400);
  });

  it('rejects a malformed exception date in opening_hours (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/places')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...basePlace,
        opening_hours: { exceptions: [{ date: '25/12/2026', closed: true }] },
      });

    expect(res.status).toBe(400);
  });

  it('creates a place with a valid category and opening_hours (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/places')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...basePlace,
        category: 'touristique',
        opening_hours: {
          fri: [{ open: '09:00', close: '17:00' }],
          exceptions: [{ date: '2026-12-25', closed: true }],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('touristique');
    expect(res.body.opening_hours).toMatchObject({
      fri: [{ open: '09:00', close: '17:00' }],
    });

    insertedIds.push(res.body.id as string);
  });
});
