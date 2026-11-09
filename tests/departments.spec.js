import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { departmentSeed } from '../src/departments.js';
import { calculate } from '../src/domain.js';

async function selectDepartment(page, name) {
  const open = page.getByRole('button',{name:'Ouvrir le menu',exact:true});
  if (await open.isVisible()) await open.click();
  await page.getByRole('button',{name:'Changer de département',exact:true}).click();
  await page.getByRole('group',{name:'Choisir un département'}).getByRole('button',{name,exact:true}).click();
  await expect(page.locator('.breadcrumb')).toContainText(name);
}
async function navigate(page, name) {
  const open = page.getByRole('button',{name:'Ouvrir le menu',exact:true});
  if (await open.isVisible()) await open.click();
  await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
}

for (const [department,name,loss] of [
  ['metallization','Métallisation','Panne Vaccum'],
  ['screen-printing','Sérigraphie','Panne four'],
  ['assembly','Assemblage','Panne machine'],
  ['welding','Soudure','Rupture SFIN'],
]) test(`${name} : paramètres, saisie, journal, historique, Excel et isolation`, async ({page}) => {
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await selectDepartment(page,name);
  await expect(page.locator('.daily-fleet tbody tr')).toHaveCount(1);
  await navigate(page,'Configuration');
  await expect(page.getByRole('heading',{name:'Objectifs TRS / DLE',exact:true})).toBeVisible();
  await expect(page.getByLabel('Objectif (%)',{exact:true})).toHaveCount(0);
  await navigate(page,'Équipements & articles');
  await page.getByRole('button',{name:/^Articles/}).click();
  await expect(page.locator('.reference-card')).toHaveCount(departmentSeed(department).articles.length);
  await page.screenshot({path:`.runtime/${department}-parameters.png`,fullPage:true});
  await navigate(page,'Saisie de production');
  await expect(page.getByRole('combobox',{name:'Référence article',exact:true})).toBeVisible();
  const options=await page.getByRole('combobox',{name:'Référence article',exact:true}).locator('option').allTextContents();
  expect(options.some(value=>value.includes(departmentSeed(department).articles[0].code))).toBe(true);
  await expect(page.getByLabel('Panne moule',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Problème qualité',{exact:true})).toHaveCount(1);
  if(department==='metallization') {
    await expect(page.getByLabel('Panne ligne de peinture',{exact:true})).toBeVisible();
    await expect(page.getByLabel('Panne machine',{exact:true})).toHaveCount(0);
  }
  if(department==='welding') {
    await expect(page.getByLabel('Rupture SFIN',{exact:true})).toBeVisible();
    await expect(page.getByLabel('Rupture MP',{exact:true})).toHaveCount(0);
    await expect(page.getByLabel('Panne four',{exact:true})).toHaveCount(0);
    await expect(page.locator('.article-detail')).toContainText('5,940');
    await expect(page.locator('.entry-summary')).toContainText('80,0 %');
    expect(await page.locator('.save-button').evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgb(180, 35, 50)');
  }
  await page.getByLabel('Date de production',{exact:true}).fill('2026-11-06');
  await page.getByLabel('Quantité conforme',{exact:true}).fill('100');
  await page.getByLabel('Heures dépensées',{exact:true}).fill('8');
  await page.getByLabel('Commentaire du poste').fill(`DEPT ${department}`);
  await page.getByRole('checkbox',{name:'Utiliser les arrêts horodatés'}).check();
  await page.getByRole('button',{name:'Ajouter un arrêt',exact:true}).click();
  const category=department==='metallization'?'mold':department==='screen-printing'?'peripherals':department==='welding'?'material':'breakdown';
  await page.getByLabel('Catégorie arrêt 1',{exact:true}).selectOption(category);
  await expect(page.getByLabel(loss,{exact:true})).toHaveValue('10');
  await page.getByRole('button',{name:'Enregistrer le relevé',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Relevé enregistré');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const row=await page.evaluate(id=>JSON.parse(localStorage.getItem(`qos-${id}-v1`)).records[0],department);
  expect(row.department).toBe(department);
  expect(row.standard_operators).toBe(departmentSeed(department).articles[0].standard_operators);
  expect(row.trs_target).toBe(department==='metallization'?.7:.8);
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exporter Excel',exact:true}).click();
  const download=await downloading;expect(download.suggestedFilename()).toContain(name);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(readFileSync(await download.path()));
  expect(workbook.getWorksheet('Synthèse').getCell('A1').value).toBe(`QOS · ${name}`);
  expect(workbook.getWorksheet('Relevés').rowCount).toBe(2);
  expect(workbook.getWorksheet('Synthèse').getCell('B14').result).toBe(calculate(row).dle);
  await page.getByRole('button',{name:'Modifier',exact:true}).click();
  await page.getByLabel('Quantité conforme',{exact:true}).fill('110');
  await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Relevé enregistré');
  await navigate(page,'Courbes');await expect(page.getByTestId('curves-dle')).not.toHaveText('—');
  await navigate(page,'Bilan J−1');await page.getByLabel('Date du bilan journalier').fill('2026-11-06');
  await expect(page.locator('.daily-press-card')).toContainText('110');
  await page.screenshot({path:`.runtime/${department}-daily.png`,fullPage:true});
  await selectDepartment(page,'Injection');await navigate(page,'Historique des relevés');
  await expect(page.locator('.count')).toHaveText('63');
  await selectDepartment(page,name);await navigate(page,'Historique des relevés');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('textbox',{name:'Rechercher un relevé'}).fill(`DEPT ${department}`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('110');
  await page.reload();await expect(page.locator('.breadcrumb')).toContainText(name);
  expect(errors).toEqual([]);
});

test('Les brouillons et les préférences restent séparés entre espaces, y compris sur mobile', async ({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  for(const [name,note] of [['Assemblage','Brouillon assemblage'],['Métallisation','Brouillon métal'],['Sérigraphie','Brouillon sérigraphie'],['Soudure','Brouillon soudure']]) {
    await selectDepartment(page,name);await navigate(page,'Saisie de production');
    await expect(page.getByLabel('Commentaire du poste')).toHaveValue('');
    await page.getByLabel('Commentaire du poste').fill(note);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await selectDepartment(page,'Assemblage');await navigate(page,'Saisie de production');
  await expect(page.getByLabel('Commentaire du poste')).toHaveValue('Brouillon assemblage');
  await page.screenshot({path:'.runtime/assembly-mobile.png',fullPage:true});
});

test('Soudure : identité rouge, saisie conservée en mode nuit et affichage mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');await selectDepartment(page,'Soudure');
  await navigate(page,'Saisie de production');
  await page.getByLabel('Commentaire du poste').fill('Brouillon soudure rouge');
  await page.screenshot({path:'.runtime/welding-mobile-day.png',fullPage:true});
  await page.getByRole('button',{name:'Mode nuit',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.getByLabel('Commentaire du poste')).toHaveValue('Brouillon soudure rouge');
  expect(await page.locator('.save-button').evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgb(180, 35, 50)');
  expect(await page.locator('.app').evaluate(element=>getComputedStyle(element).getPropertyValue('--dept-accent').trim())).toBe('#ffb3b8');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.runtime/welding-mobile-night.png',fullPage:true});
  await page.reload();await navigate(page,'Saisie de production');
  await expect(page.getByLabel('Commentaire du poste')).toHaveValue('Brouillon soudure rouge');
});

test('Configurer un article garde les standards historiques et applique les nouveaux paramètres aux futures saisies', async ({page})=>{
  await page.goto('/');await selectDepartment(page,'Assemblage');await navigate(page,'Équipements & articles');
  await page.getByRole('button',{name:/^Articles/}).click();
  await page.getByRole('button',{name:'Ajouter un article',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Désignation article',{exact:true}).fill('Article assemblage test');
  await dialog.getByLabel('Référence article',{exact:true}).fill('ASS-02');
  await dialog.getByLabel('Temps de cycle (s / pièce)',{exact:true}).fill('4.2');
  await dialog.getByLabel('Temps standard (s / pièce)',{exact:true}).fill('18');
  await dialog.getByLabel('Effectif standard',{exact:true}).fill('2.5');
  await dialog.getByLabel('Objectif TRS (%)',{exact:true}).fill('75');
  await dialog.getByLabel('Objectif DLE (%)',{exact:true}).fill('82');
  await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await navigate(page,'Saisie de production');
  await page.getByRole('combobox',{name:'Référence article',exact:true}).selectOption({label:'ASS-02 · Article assemblage test'});
  await page.getByLabel('Date de production',{exact:true}).fill('2026-11-06');
  await page.getByLabel('Quantité conforme',{exact:true}).fill('100');
  await page.getByLabel('Heures dépensées',{exact:true}).fill('10');
  await page.getByRole('button',{name:'Enregistrer le relevé',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await navigate(page,'Équipements & articles');
  await page.getByRole('button',{name:/^Articles/}).click();
  await page.getByRole('button',{name:'Modifier Article assemblage test',exact:true}).click();
  await dialog.getByLabel('Temps standard (s / pièce)',{exact:true}).fill('38');
  await dialog.getByLabel('Effectif standard',{exact:true}).fill('5');
  await dialog.getByLabel('Objectif TRS (%)',{exact:true}).fill('60');
  await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await navigate(page,'Historique des relevés');await page.getByRole('button',{name:'Modifier',exact:true}).click();
  await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  let row=await page.evaluate(()=>JSON.parse(localStorage.getItem('qos-assembly-v1')).records[0]);
  expect(row.standard_seconds).toBe(18);expect(row.standard_operators).toBe(2.5);expect(row.trs_target).toBe(.75);
  await navigate(page,'Saisie de production');
  await page.getByRole('combobox',{name:'Référence article',exact:true}).selectOption({label:'ASS-02 · Article assemblage test'});
  await page.getByLabel('Date de production',{exact:true}).fill('2026-11-07');
  await page.getByLabel('Quantité conforme',{exact:true}).fill('100');
  await page.getByLabel('Heures dépensées',{exact:true}).fill('10');
  await page.getByRole('button',{name:'Enregistrer le relevé',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  row=await page.evaluate(()=>JSON.parse(localStorage.getItem('qos-assembly-v1')).records[1]);
  expect(row.standard_seconds).toBe(38);expect(row.standard_operators).toBe(5);expect(row.trs_target).toBe(.6);
});
