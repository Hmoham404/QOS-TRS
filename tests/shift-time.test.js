import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {calculate, validateRecord} from '../src/domain.js';
import {createLocalStore} from '../src/local-data.js';
import {DEFAULT_SHIFT_TIME, readShiftTime, rememberShiftTime} from '../src/shift-time.js';
const seed = JSON.parse(readFileSync(new URL('../src/seed.json', import.meta.url), 'utf8'));
const storage = () => {const values = new Map(); return {getItem:key=>values.get(key) ?? null, setItem:(key,value)=>values.set(key,value)};};

test('Passer de 8 h à 12 h conserve les relevés et les anciens paramètres historiques', () => {
  const memory=storage(), store=createLocalStore(seed,memory);
  const original=structuredClone(store.read().records);
  const first={...seed.records[3], ...DEFAULT_SHIFT_TIME, id:crypto.randomUUID(),date:'2026-11-19', timeline_complete:false};
  store.saveRecord(first);
  rememberShiftTime('local:injection', first, memory);
  const second={...first,...readShiftTime('local:injection',memory), id:crypto.randomUUID(),date:'2026-11-26',shift_duration_min:720,opening_min:690};
  store.saveRecord(second);
  rememberShiftTime('local:injection',second,memory);
  const saved=store.read().records;
  assert.deepEqual(saved.slice(0,63),original);
  assert.equal(calculate(saved.find(r=>r.id===first.id)).required,450);
  assert.equal(calculate(saved.find(r=>r.id===second.id)).required,690);
  assert.equal(readShiftTime('local:injection',memory).opening_min,690);
  assert.equal(readShiftTime('local:assembly',memory).opening_min,450);
  assert.ok(validateRecord({...first,pause_min:-1}).length);
  assert.deepEqual(validateRecord({...first,planned_min:20}),[]);
  assert.equal(calculate({...first,planned_min:20}).required,430);
  assert.ok(validateRecord({...first,opening_min:480}).length);
  assert.ok(validateRecord({...first,meeting_min:null}).length);
});

test('Migration des temps rejouable : historique intact et incohérences refusées côté SQL',async()=>{
  const db=new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;');
    for (const file of ['01_schema.sql','02_import_excel.sql','03_stop_journal.sql','04_daily_review.sql','05_planning_public_access.sql','06_loss_categories.sql','07_departments.sql','08_welding.sql','09_read_performance.sql','10_performance_required_time.sql'])
      await db.exec(readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
    const before=(await db.query('select id,opening_min,planned_min from production_records order by id')).rows;
    const bundled=readFileSync(new URL('../supabase/UPDATE_SQL_EDITOR.sql',import.meta.url),'utf8');
    // The all-in-one update also works before migrations 11 and 12.
    await db.exec(bundled);
    const migration=readFileSync(new URL('../supabase/11_shift_time.sql',import.meta.url),'utf8');
    await db.exec(migration);
    const corrected=readFileSync(new URL('../supabase/12_net_opening_time.sql',import.meta.url),'utf8');
    await db.exec(corrected); await db.exec(corrected);
    assert.deepEqual((await db.query('select id,opening_min,planned_min from production_records order by id')).rows,before);
    const id=seed.records[3].id;
    await db.query('update production_records set shift_duration_min=480,opening_min=450,planned_min=0,pause_min=20,meeting_min=5,five_s_min=5 where id=$1',[id]);
    assert.equal(Number((await db.query('select required_min from production_metrics where id=$1',[id])).rows[0].required_min),450);
    await assert.rejects(db.query('update production_records set pause_min=-1 where id=$1',[id]));
    await db.query('update production_records set planned_min=20 where id=$1',[id]);
    assert.equal(Number((await db.query('select required_min from production_metrics where id=$1',[id])).rows[0].required_min),430);
    await assert.rejects(db.query('update production_records set opening_min=480 where id=$1',[id]));
    await assert.rejects(db.query('update production_records set five_s_min=null where id=$1',[id]));
    const snapshot=(await db.query('select * from production_records order by id')).rows;
    // Replaying it after corrected entries exist must not restore the old
    // planned-break constraint or touch historical values and timestamps.
    await db.exec(bundled); await db.exec(bundled);
    assert.deepEqual((await db.query('select * from production_records order by id')).rows,snapshot);
  } finally {await db.close();}
});
