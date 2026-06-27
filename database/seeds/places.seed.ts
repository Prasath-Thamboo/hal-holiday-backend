import 'reflect-metadata';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

import { AppDataSource } from '../datasource';

interface SeedPlace {
  type: 'restaurant' | 'mosque' | 'activity';
  name: string;
  slug: string;
  description: string;
  address: string;
  arrondissement: number;
  lat: number;
  lng: number;
  halal_level: number | null;
  serves_alcohol: boolean;
  prayer_room: boolean;
  published: boolean;
}

const places: SeedPlace[] = [
  // ── Restaurants ────────────────────────────────────────────────────────────
  {
    type: 'restaurant',
    name: 'Le Jardin de Marrakech',
    slug: 'le-jardin-de-marrakech',
    description: 'Cuisine marocaine authentique, tagines et couscous maison.',
    address: '14 rue des Lombards, 75004 Paris',
    arrondissement: 4,
    lat: 48.8604,
    lng: 2.3508,
    halal_level: 3,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
  {
    type: 'restaurant',
    name: 'Istanbul Kebab',
    slug: 'istanbul-kebab',
    description: 'Kebabs et pides turcs, viandes 100% halal certifiées.',
    address: '27 boulevard de Belleville, 75011 Paris',
    arrondissement: 11,
    lat: 48.8665,
    lng: 2.3785,
    halal_level: 4,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
  {
    type: 'restaurant',
    name: 'Café Médina',
    slug: 'cafe-medina',
    description: 'Brunchs et plats tunisiens dans un cadre chaleureux.',
    address: '5 rue de la Roquette, 75011 Paris',
    arrondissement: 11,
    lat: 48.854,
    lng: 2.3714,
    halal_level: 2,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
  {
    type: 'restaurant',
    name: 'Chez Fatoumata',
    slug: 'chez-fatoumata',
    description: 'Cuisine sénégalaise, thiéboudiène et yassa poulet.',
    address: '32 rue Myrha, 75018 Paris',
    arrondissement: 18,
    lat: 48.8882,
    lng: 2.3522,
    halal_level: 3,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
  {
    type: 'restaurant',
    name: 'Bol de Soupe Halal',
    slug: 'bol-de-soupe-halal',
    description: 'Ramen et soupes asiatiques en version halal.',
    address: '88 rue de Charonne, 75011 Paris',
    arrondissement: 11,
    lat: 48.8527,
    lng: 2.3834,
    halal_level: 3,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
  {
    type: 'restaurant',
    name: 'La Palmeraie',
    slug: 'la-palmeraie',
    description: 'Grillades algériennes et mezze dans le 13e.',
    address: '60 avenue d\'Ivry, 75013 Paris',
    arrondissement: 13,
    lat: 48.8274,
    lng: 2.3638,
    halal_level: 3,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
  {
    type: 'restaurant',
    name: 'Saveurs d\'Orient',
    slug: 'saveurs-d-orient',
    description: 'Restaurant libanais, mezze et grillades halal.',
    address: '23 rue du Faubourg Saint-Denis, 75010 Paris',
    arrondissement: 10,
    lat: 48.8708,
    lng: 2.3568,
    halal_level: 2,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
  // ── Mosquées ───────────────────────────────────────────────────────────────
  {
    type: 'mosque',
    name: 'Grande Mosquée de Paris',
    slug: 'grande-mosquee-de-paris',
    description: 'La plus grande et ancienne mosquée de Paris, fondée en 1926.',
    address: '2bis place du Puits de l\'Ermite, 75005 Paris',
    arrondissement: 5,
    lat: 48.8425,
    lng: 2.3535,
    halal_level: null,
    serves_alcohol: false,
    prayer_room: true,
    published: true,
  },
  {
    type: 'mosque',
    name: 'Mosquée Adda\'wa',
    slug: 'mosquee-addawa',
    description: 'Mosquée du 18e arrondissement, prières cinq fois par jour.',
    address: '39 rue de Tanger, 75019 Paris',
    arrondissement: 19,
    lat: 48.8836,
    lng: 2.3719,
    halal_level: null,
    serves_alcohol: false,
    prayer_room: true,
    published: true,
  },
  {
    type: 'mosque',
    name: 'Mosquée de la rue de la Réunion',
    slug: 'mosquee-rue-reunion',
    description: 'Mosquée de quartier dans le 20e, accueil convivial.',
    address: '72 rue de la Réunion, 75020 Paris',
    arrondissement: 20,
    lat: 48.8578,
    lng: 2.3987,
    halal_level: null,
    serves_alcohol: false,
    prayer_room: true,
    published: true,
  },
  {
    type: 'mosque',
    name: 'Mosquée Al-Fath',
    slug: 'mosquee-al-fath',
    description: 'Mosquée moderne, cours de Coran et bibliothèque islamique.',
    address: '53 rue Polonceau, 75018 Paris',
    arrondissement: 18,
    lat: 48.8866,
    lng: 2.3511,
    halal_level: null,
    serves_alcohol: false,
    prayer_room: true,
    published: true,
  },
  // ── Activités ──────────────────────────────────────────────────────────────
  {
    type: 'activity',
    name: 'Hammam de la Mosquée de Paris',
    slug: 'hammam-mosquee-paris',
    description: 'Hammam traditionnel ouvert au public, séances séparées hommes/femmes.',
    address: '39 rue Geoffroy-Saint-Hilaire, 75005 Paris',
    arrondissement: 5,
    lat: 48.8435,
    lng: 2.354,
    halal_level: null,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
  {
    type: 'activity',
    name: 'Salon de thé Andalous',
    slug: 'salon-de-the-andalous',
    description: 'Pâtisseries orientales et thé à la menthe, sans alcool.',
    address: '12 rue de la Goutte d\'Or, 75018 Paris',
    arrondissement: 18,
    lat: 48.8876,
    lng: 2.3572,
    halal_level: null,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
  {
    type: 'activity',
    name: 'Institut du Monde Arabe',
    slug: 'institut-du-monde-arabe',
    description: 'Musée et centre culturel, expositions sur les civilisations arabes.',
    address: '1 rue des Fossés-Saint-Bernard, 75005 Paris',
    arrondissement: 5,
    lat: 48.8513,
    lng: 2.3553,
    halal_level: null,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
  {
    type: 'activity',
    name: 'Librairie Averroès',
    slug: 'librairie-averroes',
    description: 'Librairie islamique, livres en arabe, français et anglais.',
    address: '28 boulevard Barbès, 75018 Paris',
    arrondissement: 18,
    lat: 48.8844,
    lng: 2.3492,
    halal_level: null,
    serves_alcohol: false,
    prayer_room: false,
    published: true,
  },
];

async function seed() {
  await AppDataSource.initialize();
  console.log('Database connection established');

  for (const p of places) {
    await AppDataSource.query(
      `
      INSERT INTO places
        (type, name, slug, description, address, arrondissement, city, location,
         halal_level, serves_alcohol, prayer_room, published)
      VALUES
        ($1, $2, $3, $4, $5, $6, 'Paris',
         ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
         $9, $10, $11, $12)
      ON CONFLICT (slug) DO NOTHING
      `,
      [
        p.type,
        p.name,
        p.slug,
        p.description,
        p.address,
        p.arrondissement,
        p.lng,
        p.lat,
        p.halal_level,
        p.serves_alcohol,
        p.prayer_room,
        p.published,
      ],
    );
    console.log(`  ✓ ${p.name}`);
  }

  console.log(`\nSeed done — ${places.length} places inserted (or skipped if already present).`);
  await AppDataSource.destroy();
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
