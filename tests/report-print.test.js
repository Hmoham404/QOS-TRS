import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPrintHtml } from '../src/report-print.js';

test('Impression : absence distincte de zéro, articles non saisis exclus et totaux invalides masqués', () => {
  const options={mode:'day',period:{from:'2026-11-26',to:'2026-11-26'},pointage:'8'};
  const emptyLine={department:'injection',name:'Article sans relevé',code:'ABSENT',cycle:5,count:0,quantity:0,seconds:0};
  const empty=reportPrintHtml({...options,report:{hours:0,count:0,lines:[emptyLine]}});
  assert.ok(empty.includes('Aucun relevé pour cette période.'));
  assert.ok(!empty.includes('Article sans relevé'));
  assert.ok(!empty.includes('0,00 h'));
  assert.ok(empty.includes('<strong>—</strong>'));
  const zeroLine={...emptyLine,name:'Arrêt déclaré',count:1};
  const zero=reportPrintHtml({...options,report:{hours:0,count:1,lines:[emptyLine,zeroLine]}});
  assert.ok(zero.includes('0,00 h'));
  assert.ok(zero.includes('0,0 %'));
  assert.ok(!zero.includes('Article sans relevé'));
  assert.ok(zero.includes('Arrêt déclaré'));
  const invalid=reportPrintHtml({...options,report:{hours:null,count:1,invalid:true,lines:[{...zeroLine,invalid:true}]}});
  assert.ok(!invalid.includes('0,00 h'));
  const partial=reportPrintHtml({...options,pointage:'8',pointageInfo:{source:'rh',complete:false},report:{hours:4,count:1,lines:[{...zeroLine,quantity:100,seconds:14400}]}});
  assert.ok(partial.includes('Pointage RH incomplet'));
  assert.ok(!partial.includes('50,0 %'));
});

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
