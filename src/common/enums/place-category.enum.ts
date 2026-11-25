/**
 * Sous-catégorie d'un lieu de type `activity`, pour distinguer sur la carte
 * les lieux touristiques (musées, monuments…) des lieux de divertissement
 * (hammams, salons de thé, librairies…). `null` pour les autres types.
 */
export enum PlaceCategory {
  TOURISTIQUE = 'touristique',
  DIVERTISSEMENT = 'divertissement',
}
