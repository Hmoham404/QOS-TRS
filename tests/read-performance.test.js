import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('L’index de lecture est rejouable et sert la pagination par département sur un historique volumineux',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create table public.production_records(id uuid primary key,department text not null);
      insert into public.production_records select gen_random_uuid(),case when n%2=0 then 'welding' else 'injection' end from generate_series(1,10000) n;`);
    const migration=readFileSync(new URL('../supabase/09_read_performance.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration);await db.exec('analyze public.production_records');
    const plan=await db.query("explain (format json) select * from public.production_records where department='welding' and id>'80000000-0000-0000-0000-000000000000' order by id limit 1000");
    assert.ok(JSON.stringify(plan.rows).includes('production_records_department_id'));
    assert.equal((await db.query('select count(*)::int n from public.production_records')).rows[0].n,10000);
    const first=await db.query("select id from public.production_records where department='welding' order by id limit 1000");
    const next=await db.query("select id from public.production_records where department='welding' and id>$1 order by id limit 1000",[first.rows.at(-1).id]);
    assert.equal(new Set([...first.rows,...next.rows].map(row=>row.id)).size,2000);
  } finally { await db.close(); }
});
