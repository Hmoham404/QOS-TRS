import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculate, aggregate, validateRecord } from '../src/domain.js';
const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));
const workbook=JSON.parse(readFileSync(new URL('../docs/workbook-analysis.json',import.meta.url),'utf8'));
const cells=Object.fromEntries(workbook.sheets.find(s=>s.name==='Saisie_Donnees').cells.map(c=>[c.cell,c.value]));
test('Les 63 relevés reprennent les résultats Excel, y compris les postes sans production',()=>{
  assert.equal(seed.records.length,63);
  for(const r of seed.records){assert.deepEqual(validateRecord(r),[]);const c=calculate(r);for(const [field,col] of Object.entries({required:'H',runtime:'L',total:'M',availability:'R',performance:'S',quality:'T',trs:'U',earned:'X',dle:'Y'})){const value=cells[col+r.source_row];if(value==null)assert.equal(c[field],null,`${col}${r.source_row}`);else assert.ok(Math.abs(c[field]-Number(value))<1e-10,`${col}${r.source_row}: ${c[field]} != ${value}`);}}
});
test('Les cycles sont divisés par les empreintes',()=>{assert.equal(seed.articles[0].mold_cycle_seconds/seed.articles[0].cavities,4.875);});
test('La synthèse pondère les temps et préserve les performances supérieures à 100 %',()=>{
 const a={...seed.records[3],opening_min:60,planned_min:0,breakdown_min:0,startup_min:0,changeover_min:0,good_qty:3600,startup_rejects:0,production_rejects:0,cycle_seconds:1,standard_seconds:1,labor_hours:1};
 const b={...a,opening_min:180,good_qty:3600,labor_hours:3};
 assert.equal(aggregate([a,b]).trs,.5);assert.equal(aggregate([a,b]).dle,.5);
 assert.equal(calculate({...a,good_qty:7200}).performance,2);
 assert.equal(aggregate([]).trs,null);assert.equal(aggregate([]).quality,null);
});
test('Les durées impossibles et les quantités invalides sont bloquées',()=>{
 const a=seed.records[3];assert.ok(validateRecord({...a,planned_min:500}).length);assert.ok(validateRecord({...a,good_qty:-1}).length);assert.ok(validateRecord({...a,good_qty:1.2}).length);assert.ok(validateRecord({...a,good_qty:NaN}).length);assert.ok(validateRecord({...a,date:'2026-02-31'}).length);assert.ok(validateRecord({...a,date:''}).length);assert.ok(validateRecord({...a,opening_min:0}).length);assert.ok(validateRecord({...a,planned_min:480,startup_min:0}).length);
});
test('Un poste requis sans production donne un TRS nul, une fermeture donne un TRS non calculable',()=>{
 const a={...seed.records[0],planned_min:0};assert.equal(calculate(a).trs,0);assert.equal(calculate(a).quality,null);assert.equal(calculate(seed.records[0]).trs,null);
});
