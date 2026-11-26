import test from 'node:test';
import assert from 'node:assert/strict';
import { productionReport, reportDle } from '../src/production-report.js';

test('Le temps délivré utilise les conformes et chaque TC historique par pièce, indépendamment des standards MOD', () => {
  const report = productionReport([{
    department: 'injection', articles: [{ id: 'base', name: 'Base', code: 'B', mold_cycle_seconds: 40, cavities: 8 }],
    records: [
      { article_id: 'base', date: '2026-11-01', good_qty: 720, cycle_seconds: 5, standard_seconds: 200 },
      { article_id: 'base', date: '2026-11-30', good_qty: 360, cycle_seconds: 10, standard_seconds: 300 },
      { article_id: 'base', date: '2026-12-01', good_qty: 999, cycle_seconds: 5 },
    ],
  }, { department: 'welding', articles: [], records: [{ article_id: 'weld', date: '2026-11-15', good_qty: 600, cycle_seconds: 6 }] }], '2026-11-01', '2026-11-30');
  assert.equal(report.hours, 3);
  assert.equal(report.count, 3);
  assert.equal(report.lines.length, 3);
  assert.equal(reportDle(report.hours, ''), null);
  assert.equal(reportDle(report.hours, '0'), null);
  assert.equal(reportDle(report.hours, '-1'), null);
  assert.equal(reportDle(report.hours, '1,5'), 2);
});

test('Le rapport ne confond pas absence, zéro production et données invalides', () => {
  const articles = [{ id: 'base', name: 'Base', mold_cycle_seconds: 40, cavities: 8 }];
  const empty = productionReport([{department:'injection', articles, records:[]}], '2026-11-01', '2026-11-30');
  assert.equal(empty.count, 0);
  assert.equal(empty.lines[0].cycle, 5);
  const zero = productionReport([{department:'injection', articles, records:[{article_id:'base', date:'2026-11-15', good_qty:0, cycle_seconds:5}]}], '2026-11-01', '2026-11-30');
  assert.equal(zero.count, 1);
  assert.equal(reportDle(zero.hours,'8'), 0);
  const invalid = productionReport([{department:'injection', articles, records:[{article_id:'base', date:'2026-11-15', good_qty:10, cycle_seconds:null}]}], '2026-11-01', '2026-11-30');
  assert.equal(invalid.invalid,true);
  assert.equal(invalid.hours,null);
});
