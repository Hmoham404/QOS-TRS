import { buildPareto } from './analytics.js';
import { aggregate } from './domain.js';

export function availabilityStops(rows, period) {
  const selected = rows.filter(row => row.date >= period.start && row.date <= period.end);
  return { ...buildPareto(selected), count: selected.length, availability: aggregate(selected).availability };
}
