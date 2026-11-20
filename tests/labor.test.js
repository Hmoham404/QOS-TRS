import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {calculate, aggregate, validateRecord} from '../src/domain.js';
import {createLocalStore} from '../src/local-data.js';
import {buildExcelExport} from '../src/excel-export.js';
const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));

test('DLE : 700 pièces, 180 s de standard MOD, 8 h et 2 à 5 opérateurs',()=>{
  const row={...seed.records[3],good_qty:700,standard_seconds:180,labor_duration_hours:8,labor_hours:8};
  for(const n of [2,3,4,5])assert.ok(Math.abs(calculate({...row,operator_count:n}).dle-35/(8*n))<1e-12);
  assert.equal(calculate({...row,operator_count:3}).labor,24);
  assert.equal(calculate({...row,operator_count:0}).dle,null);
  assert.equal(calculate(row).dle,35/8);
  assert.equal(aggregate([{...row,operator_count:2},{...row,operator_count:5}]).dle,70/56);
  for(const invalid of [{operator_count:-1},{operator_count:1.5},{operator_count:3,labor_duration_hours:null},{operator_count:3,labor_duration_hours:25},{work_order:'x'.repeat(101)}])
    assert.ok(validateRecord({...row,...invalid}).length);
});

test('Enregistrement local et export : OF, effectif et heures MOD calculées',async()=>{
  const values=new Map(),store=createLocalStore(seed,{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)});
  const row={...seed.records[3],id:crypto.randomUUID(),date:'2026-11-20',operator_count:3,labor_duration_hours:8,labor_hours:99,work_order:'OF-2026-007'};
  store.saveRecord(row);
  const data=store.read(),saved=data.records.find(r=>r.id===row.id);
  assert.equal(saved.labor_hours,24);assert.equal(saved.work_order,row.work_order);
  assert.deepEqual(data.records.slice(0,63),seed.records);
  const {default:ExcelJS}=await import('exceljs');
  const book=new ExcelJS.Workbook();
  await book.xlsx.load(await buildExcelExport([saved],data));
  const sheet=book.getWorksheet('Relevés');
  assert.equal(sheet.getCell('W2').value,24);
  assert.equal(sheet.getCell(2,39).value,row.work_order);
  assert.equal(sheet.getCell(2,40).value,3);
  assert.equal(sheet.getCell(2,41).value,8);
});

test('Migration MOD rejouable : calcul SQL, OF et historique préservé',async()=>{
  const db=new PGlite();
  try{
    await db.exec('create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;');
    for(const file of ['01_schema.sql','02_import_excel.sql','03_stop_journal.sql','04_daily_review.sql','05_planning_public_access.sql','06_loss_categories.sql','07_departments.sql','08_welding.sql','09_read_performance.sql','10_performance_required_time.sql','11_shift_time.sql','12_net_opening_time.sql'])
      await db.exec(readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
    const before=(await db.query('select id,labor_hours from production_records order by id')).rows;
    const migration=readFileSync(new URL('../supabase/13_labor_and_work_order.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration);
    assert.deepEqual((await db.query('select id,labor_hours from production_records order by id')).rows,before);
    const id=seed.records[3].id;
    await db.query('update production_records set operator_count=3,labor_duration_hours=8,work_order=$1 where id=$2',[' OF-007 ',id]);
    const row=(await db.query('select * from production_records where id=$1',[id])).rows[0];
    assert.equal(Number(row.labor_hours),24);assert.equal(row.work_order,'OF-007');
    await assert.rejects(db.query('update production_records set operator_count=-1 where id=$1',[id]));
    await assert.rejects(db.query('update production_records set labor_duration_hours=null where id=$1',[id]));
  }finally{await db.close();}
});
