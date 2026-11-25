/**
 * Horaires d'ouverture d'un lieu, stockés en JSONB sur `Place.opening_hours`.
 *
 * - Une entrée par jour de la semaine (`mon`…`sun`), chacune contenant zéro,
 *   un ou plusieurs créneaux `{ open, close }` au format `HH:MM` (24 h).
 *   Un jour absent ou à `[]` = fermé ce jour-là.
 * - `exceptions` : fermetures/ouvertures exceptionnelles à une date précise
 *   (jour férié, congés…), qui priment sur l'horaire hebdomadaire.
 */
export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEK_DAYS: readonly WeekDay[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

export interface TimeSlot {
  /** Heure d'ouverture, format `HH:MM` (ex. `09:00`). */
  open: string;
  /** Heure de fermeture, format `HH:MM` (ex. `22:30`). */
  close: string;
}

export interface OpeningHoursException {
  /** Date concernée, format ISO `YYYY-MM-DD`. */
  date: string;
  /** `true` = fermé toute la journée. */
  closed: boolean;
  /** Créneaux applicables ce jour-là si `closed` est `false`. */
  slots?: TimeSlot[];
}

export type OpeningHours = Partial<Record<WeekDay, TimeSlot[]>> & {
  exceptions?: OpeningHoursException[];
};

/** `HH:MM` sur 24 h, `00:00`–`23:59`. */
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
