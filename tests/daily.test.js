import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {dailyPresses,dailyTimeline,dailyStops,shiftDate,overlapError} from '../src/daily.js';
import {stopTotals} from '../src/analytics.js';
const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));
const base={...seed.records[3],date:'2026-10-08',shift:'Nuit',opening_min:480,shift_start:'22:00',timeline_complete:true};
const events=[{id:'a',start_min:50,end_min:70,category:'planned',cause:'Pause équipe'},{id:'b',start_min:130,end_min:140,category:'breakdown',cause:'Hydraulique'}];
const night={...base,stop_events:events,...stopTotals(events)};

test('J−1 respecte les changements de mois et les années bissextiles',()=>{
 assert.equal(shiftDate('2026-01-01',-1),'2025-12-31');assert.equal(shiftDate('2024-03-01',-1),'2024-02-29');
});
test('Le bilan distingue les presses ayant travaillé, arrêtées et non renseignées',()=>{
 const all=dailyPresses(seed,'2026-10-08');assert.equal(all.length,16);assert.equal(all.filter(p=>p.status==='worked').length,3);assert.equal(all.filter(p=>p.status==='missing').length,13);
 assert.equal(all.reduce((s,p)=>s+p.records.length,0),9);
 const nights=dailyPresses(seed,'2026-10-08',{shift:'Nuit'});assert.equal(nights.filter(p=>p.status==='stopped').length,3);assert.equal(nights.filter(p=>p.status==='worked').length,0);
 assert.ok(dailyPresses(seed,'2026-10-04').every(p=>p.status==='missing'));
 assert.equal(dailyPresses(seed,'2026-10-08',{press:all[0].id}).length,1);
});
test('La courbe quotidienne place la nuit au lendemain et conserve les plages inconnues',()=>{
 const t=dailyTimeline([night]);assert.equal(t.end,1800);assert.deepEqual(t.gaps,[{start:0,end:1320}]);
 assert.equal(t.journals[0].segments[1].start,1370);assert.equal(t.journals[0].segments[3].start,1450);
 assert.equal(t.journals[0].segments.filter(s=>s.state).reduce((n,s)=>n+s.end-s.start,0),450);
 assert.equal(dailyTimeline([seed.records[3]]).journals.length,0);
 const stops=dailyStops([night]);assert.equal(stops.length,2);assert.equal(stops[0].minutes,20);assert.ok(stops.every(s=>s.timed));assert.equal(dailyStops([seed.records[3]])[0].timed,false);
});
test('Les journaux ne peuvent pas superposer deux productions de la même presse, même après minuit',()=>{
 const other={...night,id:'other',date:'2026-10-09',shift:'Matin',shift_start:'05:59'};
 assert.ok(overlapError(other,[night]));assert.equal(overlapError({...other,shift_start:'06:00'},[night]),null);
 assert.equal(overlapError({...other,press_id:'other-press'},[night]),null);assert.equal(overlapError({...other,timeline_complete:false},[night]),null);
 assert.equal(overlapError(night,[night]),null);
});
test('La migration J−1 protège aussi les écritures SQL et conserve les données historiques',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`);
 for(const name of ['01_schema','02_import_excel','03_stop_journal','04_daily_review','04_daily_review'])await db.exec(readFileSync(new URL(`../supabase/${name}.sql`,import.meta.url),'utf8'));
 assert.equal((await db.query('select count(*)::int as n from public.production_records')).rows[0].n,63);
 const insert=`insert into public.production_records(date,shift,press_id,article_id,opening_min,cycle_seconds,standard_seconds,timeline_complete,shift_start) values($1,$2,$3,$4,480,1,1,true,$5) returning id`;
 await db.query(insert,['2026-10-10','Nuit',night.press_id,night.article_id,'22:00']);
 await assert.rejects(db.query(insert,['2026-10-11','Matin',night.press_id,night.article_id,'05:59']),/créneau/);
 const saved=await db.query(insert,['2026-10-11','Matin',night.press_id,night.article_id,'06:00']);
 await assert.rejects(db.query('update public.production_records set shift_start=$1 where id=$2',['05:00',saved.rows[0].id]),/créneau/);
 await assert.rejects(db.query('update public.production_records set shift_start=$1 where id=$2',['06:00:30',saved.rows[0].id]),/minute/);
 }finally{await db.close();}
});
