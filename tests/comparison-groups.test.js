import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPARISON_GROUPS, METALLIZATION_LINES, comparisonData, withDepartmentLines, metallizationActivity } from '../src/comparison-groups.js';
import { aggregate } from '../src/domain.js';
import { createLocalStore } from '../src/local-data.js';

test('Les trois totaux regroupent les cinq sources sans doublons ni collision de machines', () => {
  const results = Object.fromEntries(['injection', 'welding', 'metallization', 'assembly', 'screen-printing'].map((id, i) => [id, {data: {presses: [{id:'same',name:id}], records:[{id,press_id:'same',good_qty:(i+1)*100,cycle_seconds:1,standard_seconds:1,opening_min:60,planned_min:0,labor_hours:1}]}}]));
  const injection = comparisonData(COMPARISON_GROUPS[0], results);
  assert.equal(injection.pending, false);
  assert.equal(injection.data.records.length, 2);
  assert.equal(new Set(injection.data.presses.map(press => press.id)).size, 2);
  assert.equal(aggregate(injection.data.records).good, 300);
  assert.equal(aggregate(injection.data.records).trs, 300 / 7200);
  assert.deepEqual(comparisonData(COMPARISON_GROUPS[0], results, 'welding').data.records.map(row => row.id), ['welding']);
  assert.equal(aggregate(comparisonData(COMPARISON_GROUPS[2], results).data.records).good, 900);
  assert.equal(COMPARISON_GROUPS.flatMap(group => comparisonData(group, results).data.records).length, 5);
  assert.ok(comparisonData(COMPARISON_GROUPS[0], {injection:results.injection}).pending);
  assert.ok(comparisonData(COMPARISON_GROUPS[0], {injection:results.injection,welding:{error:'indisponible'}}).error);
});

test('Métallisation : trois lignes sélectionnables, aucun historique réaffecté', () => {
  const presses = METALLIZATION_LINES.map(({id,name})=>({id,name}));
  const records = presses.map((press,i)=>({id:String(i),press_id:press.id}));
  const results = {metallization:{data:{presses,records}}};
  for (const [i, activity] of COMPARISON_GROUPS[1].activities.entries()) {
    assert.deepEqual(comparisonData(COMPARISON_GROUPS[1],results,activity.id).data.records.map(row=>row.id),[String(i)]);
  }
  assert.equal(comparisonData(COMPARISON_GROUPS[1],results).data.records.length,3);
  assert.equal(metallizationActivity({name:'Ligne peinture 2'}),'painting');
  assert.equal(metallizationActivity({name:'Support Bosage'}),'bosage');
  assert.equal(metallizationActivity({name:'Vacuum 1'}),'metallization');
});

test('Une base locale existante reçoit les lignes manquantes et garde ses données et archives', () => {
  const old = {department:'metallization',presses:[{id:'custom',name:'Peinture existante',active:false}],articles:[],records:[{id:'historic',press_id:'custom'}]};
  const raw=JSON.stringify(old);
  const store=createLocalStore({}, {getItem:()=>raw});
  const data=store.read('metallization');
  assert.equal(data.presses.length,3);
  assert.deepEqual(data.records,old.records);
  assert.deepEqual(data.presses[0],old.presses[0]);
  assert.equal(withDepartmentLines(data).presses.length,3);
  const decoration=withDepartmentLines({department:'screen-printing',presses:[{id:'old',name:'Ligne Sérigraphie'},{id:'custom',name:'Personnalisée'}]});
  assert.deepEqual(decoration.presses.map(p=>p.name),['Ligne Décoration','Personnalisée']);
});

test('La migration des lignes est rejouable et conserve les identités existantes', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec('create table public.presses(id uuid primary key, name text, active boolean, department text); create unique index presses_name_ci on public.presses(department,lower(name));');
    await db.exec("insert into public.presses values ('70000000-0000-4000-8000-300000000000','Ligne Sérigraphie',true,'screen-printing');");
    const migration=readFileSync(new URL('../supabase/15_department_lines.sql',import.meta.url),'utf8');
    await db.exec(migration); await db.exec(migration);
    const {rows}=await db.query('select * from public.presses order by id');
    assert.equal(rows.length,3);
    assert.equal(rows[2].name,'Ligne Décoration');
    assert.equal(rows[2].id,'70000000-0000-4000-8000-300000000000');
  } finally {await db.close();}
});
