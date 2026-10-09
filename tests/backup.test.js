import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
test('Une sauvegarde locale se restaure en SQL sans perdre les cycles historiques ni casser les apostrophes',async()=>{
 const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));
 seed.records[0].notes="L'opérateur a vérifié le moule; SELECT n'est que du texte.";
 seed.records[0].cycle_seconds=6;
 seed.presses[0].active=false;
 const dir=mkdtempSync(join(tmpdir(),'qos-backup-test-')),input=join(dir,'backup.json'),output=join(dir,'restore.sql');
 const db=new PGlite();
 try{
  writeFileSync(input,JSON.stringify({version:1,...seed}));
  const generated=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/backup-to-sql.mjs',import.meta.url)),input,output],{encoding:'utf8'});
  assert.equal(generated.status,0,generated.stderr);
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`);
  await db.exec(readFileSync(new URL('../supabase/01_schema.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/03_stop_journal.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(output,'utf8'));
  const r=(await db.query('select * from public.production_records where id=$1',[seed.records[0].id])).rows[0];
  assert.equal(r.notes,seed.records[0].notes);assert.equal(Number(r.cycle_seconds),6);
  assert.equal((await db.query('select * from public.production_records')).rows.length,63);
  assert.equal((await db.query("select tgenabled from pg_trigger where tgname='prepare_production_record'")).rows[0].tgenabled,'O');
 }finally{await db.close();for(const f of [input,output])try{unlinkSync(f);}catch{}rmdirSync(dir);}
});
