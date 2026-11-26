import { EXTRA_LOSS_FIELDS } from './losses.js';

// A sorting shift has no production time, output, production labor or stops.
// The opening is entirely outside required production time. This representation
// also keeps SQL metrics neutral on databases already using sorting_hours.
export function isSortingOnly(row) {
  return Number(row.sorting_hours) > 0 && Number(row.opening_min) > 0 &&
    Number(row.planned_min) === Number(row.opening_min) &&
    ['good_qty', 'startup_rejects', 'production_rejects', 'labor_hours',
      'breakdown_min', 'startup_min', 'changeover_min', ...EXTRA_LOSS_FIELDS]
      .every(key => Number(row[key] ?? 0) === 0) &&
    !(Number(row.planned_qty) > 0) &&
    !(Number(row.operator_count) * Number(row.labor_duration_hours) > 0) && !row.timeline_complete;
}

export function sortingRecord(row) {
  return {
    ...row,
    ...Object.fromEntries([...EXTRA_LOSS_FIELDS, 'breakdown_min', 'startup_min',
      'changeover_min', 'good_qty', 'startup_rejects', 'production_rejects', 'labor_hours'].map(key => [key, 0])),
    planned_min: row.opening_min, planned_qty: null,
    operator_count: null, labor_duration_hours: null,
    timeline_complete: false, stop_events: [],
  };
}

