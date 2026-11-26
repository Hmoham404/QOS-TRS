import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPeriod } from '../src/report-period.js';

test('Le rapport suit les jours, les semaines lundi–dimanche et les changements d’année', () => {
  assert.deepEqual(reportPeriod('day', '2026-11-26'), { from: '2026-11-26', to: '2026-11-26' });
  assert.deepEqual(reportPeriod('week', '2027-01-01'), { from: '2026-12-28', to: '2027-01-03' });
  assert.deepEqual(reportPeriod('week', '2026-11-29'), { from: '2026-11-23', to: '2026-11-29' });
});

test('Un mois civil comprend tous ses jours, y compris février bissextile', () => {
  for (const [reference, to] of [['2026-11-26', '2026-11-30'], ['2026-12-15', '2026-12-31'], ['2026-02-15', '2026-02-28'], ['2028-02-15', '2028-02-29']]) {
    assert.deepEqual(reportPeriod('month', reference), { from: `${reference.slice(0, 7)}-01`, to });
  }
  assert.throws(() => reportPeriod('month', '2026-02-30'));
});
