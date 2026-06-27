import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Place } from '../src/places/entities/place.entity';

/**
 * E2E tests for GET /places/nearby.
 *
 * Prerequisites: docker compose up (PostGIS must be reachable).
 * The suite inserts its own rows and cleans them up — safe to run against
 * the development database.
 */
describe('GET /places/nearby (e2e)', () => {
  let app: INestApplication;
  let placesRepo: Repository<Place>;
  let insertedIds: string[] = [];

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

    // Insert fixtures via raw SQL so PostGIS handles ST_MakePoint correctly.
    // All three are near Châtelet (48.8566, 2.3522); the fourth is ~5 km away.
    const rows = (await placesRepo.query(`
      INSERT INTO places
        (type, name, slug, address, arrondissement, location,
         halal_level, serves_alcohol, published)
      VALUES
        ('restaurant', 'E2E Resto Halal',     'e2e-resto-halal',     '1 rue e2e, Paris', 1,
         ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography, 3, false, true),
        ('mosque',     'E2E Mosquée Test',    'e2e-mosquee-test',    '2 rue e2e, Paris', 4,
         ST_SetSRID(ST_MakePoint(2.3530, 48.8570), 4326)::geography, null, false, true),
        ('restaurant', 'E2E Resto Alcool',    'e2e-resto-alcool',    '3 rue e2e, Paris', 1,
         ST_SetSRID(ST_MakePoint(2.3525, 48.8568), 4326)::geography, null, true,  true),
        ('activity',   'E2E Non Published',   'e2e-non-published',   '4 rue e2e, Paris', 2,
         ST_SetSRID(ST_MakePoint(2.3520, 48.8565), 4326)::geography, null, false, false),
        ('restaurant', 'E2E Loin',            'e2e-resto-loin',      '5 av. e2e, Paris', 18,
         ST_SetSRID(ST_MakePoint(2.3488, 48.8924), 4326)::geography, 2, false, true)
      RETURNING id
    `)) as { id: string }[];

    insertedIds = rows.map((r) => r.id);
  });

  afterAll(async () => {
    if (insertedIds.length) {
      await placesRepo.query(
        `DELETE FROM places WHERE id = ANY($1::uuid[])`,
        [insertedIds],
      );
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

  // ── validation ───────────────────────────────────────────────────────────

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
});
