import { createLocalStore } from '../src/local-data.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import ExcelJS from 'exceljs';
import { departmentSeed, departmentScope, targetForRows } from '../src/departments.js';
import { calculate, validateRecord } from '../src/domain.js';
import { extraLossDefaults, stopTypesFor } from '../src/losses.js';
import { stopTotals, buildPareto } from '../src/analytics.js';
import { trsLosses } from '../src/curves.js';
import { buildExcelExport } from '../src/excel-export.js';

function record(department, overrides = {}) {
  const data = departmentSeed(department), article = data.articles[0];
  return {
    id: crypto.randomUUID(), department, date: '2026-11-06', shift: 'Matin',
    press_id: data.presses[0].id, article_id: article.id,
    opening_min: 480, planned_min: 0, breakdown_min: 0, startup_min: 0, changeover_min: 0,
    ...extraLossDefaults(), good_qty: 1000, startup_rejects: 0, production_rejects: 0,
    labor_hours: 8, cycle_seconds: article.mold_cycle_seconds, standard_seconds: article.standard_seconds,
    standard_operators: article.standard_operators, trs_target: article.trs_target, dle_target: article.dle_target,
    timeline_complete: false, stop_events: [], shift_start: '06:00', notes: '', source: 'web',
    ...overrides,
  };
}

test('Les catalogues reprennent les paramètres fournis sans historique inventé', () => {
  const metal = departmentSeed('metallization'), screen = departmentSeed('screen-printing'), assembly = departmentSeed('assembly');
  assert.equal(metal.articles.length, 6);
  assert.deepEqual(metal.articles.map(a => [a.code,a.mold_cycle_seconds,a.standard_seconds,a.standard_operators]), [
    ['2.3.30156',.75,22.5,30],['2.4.30050',.75,22.5,30],['11600CO',.75,22.5,30],
    ['11600BD',.75,22.5,30],['12900CO',1.036,31.08,30],['12900BD',1.036,31.08,30],
  ]);
  assert.deepEqual(screen.articles.map(a => [a.code,a.mold_cycle_seconds,a.standard_seconds,a.standard_operators]), [['2.4.30051',5,7.5,1.5]]);
  assert.deepEqual(assembly.articles.map(a => [a.code,a.mold_cycle_seconds,a.standard_seconds,a.standard_operators]), [['3.3.30273',3.26,42.35,13]]);
  for (const data of [metal,screen,assembly]) {
    assert.equal(data.records.length, 0);
    assert.ok(data.articles.every(a => a.cavities === 1 && a.trs_target === (data === metal ? .7 : .8) && a.dle_target === a.trs_target));
  }
  assert.equal(departmentScope('local','injection'), 'local');
  assert.notEqual(departmentScope('local','assembly'), departmentScope('local','metallization'));
});

test('Les pertes propres à chaque département alimentent journaux, Pareto et DLE sans double comptage', () => {
  for (const department of ['assembly','metallization','screen-printing']) {
    const types = stopTypesFor(department);
    const events = Object.keys(types).filter(key => key !== 'planned').map((category,index) => ({category,cause:'',start_min:index*5,end_min:index*5+5}));
    const row = record(department,{timeline_complete:true,stop_events:events,...stopTotals(events)});
    assert.deepEqual(validateRecord(row), []);
    assert.equal(buildPareto([row]).total, events.length*5);
    assert.equal(calculate(row).runtime, 480-events.length*5);
    assert.equal(calculate(row).dle, 1000*row.standard_seconds/(8*3600));
    const labels=buildPareto([row]).items.map(item=>item.label);
    assert.equal(new Set(labels).size,labels.length);
    if (department === 'metallization') {
      assert.ok(labels.includes('Panne Vaccum') && labels.includes('Panne ligne de peinture'));
      assert.ok(!labels.includes('Panne moule'));
    }
    if (department === 'screen-printing') assert.ok(labels.includes('Panne four'));
    assert.ok(validateRecord({...row, [department === 'metallization' ? 'breakdown_min' : 'mold_breakdown_min']: 1}).length);
    assert.ok(Math.abs(trsLosses([row]).total + row.good_qty * row.cycle_seconds / 60 - 480) < 1e-8);
  }
  assert.equal(targetForRows([{opening_min:100,planned_min:0,trs_target:.7},{opening_min:300,planned_min:0,trs_target:.8}], 'trs', .85), .775);
});

test('Les exports nomment le département et ses pertes et conservent les effectifs fractionnaires', async () => {
  for (const department of ['assembly','metallization','screen-printing']) {
    const row=record(department,{peripherals_min:department === 'assembly' ? 0 : 12});
    const book=new ExcelJS.Workbook();await book.xlsx.load(await buildExcelExport([row],departmentSeed(department)));
    const details=book.getWorksheet('Relevés'), headers=details.getRow(1).values;
    assert.equal(details.getCell('C1').value,'Équipement');
    assert.equal(details.getCell(2,headers.indexOf('Effectif standard')).value,row.standard_operators);
    assert.equal(details.getCell(2,headers.indexOf('Objectif DLE')).value,row.dle_target);
    assert.equal(book.getWorksheet('Synthèse').getCell('B14').result,calculate(row).dle);
    if(department==='screen-printing')assert.ok(headers.includes('Panne four (min)'));
    if(department==='metallization')assert.ok(headers.includes('Panne Vaccum (min)')&&headers.includes('Panne ligne de peinture (min)'));
  }
});

test('Le stockage local isole les départements et conserve les paramètres historiques', async () => {
  const values=new Map();
  const store=createLocalStore(JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8')),{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  const loadData=async department=>store.read(department), saveRecord=async (...args)=>store.saveRecord(...args), saveReference=async (...args)=>store.saveReference(...args);
    const initial=await loadData();assert.equal(initial.records.length,63);
    for(const department of ['assembly','metallization','screen-printing']) {
      const row=record(department);await saveRecord(row,department);
      const data=await loadData(department);assert.equal(data.records.length,1);
      assert.equal(data.records[0].department,department);
      const article={...data.articles[0],standard_seconds:99,standard_operators:2};
      await saveReference('articles',article,department);
      await saveRecord({...data.records[0],notes:'historique'},department);
      assert.equal((await loadData(department)).records[0].standard_seconds,row.standard_seconds);
      await assert.rejects(saveRecord({...row,id:crypto.randomUUID(),article_id:initial.articles[0].id},department));
    }
    assert.equal((await loadData()).records.length,63);
});

test('La migration 07 est rejouable, protège les départements et conserve les 63 relevés Injection', async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`);
    for(const name of ['01_schema','02_import_excel','03_stop_journal','04_daily_review','05_planning_public_access','06_loss_categories','07_departments','07_departments'])await db.exec(readFileSync(new URL(`../supabase/${name}.sql`,import.meta.url),'utf8'));
    assert.equal((await db.query("select count(*)::int n from public.production_records where department='injection'")).rows[0].n,63);
    assert.equal((await db.query('select count(*)::int n from public.articles')).rows[0].n,11);
    for(const department of ['assembly','metallization','screen-printing']) {
      const seed=departmentSeed(department),article=seed.articles[0];
      const actual=(await db.query('select * from public.articles where id=$1',[article.id])).rows[0];
      for(const key of ['mold_cycle_seconds','standard_seconds','standard_operators','trs_target','dle_target'])assert.equal(Number(actual[key]),article[key]);
      const row=record(department);
      await db.query(`insert into public.production_records(id,department,date,shift,press_id,article_id,opening_min,good_qty,labor_hours,cycle_seconds,standard_seconds) values($1,$2,$3,$4,$5,$6,480,1000,8,1,1)`,[row.id,department,row.date,row.shift,row.press_id,row.article_id]);
      const metrics=(await db.query('select * from public.production_metrics where id=$1',[row.id])).rows[0];
      assert.ok(Math.abs(Number(metrics.dle)-calculate(row).dle)<1e-10);
      assert.equal(Number(metrics.cycle_seconds),row.cycle_seconds);
      await db.query('update public.articles set standard_seconds=99, standard_operators=2 where id=$1',[article.id]);
      await db.query("update public.production_records set notes='keep snapshots',standard_seconds=123 where id=$1",[row.id]);
      assert.equal(Number((await db.query('select standard_seconds from public.production_records where id=$1',[row.id])).rows[0].standard_seconds),row.standard_seconds);
      await assert.rejects(db.query("update public.production_records set department='injection' where id=$1",[row.id]));
      const other=departmentSeed(department==='assembly'?'metallization':'assembly');
      await assert.rejects(db.query('update public.production_records set press_id=$1 where id=$2',[other.presses[0].id,row.id]));
      await assert.rejects(db.query(`update public.production_records set ${department==='metallization'?'breakdown_min':'mold_breakdown_min'}=1 where id=$1`,[row.id]));
    }
    // Codes may be shared between departments, never duplicated within one.
    await db.query("insert into public.articles(department,code,name,cavities,mold_cycle_seconds,standard_seconds,standard_operators,trs_target,dle_target) values('assembly','2.3.30156','Shared code',1,1,1,1,.8,.8)");
    await assert.rejects(db.query("insert into public.articles(department,code,name,cavities,mold_cycle_seconds,standard_seconds,standard_operators,trs_target,dle_target) values('assembly','2.3.30156','Duplicate',1,1,1,1,.8,.8)"));
    await db.exec('set role anon');
    assert.equal((await db.query('select public.qos_departments_ready() ready')).rows[0].ready,true);
    assert.equal((await db.query("select count(*)::int n from public.production_records where department='assembly'")).rows[0].n,1);
  } finally {await db.close();}
});

test('La reprise JSON vers SQL conserve le département et ses instantanés historiques', async () => {
  const db=new PGlite(), dir=mkdtempSync(join(tmpdir(),'qos-department-backup-'));
  const input=join(dir,'backup.json'), output=join(dir,'restore.sql');
  try {
    const data=departmentSeed('screen-printing');
    const row=record('screen-printing',{standard_seconds:8.25,standard_operators:1.75,trs_target:.75,peripherals_min:12});
    data.records=[row];
    writeFileSync(input,JSON.stringify({version:1,...data}));
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/backup-to-sql.mjs',import.meta.url)),input,output],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`);
    for(const name of ['01_schema','03_stop_journal','04_daily_review','05_planning_public_access','06_loss_categories','07_departments'])await db.exec(readFileSync(new URL(`../supabase/${name}.sql`,import.meta.url),'utf8'));
    await db.exec(readFileSync(output,'utf8'));
    const saved=(await db.query('select * from public.production_records where id=$1',[row.id])).rows[0];
    assert.equal(saved.department,'screen-printing');
    for(const key of ['cycle_seconds','standard_seconds','standard_operators','trs_target','dle_target','peripherals_min'])assert.equal(Number(saved[key]),row[key]);
    assert.equal((await db.query("select count(*)::int n from public.production_records where department='injection'")).rows[0].n,0);
  } finally {
    await db.close();for(const path of [input,output])try{unlinkSync(path);}catch{}
    rmdirSync(dir);
  }
});
