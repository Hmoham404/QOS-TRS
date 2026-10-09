import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {stopTotals,validateTimeline,timelineSegments,hourlyUseful,buildPareto,clockLabel} from '../src/analytics.js';
import {calculate,validateRecord} from '../src/domain.js';
const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));
const events=[{id:'a',start_min:50,end_min:70,category:'breakdown',cause:'Hydraulique'},{id:'b',start_min:130,end_min:140,category:'startup',cause:'Réglage'}];
const record={...seed.records[3],opening_min:480,shift_start:'22:00',timeline_complete:true,stop_events:events,...stopTotals(events)};
test('La chronologie et les minutes utiles respectent les interruptions et le passage de minuit',()=>{
 assert.deepEqual(validateRecord(record),[]);
 const segments=timelineSegments(record);assert.equal(segments.length,5);assert.deepEqual(segments.map(s=>s.state),[1,0,1,0,1]);
 const hours=hourlyUseful(record);assert.equal(hours.length,8);assert.deepEqual(hours.map(h=>h.useful),[50,50,50,60,60,60,60,60]);assert.equal(hours.reduce((s,h)=>s+h.useful,0),calculate(record).runtime);assert.equal(clockLabel('22:00',180),'01:00 J+1');
 assert.equal(hourlyUseful({...record,opening_min:470}).at(-1).capacity,50);
});
test('Aucun horaire inventé pour les relevés historiques ; Pareto sans double comptage',()=>{
 assert.deepEqual(timelineSegments(seed.records[3]),[]);assert.deepEqual(hourlyUseful(seed.records[3]),[]);
 const p=buildPareto([record,seed.records[3]]);assert.equal(p.total,75);assert.equal(p.detailed,1);assert.equal(p.items.at(-1).cumulative,100);assert.equal(p.items[0].minutes,45);
 assert.equal(buildPareto(seed.records).total,1470);assert.equal(buildPareto(seed.records,true).total,11550);
});
test('Les chevauchements, dépassements et journaux incohérents sont refusés',()=>{
 for(const e of [[{...events[0],end_min:500}],[...events,{...events[0],start_min:60,end_min:80}],[{...events[0],start_min:-1}],[{...events[0],end_min:50}],[{...events[0],category:'unknown'}]])assert.ok(validateTimeline({...record,stop_events:e}).length);
 assert.ok(validateTimeline({...record,shift_start:'25:00'}).length);assert.ok(validateTimeline({...record,breakdown_min:9}).length);assert.ok(validateTimeline({...record,timeline_complete:false}).length);
 assert.deepEqual(validateTimeline({...record,stop_events:[],...stopTotals([])}),[]);
});
test('La migration SQL est idempotente et applique les contraintes du journal côté serveur',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`);
  await db.exec(readFileSync(new URL('../supabase/01_schema.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/02_import_excel.sql',import.meta.url),'utf8'));
  const migration=readFileSync(new URL('../supabase/03_stop_journal.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
  await db.exec(readFileSync(new URL('../supabase/01_schema.sql',import.meta.url),'utf8'));
  const q='update public.production_records set shift_start=$1,timeline_complete=true,stop_events=$2,planned_min=0,breakdown_min=20,startup_min=10,changeover_min=0 where id=$3 returning *';
  const saved=(await db.query(q,[record.shift_start,JSON.stringify(events),record.id])).rows[0];assert.equal(saved.timeline_complete,true);assert.equal(saved.stop_events.length,2);
  await assert.rejects(db.query('update public.production_records set breakdown_min=5 where id=$1',[record.id]));
  await assert.rejects(db.query('update public.production_records set stop_events=$1 where id=$2',[JSON.stringify([{...events[0],start_min:130,end_min:150},events[1]]),record.id]));
  assert.equal((await db.query('select count(*)::int as n from public.production_records')).rows[0].n,63);
 }finally{await db.close();}
});
