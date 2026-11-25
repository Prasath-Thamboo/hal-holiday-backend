import { types } from 'pg';

/**
 * Par défaut, `pg` convertit les colonnes PostgreSQL `date` en objets `Date`
 * JavaScript à minuit **heure locale**, ce qui provoque un décalage d'un jour
 * dès qu'on sérialise en UTC (`toISOString`). Nos dates de séjour n'ont pas de
 * fuseau : on les garde telles quelles, en chaîne `YYYY-MM-DD`.
 *
 * OID 1082 = `date`. (Les `timestamptz`, OID 1184, ne sont pas touchés.)
 */
types.setTypeParser(1082, (value: string) => value);
