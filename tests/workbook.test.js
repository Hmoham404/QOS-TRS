import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));
const book=JSON.parse(readFileSync(new URL('../docs/workbook-analysis.json',import.meta.url),'utf8'));
const cells=Object.fromEntries(book.sheets.find(s=>s.name==='Saisie_Donnees').cells.map(c=>[c.cell,c.value]));

test('Toutes les saisies, références et dates des 63 lignes sont préservées',()=>{
 for(const r of seed.records){
  const n=r.source_row,a=seed.articles.find(a=>a.id===r.article_id),p=seed.presses.find(p=>p.id===r.press_id);
  assert.equal(new Date(Date.UTC(1899,11,30)+Number(cells['A'+n])*86400000).toISOString().slice(0,10),r.date);
  assert.equal(cells['B'+n],r.shift);assert.equal(cells['C'+n],p.name);assert.equal(cells['D'+n],a.code);assert.equal(cells['E'+n],a.name);
  for(const [key,col] of Object.entries({opening_min:'F',planned_min:'G',breakdown_min:'I',startup_min:'J',changeover_min:'K',good_qty:'N',startup_rejects:'O',production_rejects:'P',labor_hours:'W'}))assert.equal(r[key],Number(cells[col+n]),`${col}${n}: ${key}`);
  assert.ok(Math.abs(r.cycle_seconds-Number(cells['Q'+n]))<1e-10,`Q${n}`);
  assert.ok(Math.abs(r.standard_seconds-Number(cells['V'+n]))<1e-10,`V${n}`);
 }
});
