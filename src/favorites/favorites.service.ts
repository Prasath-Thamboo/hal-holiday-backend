import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from '../places/entities/place.entity';
import { Favorite } from './entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoritesRepo: Repository<Favorite>,
    @InjectRepository(Place)
    private readonly placesRepo: Repository<Place>,
  ) {}

  async add(userId: string, placeId: string): Promise<void> {
    const place = await this.placesRepo.findOne({ where: { id: placeId } });
    if (!place) throw new NotFoundException(`Place ${placeId} not found`);

    await this.favoritesRepo.query(
      `INSERT INTO favorites (user_id, place_id) VALUES ($1, $2)
       ON CONFLICT (user_id, place_id) DO NOTHING`,
      [userId, placeId],
    );
  }

  async remove(userId: string, placeId: string): Promise<void> {
    await this.favoritesRepo.delete({ userId, placeId });
  }

  async listIds(userId: string): Promise<string[]> {
    const rows = await this.favoritesRepo.find({
      where: { userId },
      select: ['placeId'],
    });
    return rows.map((r) => r.placeId);
  }

  async listPlaces(userId: string): Promise<Place[]> {
    return this.placesRepo.query(
      `SELECT p.*,
              ST_X(p.location::geometry) AS longitude,
              ST_Y(p.location::geometry) AS latitude
       FROM places p
       INNER JOIN favorites f ON f.place_id = p.id
       WHERE f.user_id = $1 AND p.published = true
       ORDER BY f.created_at DESC`,
      [userId],
    ) as Promise<Place[]>;
  }
}
