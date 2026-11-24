import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarWeekLabel } from '../src/calendar-week.js';

test('Les semaines suivent le calendrier ISO de l’année et commencent le lundi', () => {
  assert.equal(calendarWeekLabel('2026-10-12'), 'W42');
  assert.equal(calendarWeekLabel('2026-10-18'), 'W42');
  assert.equal(calendarWeekLabel('2026-10-19'), 'W43');
  assert.equal(calendarWeekLabel('2026-11-24'), 'W48');
});

test('Les semaines aux changements de mois et d’année conservent leur numéro réel', () => {
  assert.equal(calendarWeekLabel('2026-09-28'), 'W40');
  assert.equal(calendarWeekLabel('2026-10-01'), 'W40');
  assert.equal(calendarWeekLabel('2021-01-01'), 'W53');
  assert.equal(calendarWeekLabel('2021-01-04'), 'W01');
  assert.equal(calendarWeekLabel('2024-12-30'), 'W01');
  assert.equal(calendarWeekLabel('2027-01-01'), 'W53');
});
