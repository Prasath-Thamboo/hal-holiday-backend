# Hal-Holiday API

Backend NestJS pour la découverte de lieux halal à Paris (restaurants, mosquées, activités sans alcool).

**Stack** : NestJS · TypeORM · PostgreSQL 16 + PostGIS 3.4 · TypeScript strict

---

## Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 20+](https://nodejs.org/)

---

## Démarrage rapide

### 1. Variables d'environnement

```bash
cp .env.example .env
# Éditez .env si vous souhaitez changer le mot de passe ou le port
```

### 2. Base de données (PostGIS via Docker)

```bash
docker compose up -d
# Attend que Postgres soit healthy (~10 s)
docker compose ps
```

### 3. Dépendances Node

```bash
npm install
```

### 4. Migrations

```bash
npm run migration:run
```

Cela crée :
- l'extension `postgis`
- le type `place_type` (enum)
- la table `places` avec index GIST sur `location` et index BTree sur `arrondissement`

### 5. Seed (données de test)

```bash
npm run seed
```

Insère ~15 lieux fictifs mais géolocalisés dans différents arrondissements parisiens.

### 6. Démarrage

```bash
npm run start:dev
```

L'API écoute sur [http://localhost:3000](http://localhost:3000)

---

## Documentation Swagger

Accessible sur [http://localhost:3000/docs](http://localhost:3000/docs) dès que l'application tourne.

---

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/places` | Créer un lieu |
| `GET` | `/places` | Lister tous les lieux |
| `GET` | `/places/:id` | Obtenir un lieu par UUID |
| `PATCH` | `/places/:id` | Mettre à jour un lieu |
| `DELETE` | `/places/:id` | Supprimer un lieu |
| `GET` | `/places/nearby` | Lieux publiés dans un rayon, triés par distance |

### GET /places/nearby — paramètres

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `lat` | number | oui | Latitude WGS84 |
| `lng` | number | oui | Longitude WGS84 |
| `radius` | number | non | Rayon en mètres (défaut : 1000, max : 50 000) |
| `types` | string[] | non | Filtrer par type : `restaurant`, `mosque`, `activity` |
| `minHalal` | 1–4 | non | Niveau halal minimum |
| `noAlcohol` | boolean | non | Exclure les lieux servant de l'alcool |

**Exemple :**

```
GET /places/nearby?lat=48.8566&lng=2.3522&radius=2000&types=restaurant&minHalal=2&noAlcohol=true
```

La réponse inclut un champ `distance_m` (distance en mètres calculée côté PostgreSQL via `ST_Distance`).

---

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `APP_PORT` | `3000` | Port de l'application |
| `DB_HOST` | `localhost` | Hôte PostgreSQL |
| `DB_PORT` | `5432` | Port PostgreSQL |
| `DB_USER` | `halholiday` | Utilisateur |
| `DB_PASSWORD` | — | Mot de passe |
| `DB_NAME` | `halholiday` | Nom de la base |

---

## Commandes utiles

```bash
# Générer une nouvelle migration (après modification de l'entity)
npm run migration:generate -- database/migrations/NomDeLaMigration

# Annuler la dernière migration
npm run migration:revert

# Build de production
npm run build && npm run start
```

---

## Niveaux halal

| Niveau | Signification |
|--------|---------------|
| 1 | Déclaratif (auto-déclaré par le gérant) |
| 2 | Validé par la mosquée locale |
| 3 | Certifié par un organisme agréé |
| 4 | 100 % halal (aucun produit porcin ou alcool sur site) |
