import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from '../src/domain.js';
import { curveSeries, planningRate, trsLosses } from '../src/curves.js';

const row = overrides => ({ date: '2026-10-01', press_id: 'a', opening_min: 120, planned_min: 20, breakdown_min: 10, startup_min: 5, changeover_min: 5, good_qty: 60, startup_rejects: 5, production_rejects: 5, cycle_seconds: 60, standard_seconds: 30, labor_hours: 2, ...overrides });

test('Le planning compare les mêmes relevés, distingue zéro et absence et garde les taux > 100 %', () => {
  const rows = [row({ good_qty: 120, planned_qty: 100 }), row({ good_qty: 500 }), row({ good_qty: 10, planned_qty: 0 }), row({ good_qty: 40, planned_qty: null })];
  assert.deepEqual(planningRate(rows), { actual: 130, planned: 100, count: 2, missing: 2, rate: 1.3 });
  assert.equal(planningRate([row({ planned_qty: 0 })]).rate, null);
  assert.equal(planningRate([]).rate, null);
});

test('Les pertes du TRS reconstituent le temps requis avec cadence et rebuts, hors pauses planifiées', () => {
  const r = row({});
  const loss = trsLosses([r]);
  assert.deepEqual(['breakdown', 'startup', 'changeover', 'speed', 'quality'].map(key => loss.items.find(item => item.key === key).minutes), [10, 5, 5, 10, 10]);
  assert.equal(loss.total, 40);
  assert.equal(loss.speedGain, 0);
  assert.equal(loss.total + aggregate([r]).goodIdeal / 60, 100);
  assert.ok(Math.abs(loss.items.reduce((sum, item) => sum + item.share, 0) - 1) < 1e-12);
});

test('Les surperformances restent séparées des pertes positives, sans parts négatives', () => {
  const rows = [row({}), row({ good_qty: 100, startup_rejects: 0, production_rejects: 0 })];
  const loss = trsLosses(rows);
  const totals = aggregate(rows);
  assert.equal(loss.speedGain, 20);
  assert.equal(loss.items.find(item => item.key === 'speed').minutes, 10);
  assert.ok(loss.items.every(item => item.minutes >= 0));
  assert.equal(totals.goodIdeal / 60 + loss.total - loss.speedGain, totals.required);
  assert.equal(trsLosses([]).total, 0);
});

test('Les courbes pondèrent les taux et affichent uniquement les jours saisis du périmètre', () => {
  const rows = [row({ planned_qty: 100 }), row({ press_id: 'b', good_qty: 100, opening_min: 220, planned_qty: 200 }), row({ date: '2026-10-03', planned_min: 120, breakdown_min: 0, startup_min: 0, changeover_min: 0, good_qty: 0, startup_rejects: 0, production_rejects: 0, labor_hours: 0 })];
  const presses = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', active: false }, { id: 'c', name: 'C' }];
  const { days, machines } = curveSeries(rows, presses);
  assert.deepEqual(machines.map(machine => machine.id), ['a', 'b']);
  assert.equal(days.length, 2);
  assert.equal(days[0].trs, 160 / 300);
  assert.ok(Math.abs(days[0].dle - (160 * 30 / 3600) / 4) < 1e-12);
  assert.equal(days[0].planning, 160 / 300);
  assert.equal(days[0].press_a, 0.6);
  assert.equal(days[0].press_b, 0.5);
  assert.equal(days[1].date, '2026-10-03');
  for (const key of ['trs', 'dle', 'planning', 'press_a', 'press_b']) assert.equal(days[1][key], null);
  const filtered = curveSeries(rows.filter(r => r.press_id === 'b'), presses);
  assert.equal(filtered.machines.length, 1);
  assert.deepEqual(filtered.days.map(day => day.date), ['2026-10-01']);
  assert.deepEqual(curveSeries([], presses), { days: [], machines: [] });
});

test('Un dimanche de repos est absent ; un dimanche saisi reste affiché, même avec un TRS nul', () => {
  const presses = [{ id: 'a', name: 'A' }];
  const rows = [row({ date: '2026-10-05' }), row({ date: '2026-10-03' })];
  assert.deepEqual(curveSeries(rows, presses).days.map(day => day.date), ['2026-10-03', '2026-10-05']);
  const sunday = row({ date: '2026-10-04', good_qty: 0, startup_rejects: 0, production_rejects: 0 });
  const { days } = curveSeries([...rows, sunday], presses);
  assert.deepEqual(days.map(day => day.date), ['2026-10-03', '2026-10-04', '2026-10-05']);
  assert.equal(days[1].trs, 0);
  assert.equal(days[1].press_a, 0);
});
