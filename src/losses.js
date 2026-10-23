import { t as translate } from './i18n.js';

// One catalog for entry, journals, calculations and exports. Stored keys stay stable.
const definitions = [
  ['staffing', 'staffing_min', "Manque d'effectif", '#8b78bd'],
  ['mold', 'mold_breakdown_min', 'Panne moule', '#c27852'],
  ['breakdown', 'breakdown_min', 'Panne machine', '#dd7179'],
  ['peripherals', 'peripherals_min', 'Manque périphériques', '#ba9b4e'],
  ['material', 'material_shortage_min', 'Rupture MP', '#d69153'],
  ['quality_stop', 'quality_stop_min', 'Problème qualité', '#a569a3'],
  ['power', 'power_cut_min', "Coupure d'énergie", '#607fad'],
  ['adjustment', 'adjustment_min', 'Réglage', '#448fba'],
  ['other', 'other_loss_min', 'Autres pertes', '#87969c'],
  ['startup', 'startup_min', 'Démarrage / arrêt', '#347bea'],
  ['changeover', 'changeover_min', 'Changement de moule', '#36b4cf'],
  ['planned', 'planned_min', 'Arrêt planifié', '#92a4b6'],
];
export const STOP_TYPES = Object.fromEntries(definitions.map(([key, field, source, color]) => [key, {
  field, source, color, get label() { return translate(source); },
}]));
export const UNPLANNED_TYPES = Object.entries(STOP_TYPES).filter(([key]) => key !== 'planned');
export const EXTRA_LOSS_FIELDS = UNPLANNED_TYPES.map(([, type]) => type.field).filter(field => !['breakdown_min', 'startup_min', 'changeover_min'].includes(field));
export const extraLossDefaults = () => Object.fromEntries(EXTRA_LOSS_FIELDS.map(field => [field, 0]));
export const unplannedMinutes = row => UNPLANNED_TYPES.reduce((sum, [, type]) => sum + (Number(row[type.field]) || 0), 0);
