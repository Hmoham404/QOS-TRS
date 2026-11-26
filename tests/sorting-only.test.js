import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {departmentSeed} from '../src/departments.js';
import {aggregate, calculate, validateRecord, recordKey} from '../src/domain.js';
import {isSortingOnly, sortingRecord} from '../src/sorting.js';
import {curveSeries, planningRate} from '../src/curves.js';
import {dailyPresses, dailyStops} from '../src/daily.js';
import {productionReport} from '../src/production-report.js';
import {createLocalStore} from '../src/local-data.js';
import {buildPareto, usefulByShift} from '../src/analytics.js';
import {buildExcelExport} from '../src/excel-export.js';
import {extraLossDefaults} from '../src/losses.js';

const assembly=departmentSeed('assembly');
const article=assembly.articles[1];
const sorting=sortingRecord({
  id:crypto.randomUUID(),department:'assembly',date:'2026-11-26',shift:'Matin',
  press_id:assembly.presses[0].id,article_id:article.id,
  opening_min:450,planned_min:0,...extraLossDefaults(),breakdown_min:0,startup_min:0,changeover_min:0,
  good_qty:0,startup_rejects:0,production_rejects:0,labor_hours:8,cycle_seconds:article.mold_cycle_seconds,
  standard_seconds:article.standard_seconds,sorting_hours:12.5,notes:'Tri des produits métallisés',source:'web',
});

test('Le tri seul garde ses heures sans produire un jour, un arrêt, un plan ou un taux',()=>{
  assert.ok(isSortingOnly(sorting));
  assert.deepEqual(validateRecord(sorting),[]);
  const totals=aggregate([sorting]);
  assert.equal(totals.sorting,12.5);
  for(const key of ['required','runtime','good','rejects','earned','labor','planned','unplanned']) assert.equal(totals[key],0,key);
  for(const key of ['trs','dle','availability','performance','quality']) assert.equal(totals[key],null,key);
  assert.deepEqual(curveSeries([sorting],assembly.presses),{days:[],machines:[]});
  assert.equal(planningRate([sorting]).missing,0);
  assert.equal(buildPareto([sorting],true).total,0);
  assert.equal(usefulByShift([sorting])[0].planned,0);
  assert.deepEqual(dailyStops([sorting]),[]);
  const daily=dailyPresses({...assembly,records:[sorting]},sorting.date);
  assert.equal(daily[0].status,'sorting');
  assert.equal(daily[0].opening,0);
  const report=productionReport([{...assembly,records:[sorting]}],sorting.date,sorting.date);
  assert.equal(report.count,0);
  assert.equal(report.lines.length,7);
  assert.equal(report.lines[0].code,'3.3.30273');
});

test('Une production Métallisation et un tri Assemblage restent indépendants, même jour et référence',()=>{
  const metal=departmentSeed('metallization');
  const production={...sorting,department:'metallization',article_id:metal.articles[0].id,
    press_id:metal.presses[0].id,planned_min:0,good_qty:100,sorting_hours:null,labor_hours:8};
  assert.equal(isSortingOnly(production),false);
  assert.equal(isSortingOnly({...production,good_qty:0}),false);
  assert.equal(isSortingOnly({...production,sorting_hours:2}),false);
  assert.equal(aggregate([sorting,production]).trs,calculate(production).trs);
  assert.equal(aggregate([sorting,production]).dle,calculate(production).dle);
  assert.equal(aggregate([sorting,production]).sorting,12.5);
  assert.equal(curveSeries([sorting,production],metal.presses).days[0].count,1);
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const store=createLocalStore({presses:[],articles:[],records:[]},storage);
  store.saveRecord(production,'metallization');
  store.saveRecord(sorting,'assembly');
  assert.equal(store.read('metallization').records[0].good_qty,100);
  assert.ok(isSortingOnly(store.read('assembly').records[0]));
});

test('Le catalogue Assemblage reçoit toutes les références actives sans écraser ses références existantes',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const store=createLocalStore({presses:[],articles:[],records:[]},storage);
  const custom={...departmentSeed('metallization').articles[0],id:crypto.randomUUID(),name:'Nouveau produit',code:'NEW-01'};
  store.saveReference('articles',custom,'metallization');
  const updated=store.read('assembly');
  assert.equal(updated.articles.length,8);
  assert.ok(updated.articles.some(a=>a.code==='NEW-01'&&a.name==='Nouveau produit'));
  assert.equal(new Set(updated.articles.map(a=>a.id)).size,8);
});

test('Production et tri du même produit coexistent sur le même poste, sans doublons dans une activité',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const store=createLocalStore({presses:[],articles:[],records:[]},storage);
  const production={...sorting,id:crypto.randomUUID(),planned_min:0,good_qty:500,labor_hours:8,sorting_hours:null};
  assert.notEqual(recordKey(production),recordKey(sorting));
  store.saveRecord(production,'assembly');
  store.saveRecord(sorting,'assembly');
  let data=store.read('assembly');
  assert.equal(data.records.length,2);
  assert.equal(aggregate(data.records).good,500);
  assert.equal(aggregate(data.records).sorting,12.5);
  assert.equal(aggregate(data.records).trs,calculate(production).trs);
  assert.equal(curveSeries(data.records,data.presses).days[0].count,1);
  assert.throws(()=>store.saveRecord({...sorting,id:crypto.randomUUID()},'assembly'),/existe déjà/);
  assert.throws(()=>store.saveRecord({...production,id:crypto.randomUUID()},'assembly'),/existe déjà/);
  const savedSorting=data.records.find(isSortingOnly);
  store.saveRecord({...savedSorting,sorting_hours:15},'assembly');
  data=store.read('assembly');
  assert.equal(data.records.length,2);
  assert.equal(data.records.find(r=>!isSortingOnly(r)).good_qty,500);
  assert.equal(aggregate(data.records).sorting,15);
});

test('Les anciennes références de tri retrouvent leur nom produit sans perdre archives, paramètres ou identités',()=>{
  const legacy=structuredClone(assembly);
  legacy.articles[1]={...legacy.articles[1],name:'Tri · '+legacy.articles[1].name,active:false,standard_seconds:99};
  legacy.articles[2].name='Nom personnalisé';
  const values=new Map([['qos-assembly-v1',JSON.stringify(legacy)]]);
  const store=createLocalStore({presses:[],articles:[],records:[]},{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)});
  const data=store.read('assembly');
  assert.equal(data.articles.length,7);
  assert.equal(data.articles[1].name,article.name);
  assert.equal(data.articles[1].id,article.id);
  assert.equal(data.articles[1].active,false);
  assert.equal(data.articles[1].standard_seconds,99);
  assert.equal(data.articles[2].name,'Nom personnalisé');
});

test('L’export Excel conserve le type de relevé, les heures de tri et des taux vides',async()=>{
  const {default:ExcelJS}=await import('exceljs');
  const book=new ExcelJS.Workbook();
  await book.xlsx.load(await buildExcelExport([sorting],assembly));
  const details=book.getWorksheet('Relevés'),headers=details.getRow(1).values;
  assert.equal(details.getCell(2,headers.indexOf('Activité')).value,'Tri uniquement');
  assert.equal(details.getCell(2,headers.indexOf('Heures de tri')).value,12.5);
  assert.equal(details.getCell(2,21).value,null);
  assert.equal(book.getWorksheet('Synthèse').getCell('B10').result ?? '', '');
});

test('La migration de références est rejouable et les métriques SQL du tri restent neutres',async()=>{
  const db=new PGlite();
  try{
    await db.exec('create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;');
    for(const name of ['01_schema','02_import_excel','03_stop_journal','04_daily_review','05_planning_public_access','06_loss_categories','07_departments','08_welding','09_read_performance','10_performance_required_time','11_shift_time','12_net_opening_time','13_labor_and_work_order','14_sorting_hours','15_department_lines','16_assembly_sorting_references','16_assembly_sorting_references'])await db.exec(readFileSync(new URL(`../supabase/${name}.sql`,import.meta.url),'utf8'));
    assert.equal((await db.query("select count(*)::int n from articles where department='assembly'")).rows[0].n,7);
    assert.equal((await db.query('select count(*)::int n from production_records')).rows[0].n,63);
    await db.query('insert into production_records(id,department,date,shift,press_id,article_id,opening_min,planned_min,sorting_hours) values ($1,$2,$3,$4,$5,$6,450,450,12.5)',[sorting.id,'assembly',sorting.date,sorting.shift,sorting.press_id,sorting.article_id]);
    const metrics=(await db.query('select trs,dle,availability,performance,quality,runtime_min from production_metrics where id=$1',[sorting.id])).rows[0];
    for(const key of ['trs','dle','availability','performance','quality'])assert.equal(metrics[key],null,key);
    assert.equal(Number(metrics.runtime_min),0);
    const insertProduction = id => db.query('insert into production_records(id,department,date,shift,press_id,article_id,opening_min,planned_min,good_qty,labor_hours) values ($1,$2,$3,$4,$5,$6,450,0,500,8)',[id,'assembly',sorting.date,sorting.shift,sorting.press_id,sorting.article_id]);
    await assert.rejects(insertProduction(crypto.randomUUID()),error=>error.code==='23505');
    for(let i=0;i<2;i++)await db.exec(readFileSync(new URL('../supabase/17_independent_production_sorting.sql',import.meta.url),'utf8'));
    assert.equal((await db.query("select name from articles where id=$1",[sorting.article_id])).rows[0].name,article.name);
    const productionId=crypto.randomUUID();
    await insertProduction(productionId);
    assert.equal((await db.query('select count(*)::int n from production_records')).rows[0].n,65);
    await assert.rejects(insertProduction(crypto.randomUUID()),error=>error.code==='23505');
    await assert.rejects(db.query('insert into production_records(id,department,date,shift,press_id,article_id,opening_min,planned_min,sorting_hours) values ($1,$2,$3,$4,$5,$6,450,450,3)',[crypto.randomUUID(),'assembly',sorting.date,sorting.shift,sorting.press_id,sorting.article_id]),error=>error.code==='23505');
    await db.query('update production_records set sorting_hours=15 where id=$1',[sorting.id]);
    assert.equal(Number((await db.query('select good_qty from production_records where id=$1',[productionId])).rows[0].good_qty),500);
    await assert.rejects(db.query('update production_records set planned_min=0 where id=$1',[sorting.id]),error=>error.code==='23505');
  }finally{await db.close();}
});
