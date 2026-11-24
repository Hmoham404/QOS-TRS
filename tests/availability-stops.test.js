import test from 'node:test';
import assert from 'node:assert/strict';
import { availabilityStops } from '../src/availability-stops.js';

const row = overrides => ({ opening_min: 480, planned_min: 60, good_qty: 100, startup_rejects: 0, production_rejects: 0, cycle_seconds: 60, standard_seconds: 30, labor_hours: 8, ...overrides });
const rows = [
  row({ date: '2026-10-01', breakdown_min: 20, startup_min: 10 }),
  row({ date: '2026-10-08', breakdown_min: 5, startup_min: 5 }),
  row({ date: '2026-10-09', breakdown_min: 50 }),
  row({ date: '2026-11-01', breakdown_min: 200 }),
];

test('Les détails reprennent uniquement le jour, la semaine ou le mois sélectionné, hors arrêts planifiés', () => {
  const day = availabilityStops(rows, { start: '2026-10-08', end: '2026-10-08' });
  assert.equal(day.count, 1);
  assert.equal(day.total, 10);
  assert.equal(day.availability, 410 / 420);
  assert.equal(day.items.at(-1).cumulative, 100);
  assert.equal(day.items.reduce((sum, item) => sum + item.share, 0), 100);
  assert.equal(availabilityStops(rows, { start: '2026-10-05', end: '2026-10-11' }).total, 60);
  assert.equal(availabilityStops(rows, { start: '2026-10-01', end: '2026-10-31' }).total, 90);
  assert.ok(day.items.every(item => item.category !== 'planned'));
});

test('Les périodes sans arrêts et les causes propres aux ateliers restent exactes', () => {
  const empty = availabilityStops(rows, { start: '2026-09-01', end: '2026-09-30' });
  assert.equal(empty.availability, null);
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.items, []);
  const running = availabilityStops([row({ date: '2026-10-08' })], { start: '2026-10-08', end: '2026-10-08' });
  assert.equal(running.availability, 1);
  assert.equal(running.total, 0);
  const welding = availabilityStops([row({ date: '2026-10-08', department: 'welding', material_shortage_min: 15 })], { start: '2026-10-08', end: '2026-10-08' });
  assert.equal(welding.items[0].label, 'Rupture SFIN');
  assert.equal(welding.total, 15);
});
