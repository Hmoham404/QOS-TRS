import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ExcelJS from 'exceljs';
import {EXTRA_LOSS_FIELDS, STOP_TYPES, extraLossDefaults} from '../src/losses.js';
import {calculate, aggregate, validateRecord} from '../src/domain.js';
import {stopTotals, buildPareto, validateTimeline, usefulByShift} from '../src/analytics.js';
import {trsLosses} from '../src/curves.js';
import {buildExcelExport} from '../src/excel-export.js';
const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));
const base={...seed.records[3],opening_min:480,planned_min:20,breakdown_min:0,startup_min:0,changeover_min:0,good_qty:100,startup_rejects:0,production_rejects:0,cycle_seconds:60,standard_seconds:30};
const row={...base,...Object.fromEntries(EXTRA_LOSS_FIELDS.map((field,index)=>[field,index+1]))};

test('Les huit nouvelles pertes déduisent 36 minutes une seule fois dans tous les bilans',()=>{
 assert.deepEqual(validateRecord(row),[]);
 assert.equal(calculate(row).runtime,424);
 const sums=aggregate([row]);assert.equal(sums.unplanned,36);assert.equal(sums.runtime,424);
 assert.equal(buildPareto([row]).total,36);assert.equal(buildPareto([row],true).total,56);
 assert.equal(usefulByShift([row]).find(s=>s.count).lost,36);
 const losses=trsLosses([row]);assert.equal(losses.total+100,460);
 assert.equal(losses.items.find(i=>i.key==='quality_stop').minutes,5);
 assert.equal(losses.items.find(i=>i.key==='quality').minutes,0);
 assert.equal(calculate(base).runtime,460);
});
test('Les pertes négatives, non numériques et les dépassements restent bloqués',()=>{
 for(const value of [-1,NaN,Infinity,'12'])assert.ok(validateRecord({...row,staffing_min:value}).length);
 assert.ok(validateRecord({...row,staffing_min:480}).some(e=>e.includes('dépasse')));
 assert.ok(validateRecord({...base,...extraLossDefaults(),staffing_min:460}).some(e=>e.includes('production')));
});
test('Le journal reconnaît toutes les causes et refuse une divergence des totaux',()=>{
 const stop_events=Object.entries(STOP_TYPES).map(([category],index)=>({id:String(index),category,cause:'',start_min:index*10,end_min:index*10+5}));
 const r={...base,shift_start:'06:00',timeline_complete:true,stop_events,...stopTotals(stop_events)};
 assert.deepEqual(validateRecord(r),[]);assert.equal(calculate(r).runtime,420);
 assert.equal(buildPareto([r]).total,55);assert.equal(buildPareto([r],true).total,60);
 assert.ok(validateTimeline({...r,material_shortage_min:0}).length);
});
test('Le classeur exporte les 38 colonnes et conserve les minutes et les formules pondérées',async()=>{
 const book=new ExcelJS.Workbook();await book.xlsx.load(await buildExcelExport([row],seed));
 const sheet=book.getWorksheet('Relevés');assert.equal(sheet.columnCount,38);
 EXTRA_LOSS_FIELDS.forEach((field,index)=>assert.equal(sheet.getCell(2,31+index).value,row[field]));
 assert.equal(sheet.getCell('I1').value,'Panne machine (min)');
 assert.equal(sheet.getCell('L2').value,424);
 assert.equal(book.getWorksheet('Synthèse').getCell('B10').result,424/460);
 assert.match(sheet.autoFilter.toString(),/AL/);
});
test('La migration des pertes est rejouable, conserve les 63 lignes et contrôle le journal et les temps',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`);
  for(const name of ['01_schema','02_import_excel','03_stop_journal','04_daily_review','05_planning_public_access','06_loss_categories','06_loss_categories'])await db.exec(readFileSync(new URL(`../supabase/${name}.sql`,import.meta.url),'utf8'));
  assert.equal((await db.query('select count(*)::int n from public.production_records')).rows[0].n,63);
  assert.equal(Number((await db.query('select sum(runtime_min) n from public.production_metrics')).rows[0].n),311.5*60);
  const id=seed.records[3].id;
  const before=(await db.query('select runtime_min from public.production_metrics where id=$1',[id])).rows[0];
  await db.query('update public.production_records set staffing_min=12,quality_stop_min=8 where id=$1',[id]);
  assert.equal(Number((await db.query('select runtime_min from public.production_metrics where id=$1',[id])).rows[0].runtime_min),Number(before.runtime_min)-20);
  await assert.rejects(db.query('update public.production_records set staffing_min=-1 where id=$1',[id]));
  await assert.rejects(db.query('update public.production_records set staffing_min=480 where id=$1',[id]));
  const events=[{category:'staffing',start_min:0,end_min:12,cause:'Équipe'},{category:'quality_stop',start_min:12,end_min:20,cause:'Contrôle'}];
  await db.query('update public.production_records set planned_min=0,breakdown_min=0,startup_min=0,changeover_min=0,timeline_complete=true,shift_start=$1,stop_events=$2 where id=$3',['06:00',JSON.stringify(events),id]);
  await assert.rejects(db.query('update public.production_records set quality_stop_min=7 where id=$1',[id]));
  assert.equal(Number((await db.query('select runtime_min from public.production_metrics where id=$1',[id])).rows[0].runtime_min),460);
 }finally{await db.close();}
});
