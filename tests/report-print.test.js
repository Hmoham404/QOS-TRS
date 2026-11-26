import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPrintHtml } from '../src/report-print.js';

test('Le document imprimable conserve les quantités, les TC et la période, et protège les noms saisis', () => {
  const html = reportPrintHtml({
    mode:'month', period:{from:'2026-11-01',to:'2026-11-30'}, pointage:'2,5',
    report:{hours:5,count:1,lines:[{department:'injection', name:'Base <script>malveillant</script>', code:'A&B', cycle:5,quantity:3600,seconds:18000,count:1}]},
  });
  assert.ok(html.includes('01 novembre 2026 - 30 novembre 2026'));
  assert.ok(html.includes('200,0 %'));
  assert.ok(html.includes('3 600'));
  assert.ok(html.includes('5,000'));
  assert.ok(html.includes('Base &lt;script&gt;malveillant&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('A&amp;B'));
});
