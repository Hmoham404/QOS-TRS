import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {validateRecord,calculate} from '../src/domain.js';
import {draftKey,writeDraft,readDraft,listDrafts,removeDraft} from '../src/drafts.js';
const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));
test('Planification facultative, entière et indépendante du TRS',()=>{
  const r=seed.records[3];
  for(const planned_qty of [undefined,null,0,6500,2147483647]){
    assert.deepEqual(validateRecord({...r,planned_qty}),[]);
    assert.deepEqual(calculate({...r,planned_qty}),calculate(r));
  }
  for(const planned_qty of [-1,1.5,NaN,Infinity,2147483648,'500'])assert.ok(validateRecord({...r,planned_qty}).some(e=>e.includes('planifiée')));
});
test('Brouillons isolés par base, reprise exacte des zéros, journaux et version de conflit',()=>{
  const map=new Map(),storage={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const r={...seed.records[3],planned_qty:0,updated_at:'2026-10-01T00:00:00Z',stop_events:[{cause:'Hydraulique'}]};
  const key=draftKey('local',r);
  writeDraft(key,r,r,storage);
  assert.deepEqual(readDraft(key,storage).record,r);
  assert.equal(listDrafts('other-project',storage).length,0);
  assert.equal(listDrafts('local',storage).length,1);
  removeDraft(key,storage);assert.equal(listDrafts('local',storage).length,0);
  storage.setItem(key,'broken');assert.equal(readDraft(key,storage),null);
});
test('Migration publique rejouable : historique intact, accès sans compte et contraintes conservées',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`);
    for(const file of ['01_schema','02_import_excel','03_stop_journal','04_daily_review','05_planning_public_access','05_planning_public_access'])await db.exec(readFileSync(new URL(`../supabase/${file}.sql`,import.meta.url),'utf8'));
    const before=(await db.query('select id,cycle_seconds,standard_seconds,planned_qty from public.production_records')).rows;
    assert.equal(before.length,63);assert.ok(before.every(r=>r.planned_qty===null));
    await db.exec('set role anon');
    assert.equal((await db.query('select public.qos_public_access_ready() as ready')).rows[0].ready,true);
    assert.equal((await db.query('select * from public.production_metrics')).rows.length,63);
    const sample=seed.records[3];
    await db.query('update public.production_records set planned_qty=7200 where id=$1',[sample.id]);
    let r=(await db.query('select * from public.production_records where id=$1',[sample.id])).rows[0];
    assert.equal(r.planned_qty,7200);assert.equal(Number(r.cycle_seconds),sample.cycle_seconds);
    await db.query('update public.production_records set planned_qty=0 where id=$1',[sample.id]);
    await assert.rejects(db.query('update public.production_records set planned_qty=-1 where id=$1',[sample.id]));
    await assert.rejects(db.query('update public.production_records set breakdown_min=9999 where id=$1',[sample.id]));
    await assert.rejects(db.query('delete from public.production_records where id=$1',[sample.id]));
    await assert.rejects(db.query('select * from public.workshop_members'));
    await db.query("insert into public.presses(name) values('PWA test')");
    await db.query("insert into public.production_records(date,shift,press_id,article_id,opening_min,cycle_seconds,standard_seconds,planned_qty) values('2026-10-16','Matin',$1,$2,480,1,1,6000)",[sample.press_id,sample.article_id]);
    const added=(await db.query("select * from public.production_records where date='2026-10-16'")).rows[0];
    assert.equal(added.created_by,null);assert.equal(added.planned_qty,6000);assert.equal(Number(added.cycle_seconds),sample.cycle_seconds);
  }finally{await db.close();}
});
