import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { buildExcelExport } from '../src/excel-export.js';
import { aggregate } from '../src/domain.js';
import { setLanguage } from '../src/i18n.js';
const seed = JSON.parse(readFileSync(new URL('../src/seed.json', import.meta.url),'utf8'));

test('Export XLSX : vrais nombres et dates, 63 relevés, synthèse pondérée et commentaires conservés comme texte', async () => {
  const rows = structuredClone(seed.records); rows[0].notes = '=1+1'; rows[0].planned_qty = 0;
  const buffer = await buildExcelExport(rows,seed);
  assert.equal(buffer.subarray(0,2).toString(),'PK');
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
  assert.equal(workbook.worksheets.length,2);
  const details = workbook.getWorksheet('Relevés'), summary = workbook.getWorksheet('Synthèse');
  assert.equal(details.rowCount,64);
  assert.equal(details.getCell('N2').type,ExcelJS.ValueType.Number);
  assert.equal(details.getCell('A2').type,ExcelJS.ValueType.Date);
  assert.equal(details.getCell('U2').numFmt,'0.0%');
  assert.ok(details.getColumn(26).values.includes('=1+1'));
  assert.equal(summary.getCell('B7').result,219520);
  assert.equal(summary.getCell('B13').result,aggregate(rows).trs);
  assert.ok(summary.getCell('B13').formula.includes('SUMPRODUCT'));
});

test('Export filtré et traduit : seulement le périmètre demandé et lecture arabe de droite à gauche', async () => {
  try {
    setLanguage('ar');
    const rows = seed.records.filter(row => row.date === '2026-10-08' && row.shift === 'Matin');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await buildExcelExport(rows,seed));
    assert.equal(workbook.worksheets[1].rowCount,rows.length+1);
    assert.equal(workbook.worksheets[1].getCell('B2').value,'الصباح');
    assert.equal(workbook.worksheets[1].views[0].rightToLeft,true);
    assert.equal(workbook.worksheets[0].getCell('B7').result,aggregate(rows).good);
  } finally { setLanguage('fr'); }
});
