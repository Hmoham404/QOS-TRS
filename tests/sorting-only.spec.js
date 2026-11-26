import {test,expect} from '@playwright/test';
import {departmentSeed} from '../src/departments.js';
import {extraLossDefaults} from '../src/losses.js';

test('Assemblage trie les références Métallisation sans ajouter de production ; brouillon, modification et comparaison',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const metal=departmentSeed('metallization'),article=metal.articles[0];
  metal.records=[{
    id:crypto.randomUUID(),department:'metallization',date:'2026-11-26',shift:'Matin',
    press_id:metal.presses[0].id,article_id:article.id,opening_min:450,planned_min:0,
    ...extraLossDefaults(),breakdown_min:0,startup_min:0,changeover_min:0,
    good_qty:1000,startup_rejects:0,production_rejects:0,labor_hours:8,
    cycle_seconds:article.mold_cycle_seconds,standard_seconds:article.standard_seconds,
    source:'web',notes:'Production Métallisation',
  }];
  await page.addInitScript(data=>{
    if(!localStorage.getItem('sorting-ui-initialized')){
      localStorage.setItem('qos-department','assembly');
      localStorage.setItem('qos-metallization-v1',JSON.stringify(data));
      localStorage.setItem('sorting-ui-initialized','1');
    }
  },metal);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button',{name:'Saisie de production',exact:true}).click();
  const activity=page.getByLabel('Activité du relevé',{exact:true});
  const references=page.getByRole('combobox',{name:'Référence article',exact:true});
  await expect(references.locator('option')).toHaveCount(8);
  expect(await references.locator('option').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('Tri · ')]));
  await activity.selectOption('sorting');
  await expect(references.locator('option')).toHaveCount(8);
  await references.selectOption(departmentSeed('assembly').articles[1].id);
  await page.getByLabel('Date du tri',{exact:true}).fill('2026-11-26');
  await expect(page.getByLabel('Quantité conforme',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Durée du poste',{exact:true})).toHaveCount(0);
  await page.getByLabel('Heures de tri',{exact:true}).fill('12.5');
  await page.getByLabel('Numéro OF',{exact:true}).fill('TRI-METAL-01');
  await page.reload();
  await page.getByRole('navigation').getByRole('button',{name:'Saisie de production',exact:true}).click();
  await expect(page.getByLabel('Activité du relevé',{exact:true})).toHaveValue('sorting');
  await expect(page.getByLabel('Heures de tri',{exact:true})).toHaveValue('12.5');
  await page.getByRole('button',{name:'Enregistrer le relevé',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Relevé enregistré'})).toBeVisible();
  await expect(page.locator('tbody')).toContainText('Tri uniquement');
  await page.getByRole('button',{name:'Modifier',exact:true}).click();
  await expect(page.getByLabel('Activité du relevé',{exact:true})).toHaveValue('sorting');
  await expect(page.getByLabel('Heures de tri',{exact:true})).toHaveValue('12.5');
  await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Relevé enregistré'})).toBeVisible();
  await page.locator('.brand').click();
  await page.getByLabel('Date analysée').fill('2026-11-26');
  const assembly=page.locator('.comparison-card[data-department="assembly"]');
  await expect(assembly.locator('.comparison-quality strong')).toHaveText(['—','0','0','12,50 h']);
  await expect(assembly.locator('.comparison-metrics').first().locator('strong')).toHaveText(['—','—','—','—']);
  await expect(page.locator('.comparison-card[data-department="metallization"] .comparison-quality strong')).toHaveText(['0,0 %','1 000','0','— h']);
  await page.getByRole('navigation').getByRole('button',{name:'Bilan J−1',exact:true}).click();
  await page.getByLabel('Date du bilan journalier').fill('2026-11-26');
  await expect(page.locator('.daily-fleet tbody')).toContainText('Tri uniquement');
  await expect(page.locator('.daily-fleet tbody')).not.toContainText('Arrêt déclaré');
  await page.getByRole('navigation').getByRole('button',{name:'Saisie de production',exact:true}).click();
  await page.getByLabel('Activité du relevé',{exact:true}).selectOption('sorting');
  await page.getByRole('combobox',{name:'Référence article',exact:true}).selectOption(departmentSeed('assembly').articles[1].id);
  await page.getByLabel('Heures de tri',{exact:true}).fill('12.5');
  await expect(page.getByRole('status').filter({hasText:'Relevé enregistré'})).toBeHidden();
  await page.screenshot({path:'.runtime/sorting-only-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'.runtime/sorting-only-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
