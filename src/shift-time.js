// Each record keeps its own opening and planned minutes. Preferences are only
// used to initialise a new entry, never to recalculate saved production.
export const SHIFT_BREAK_FIELDS = ['pause_min', 'meeting_min', 'five_s_min'];
export const DEFAULT_SHIFT_TIME = {shift_duration_min: 480, opening_min: 450, planned_min: 0, pause_min: 20, meeting_min: 5, five_s_min: 5};
export const hasShiftBreakdown = r => r.shift_duration_min != null && SHIFT_BREAK_FIELDS.every(key => r[key] != null);
export const plannedBreakMinutes = r => SHIFT_BREAK_FIELDS.reduce((sum, key) => sum + Number(r[key]), 0);
export const shiftOpeningMinutes = r => Math.round((Number(r.shift_duration_min) - plannedBreakMinutes(r)) * 1000000) / 1000000;
export function shiftTimeErrors(r) {
  // Older records have no gross shift duration. Keep their saved totals intact.
  if (r.shift_duration_min == null) return [];
  if (!hasShiftBreakdown(r) || SHIFT_BREAK_FIELDS.some(key => !Number.isFinite(r[key]) || r[key] < 0))
    return ['Les durées de pause, réunion et 5S doivent être des nombres positifs ou nuls.'];
  if (!Number.isFinite(r.shift_duration_min) || r.shift_duration_min <= 0 || r.shift_duration_min > 1440 || Math.abs(shiftOpeningMinutes(r) - r.opening_min) > 0.000001)
    return ['Le temps d’ouverture doit correspondre à la durée du poste moins la pause, la réunion et le 5S.'];
  return [];
}
const preferenceKey = scope => `qos-shift-time-v2:${encodeURIComponent(scope)}`;
export function readShiftTime(scope, storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(preferenceKey(scope)));
    if (value && hasShiftBreakdown(value) && !shiftTimeErrors(value).length && value.opening_min > 0 && value.opening_min <= 1440)
      return {...DEFAULT_SHIFT_TIME, ...value, planned_min: 0};
  } catch { /* Defaults remain usable without browser storage. */ }
  return {...DEFAULT_SHIFT_TIME};
}
export function rememberShiftTime(scope, r, storage = localStorage) {
  if (!hasShiftBreakdown(r) || shiftTimeErrors(r).length) return;
  const value = Object.fromEntries(['shift_duration_min', 'opening_min', ...SHIFT_BREAK_FIELDS].map(key => [key, r[key]]));
  storage.setItem(preferenceKey(scope), JSON.stringify(value));
}
