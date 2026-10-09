import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {calculate} from '../src/domain.js';
test('Schéma PostgreSQL, import, calculs SQL, droits et conservation de l’historique',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  const schema=readFileSync(new URL('../supabase/01_schema.sql',import.meta.url),'utf8');
  const source=readFileSync(new URL('../supabase/02_import_excel.sql',import.meta.url),'utf8');
  await db.exec(schema);await db.exec(source);await db.exec(schema);await db.exec(source);
  const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));
  const metrics=(await db.query('select * from public.production_metrics')).rows;
  assert.equal(metrics.length,63);
  for(const r of seed.records){const row=metrics.find(m=>m.id===r.id),c=calculate(r);for(const k of ['availability','performance','quality','trs','dle']){if(c[k]===null)assert.equal(row[k],null);else assert.ok(Math.abs(Number(row[k])-c[k])<1e-10);}}
  const sample=seed.records[3];
  await db.query('update public.articles set mold_cycle_seconds=80, standard_seconds=10 where id=$1',[sample.article_id]);
  await db.query("update public.production_records set notes='test', cycle_seconds=123 where id=$1",[sample.id]);
  let saved=(await db.query('select cycle_seconds,standard_seconds from public.production_records where id=$1',[sample.id])).rows[0];
  assert.equal(Number(saved.cycle_seconds),sample.cycle_seconds);assert.equal(Number(saved.standard_seconds),sample.standard_seconds);
  await assert.rejects(db.query('update public.production_records set planned_min=9999 where id=$1',[sample.id]));
  const user='11111111-1111-4111-8111-111111111111';
  await db.query('insert into auth.users values($1,$2)',[user,'test@example.invalid']);
  await db.exec(`set role anon;`);await assert.rejects(db.query('select * from public.production_metrics'));await db.exec('reset role;set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  assert.equal((await db.query('select * from public.production_records')).rows.length,0);
  await db.exec('reset role');await db.query("insert into public.workshop_members values($1,'viewer')",[user]);await db.exec('set role authenticated');
  assert.equal((await db.query('select * from public.production_metrics')).rows.length,63);
  assert.equal((await db.query("update public.production_records set notes='unauthorized' where id=$1 returning id",[sample.id])).rows.length,0);
  await db.exec('reset role');await db.query("update public.workshop_members set role='operator' where user_id=$1",[user]);await db.exec('set role authenticated');
  assert.equal((await db.query("update public.production_records set notes='authorized' where id=$1 returning id",[sample.id])).rows.length,1);
  await assert.rejects(db.query("insert into public.presses(name) values('TEST')"));
  await assert.rejects(db.query("insert into public.workshop_members values('22222222-2222-4222-8222-222222222222','admin')"));
  await db.exec('reset role');await db.query("update public.workshop_members set role='admin' where user_id=$1",[user]);await db.exec('set role authenticated');
  assert.equal((await db.query("insert into public.presses(name) values('TEST') returning name")).rows[0].name,'TEST');
 }finally{await db.close();}
});
