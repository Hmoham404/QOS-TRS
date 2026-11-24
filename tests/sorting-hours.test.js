import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { aggregate, calculate, validateRecord } from '../src/domain.js';
import { createLocalStore } from '../src/local-data.js';
import { buildExcelExport } from '../src/excel-export.js';
const seed = JSON.parse(readFileSync(new URL('../src/seed.json', import.meta.url), 'utf8'));

test('Les heures de tri restent indépendantes du DLE, se totalisent et distinguent zéro des heures absentes', () => {
  const row = { ...seed.records[3], sorting_hours: 2.5 };
  assert.deepEqual(validateRecord(row), []);
  assert.equal(calculate(row).dle, calculate(seed.records[3]).dle);
  const totals = aggregate([row, { ...row, sorting_hours: 0 }, { ...row, sorting_hours: 1.25 }, seed.records[4]]);
  assert.equal(totals.sorting, 3.75);
  assert.equal(totals.sortingCount, 3);
  assert.equal(aggregate(seed.records).sortingCount, 0);
  for (const value of [-1, Infinity, NaN, '2', 1000001]) assert.ok(validateRecord({ ...row, sorting_hours: value }).length);
});

test('Le stockage et les exports Excel conservent les heures de tri, y compris zéro et la suppression', async () => {
  const values = new Map();
  const store = createLocalStore(seed, { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  const row = { ...seed.records[3], id: crypto.randomUUID(), date: '2026-11-24', sorting_hours: 2.5 };
  store.saveRecord(row);
  let data = store.read();
  let saved = data.records.find(item => item.id === row.id);
  assert.equal(saved.sorting_hours, 2.5);
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await buildExcelExport([saved], data));
  const details = book.getWorksheet('Relevés');
  const column = details.getRow(1).values.indexOf('Heures de tri');
  assert.ok(column > 0);
  assert.equal(details.getCell(2, column).value, 2.5);
  for (const sorting_hours of [0, null]) {
    store.saveRecord({ ...saved, sorting_hours });
    saved = store.read().records.find(item => item.id === row.id);
    assert.equal(saved.sorting_hours, sorting_hours);
  }
});

test('La migration SQL est rejouable, accepte zéro et ne modifie pas les anciens relevés', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;');
    for (const file of ['01_schema.sql', '02_import_excel.sql', '14_sorting_hours.sql', '14_sorting_hours.sql']) await db.exec(readFileSync(new URL('../supabase/' + file, import.meta.url), 'utf8'));
    assert.equal((await db.query('select count(*)::int as n from production_records where sorting_hours is null')).rows[0].n, 63);
    const id = seed.records[3].id;
    for (const value of [2.5, 0, null]) {
      await db.query('update production_records set sorting_hours=$1 where id=$2', [value, id]);
      const stored = (await db.query('select sorting_hours from production_records where id=$1', [id])).rows[0].sorting_hours;
      assert.equal(stored == null ? null : Number(stored), value);
    }
    for (const value of [-1, 1000001, 'NaN']) await assert.rejects(db.query('update production_records set sorting_hours=$1 where id=$2', [value, id]));
  } finally { await db.close(); }
});
