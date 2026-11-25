/**
 * Créneau d'une journée de séjour. Sert au regroupement et au tri des lieux
 * planifiés ; une heure précise (`time`) reste optionnelle sur chaque item.
 */
export enum TripSlot {
  MATIN = 'matin',
  MIDI = 'midi',
  APRES_MIDI = 'apres_midi',
  SOIR = 'soir',
}

/** Ordre chronologique des créneaux, pour trier les items d'une journée. */
export const TRIP_SLOT_ORDER: Record<TripSlot, number> = {
  [TripSlot.MATIN]: 0,
  [TripSlot.MIDI]: 1,
  [TripSlot.APRES_MIDI]: 2,
  [TripSlot.SOIR]: 3,
};

export const TRIP_SLOTS: readonly TripSlot[] = [
  TripSlot.MATIN,
  TripSlot.MIDI,
  TripSlot.APRES_MIDI,
  TripSlot.SOIR,
];
