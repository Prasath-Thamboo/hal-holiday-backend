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
 * E2E for the self-service account routes (`/users/me/*`, Phase 4).
 *
 * Prerequisites: docker compose up (PostGIS reachable).
 * Creates its own user + fixture place and cleans everything up.
 */
describe('Account endpoints /users/me (e2e)', () => {
  let app: INestApplication;
  let usersRepo: Repository<User>;
  let placesRepo: Repository<Place>;

  const EMAIL = 'e2e-me@halholiday.fr';
  const PASSWORD = 'E2eMePass123!';
  let userId: string;
  let placeId: string;
  let tripId: string;
  let token: string;

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

    usersRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));
    placesRepo = moduleRef.get<Repository<Place>>(getRepositoryToken(Place));

    await usersRepo.query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
    await placesRepo.query(`DELETE FROM places WHERE slug = 'e2e-me-fav'`);

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await usersRepo.save(
      usersRepo.create({ email: EMAIL, passwordHash, role: UserRole.USER }),
    );
    userId = user.id;

    const rows = (await placesRepo.query(`
      INSERT INTO places (type, name, slug, address, arrondissement, location, published)
      VALUES ('restaurant', 'E2E Me Fav', 'e2e-me-fav', '1 rue e2e, Paris', 1,
              ST_SetSRID(ST_MakePoint(2.3522, 48.8566), 4326)::geography, true)
      RETURNING id
    `)) as { id: string }[];
    placeId = rows[0].id;

    await usersRepo.query(
      `INSERT INTO favorites (user_id, place_id) VALUES ($1, $2)`,
      [userId, placeId],
    );

    const tripRows = (await usersRepo.query(
      `INSERT INTO trips (user_id, title, start_date, end_date)
       VALUES ($1, 'E2E Me Trip', '2026-05-01', '2026-05-03')
       RETURNING id`,
      [userId],
    )) as { id: string }[];
    tripId = tripRows[0].id;

    await usersRepo.query(
      `INSERT INTO trip_items (trip_id, place_id, date, slot, time, position, note)
       VALUES ($1, $2, '2026-05-01', 'midi', '12:30', 0, 'déjeuner')`,
      [tripId, placeId],
    );

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    token = (loginRes.body as { access_token: string }).access_token;
  });

  afterAll(async () => {
    await usersRepo.query(`DELETE FROM users WHERE email = $1`, [EMAIL]);
    await placesRepo.query(`DELETE FROM places WHERE slug = 'e2e-me-fav'`);
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  // ── auth guard ──────────────────────────────────────────────────────────

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app.getHttpServer()).get('/users/me/export');
    expect(res.status).toBe(401);
  });

  // ── GET /users/me/export ────────────────────────────────────────────────

  it('exports the profile (no password hash), the favorites and the trips', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/export')
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.exported_at).toBeDefined();
    expect(res.body.profile).toBeDefined();
    expect(res.body.profile).not.toHaveProperty('passwordHash');
    expect(Array.isArray(res.body.favorites)).toBe(true);
    expect(res.body.favorites).toHaveLength(1);
    expect(res.body.favorites[0]).toMatchObject({ slug: 'e2e-me-fav' });

    expect(Array.isArray(res.body.trips)).toBe(true);
    expect(res.body.trips).toHaveLength(1);
    expect(res.body.trips[0]).toMatchObject({
      title: 'E2E Me Trip',
      start_date: '2026-05-01',
      end_date: '2026-05-03',
    });
    expect(res.body.trips[0].items).toHaveLength(1);
    expect(res.body.trips[0].items[0]).toMatchObject({
      date: '2026-05-01',
      slot: 'midi',
      time: '12:30',
      note: 'déjeuner',
      place: { slug: 'e2e-me-fav' },
    });
  });

  // ── PATCH /users/me/preferences ─────────────────────────────────────────

  it('rejects halalStrictnessPreference out of range (400)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me/preferences')
      .set(auth())
      .send({ halalStrictnessPreference: 5 });
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported language (400)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me/preferences')
      .set(auth())
      .send({ language: 'de' });
    expect(res.status).toBe(400);
  });

  it('updates language + halal strictness (200)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me/preferences')
      .set(auth())
      .send({ language: 'en', halalStrictnessPreference: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ language: 'en', halalStrictnessPreference: 3 });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  // ── PATCH /users/me/phone ───────────────────────────────────────────────

  it('rejects a malformed phone number (400)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me/phone')
      .set(auth())
      .send({ phoneNumber: 'not-a-number' });
    expect(res.status).toBe(400);
  });

  it('sets a valid phone number (200)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me/phone')
      .set(auth())
      .send({ phoneNumber: '+33612345678' });
    expect(res.status).toBe(200);
    expect(res.body.phoneNumber).toBe('+33612345678');
  });

  // ── PATCH /users/me/password ────────────────────────────────────────────

  it('rejects a too-short new password (400)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me/password')
      .set(auth())
      .send({ currentPassword: PASSWORD, newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects a wrong current password (401)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me/password')
      .set(auth())
      .send({ currentPassword: 'wrong-password', newPassword: 'longenough123' });
    expect(res.status).toBe(401);
  });

  // ── PATCH /users/me/email ───────────────────────────────────────────────

  it('rejects an invalid email (400)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me/email')
      .set(auth())
      .send({ newEmail: 'not-an-email', password: PASSWORD });
    expect(res.status).toBe(400);
  });

  it('rejects an email change with a wrong password (401)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me/email')
      .set(auth())
      .send({ newEmail: 'e2e-me-moved@halholiday.fr', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  // ── DELETE /users/me (must run last) ────────────────────────────────────

  it('rejects account deletion with a wrong password (401)', async () => {
    const res = await request(app.getHttpServer())
      .delete('/users/me')
      .set(auth())
      .send({ password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('deletes the account and cascades the favorites + trips (204)', async () => {
    const res = await request(app.getHttpServer())
      .delete('/users/me')
      .set(auth())
      .send({ password: PASSWORD });
    expect(res.status).toBe(204);

    const users = (await usersRepo.query(`SELECT id FROM users WHERE id = $1`, [
      userId,
    ])) as unknown[];
    expect(users).toHaveLength(0);

    const favs = (await usersRepo.query(
      `SELECT id FROM favorites WHERE user_id = $1`,
      [userId],
    )) as unknown[];
    expect(favs).toHaveLength(0);

    const trips = (await usersRepo.query(
      `SELECT id FROM trips WHERE user_id = $1`,
      [userId],
    )) as unknown[];
    expect(trips).toHaveLength(0);

    const items = (await usersRepo.query(
      `SELECT id FROM trip_items WHERE trip_id = $1`,
      [tripId],
    )) as unknown[];
    expect(items).toHaveLength(0);
  });
});
