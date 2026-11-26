import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import {departmentSeed} from '../src/departments.js';

test('Les sept références permettent une production et un tri indépendants du même produit et du même poste',async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const data=departmentSeed('assembly');
  const article=data.articles[1];
  const legacy=structuredClone(data);
  legacy.articles[1].name='Tri · '+article.name;
  await page.addInitScript(seed=>{
    if(!localStorage.getItem('independent-test-initialized')){
      localStorage.setItem('qos-department','assembly');
      localStorage.setItem('qos-assembly-v1',JSON.stringify(seed));
      localStorage.setItem('independent-test-initialized','1');
    }
  },legacy);
  const navigate=async name=>{
    await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
  };
  await page.goto('/');
  await navigate('Saisie de production');
  const activity=page.getByLabel('Activité du relevé',{exact:true});
  const references=page.getByRole('combobox',{name:'Référence article',exact:true});
  await expect(activity).toHaveValue('production');
  await expect(references.locator('option')).toHaveCount(8);
  for(const item of data.articles)await expect(references.locator(`option[value="${item.id}"]`)).toHaveText(`${item.code} · ${item.name}`);
  await references.selectOption(article.id);
  await page.getByLabel('Date de production',{exact:true}).fill('2026-11-26');
  await page.getByLabel('Quantité conforme',{exact:true}).fill('500');
  await page.locator('[name=operator_count]').fill('2');
  await page.locator('[name=labor_duration_hours]').fill('8');
  await activity.selectOption('sorting');
  await expect(references).toHaveValue(article.id);
  await activity.selectOption('production');
  await expect(references).toHaveValue(article.id);
  await expect(page.getByLabel('Quantité conforme',{exact:true})).toHaveValue('500');
  await page.getByRole('button',{name:'Enregistrer le relevé',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);

  await navigate('Saisie de production');
  await activity.selectOption('sorting');
  await references.selectOption(article.id);
  await page.getByLabel('Date du tri',{exact:true}).fill('2026-11-26');
  await page.getByLabel('Heures de tri',{exact:true}).fill('12.5');
  await expect(page.locator('.entry-layout .error')).toHaveCount(0);
  await page.getByRole('button',{name:'Enregistrer le relevé',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('tbody tr').filter({hasText:'Tri uniquement'})).toHaveCount(1);
  await page.reload();
  await navigate('Historique des relevés');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.locator('tbody tr').filter({hasText:'Tri uniquement'}).getByRole('button',{name:'Modifier',exact:true}).click();
  await expect(activity).toHaveValue('sorting');
  await page.getByLabel('Heures de tri',{exact:true}).fill('15');
  await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('qos-assembly-v1')).records);
  const production=records.find(row=>row.good_qty>0),sorting=records.find(row=>row.sorting_hours>0);
  expect(production.article_id).toBe(sorting.article_id);
  expect(production.date).toBe(sorting.date);
  expect(production.shift).toBe(sorting.shift);
  expect(production.press_id).toBe(sorting.press_id);
  expect(production.good_qty).toBe(500);
  expect(sorting.good_qty).toBe(0);
  expect(sorting.sorting_hours).toBe(15);

  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exporter Excel',exact:true}).click();
  const download=await downloading;
  const book=new ExcelJS.Workbook();
  await book.xlsx.load(readFileSync(await download.path()));
  const details=book.getWorksheet('Relevés'),headers=details.getRow(1).values;
  expect(details.rowCount).toBe(3);
  expect([details.getCell(2,headers.indexOf('Activité')).value,details.getCell(3,headers.indexOf('Activité')).value].sort()).toEqual(['Production','Tri uniquement']);
  expect(book.getWorksheet('Synthèse').getCell('B7').result).toBe(500);

  await page.locator('.brand').click();
  await page.getByLabel('Date analysée').fill('2026-11-26');
  const card=page.locator('.comparison-card[data-department="assembly"]');
  await expect(card.locator('.comparison-quality strong')).toHaveText(['0,0 %','500','0','15,00 h']);
  await expect(card.locator('.comparison-metrics').first().locator('strong').first()).not.toHaveText('—');
  await card.screenshot({path:'.runtime/assembly-independent-production-sorting.png'});
  expect(errors).toEqual([]);
});
