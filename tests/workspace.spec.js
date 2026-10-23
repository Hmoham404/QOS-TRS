import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import messages from '../src/locales/messages.js';
const names = { en:'English (EN)', ar:'العربية (AR)', it:'Italiano (IT)', zh:'中文 (ZH)', fr:'Français (FR)' };
const label = (key,language) => language === 'fr' ? key : messages[key][language];

test('Toutes les pages changent de langue, les préférences persistent et l’arabe utilise RTL', async ({ page }) => {
  test.setTimeout(90000);
  const errors = []; page.on('pageerror',error => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Date du bilan journalier').fill('2026-10-08');
  for (const language of ['en','ar','it','zh','fr']) {
    await page.getByRole('button',{name:names[language],exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('lang',language);
    await expect(page.locator('html')).toHaveAttribute('dir',language === 'ar' ? 'rtl' : 'ltr');
    for (const [navigation,title] of [
      ['Vue d’ensemble','Tableau de bord de l’atelier'],['Courbes','Courbes de performance'],
      ['Saisie de production','Saisie de production'],['Historique des relevés','Historique des relevés'],
      ['Presses & moules','Presses & moules'],['Configuration','Configuration'],['Bilan J−1','Bilan journalier de l’atelier'],
    ]) {
      await page.getByRole('navigation').getByRole('button',{name:label(navigation,language),exact:true}).click();
      await expect(page.locator('h1')).toContainText(label(title,language));
      if (navigation === 'Vue d’ensemble') {
        expect(await page.locator('.shift-chart .recharts-bar-rectangle').count()).toBeGreaterThan(0);
        await page.screenshot({path:`.runtime/workspace-${language}-desktop.png`,fullPage:true});
      }
      if (language !== 'fr') {
      const untranslated = await page.locator('.app').evaluate((root,catalog) => {
        const validTranslations = new Set(Object.values(catalog));
        const nodes = document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
        const found = new Set(); let node;
        while ((node=nodes.nextNode())) {
          const parent=node.parentElement, text=node.textContent.replace(/\s+/g,' ').trim();
          if (parent.closest('.language-picker,script,style,code') || !parent.getBoundingClientRect().width || !parent.getBoundingClientRect().height) continue;
          if (catalog[text] && catalog[text] !== text && !validTranslations.has(text)) found.add(text);
        }
        return [...found];
      }, Object.fromEntries(Object.entries(messages).map(([key,value])=>[key,value[language]])));
      expect(untranslated).toEqual([]);
      }
    }
  }
  await page.getByRole('button',{name:names.it,exact:true}).click(); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','it');
  expect(errors).toEqual([]);
});

test('Les quatre nouveaux départements restent vides et le retour préserve les données Injection', async ({ page }) => {
  await page.goto('/');
  for (const department of ['Assemblage','Soudure','Métallisation','Sérigraphie']) {
    await page.getByRole('button',{name:'Changer de département',exact:true}).click();
    await page.getByRole('group',{name:'Choisir un département'}).getByRole('button',{name:department,exact:true}).click();
    await expect(page.locator('h1')).toContainText(department);
    await expect(page.getByRole('heading',{name:'Aucune donnée dans ce département'})).toBeVisible();
    await expect(page.locator('.daily-fleet,.hero-number,.reference-grid')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Nouvelle saisie',exact:true})).toHaveCount(0);
  }
  await page.reload(); await expect(page.locator('h1')).toContainText('Sérigraphie');
  await page.getByRole('button',{name:'Retour à Injection'}).click();
  await page.getByRole('button',{name:'Vue d’ensemble',exact:true}).click();
  await expect(page.locator('.strip-records')).toContainText('63 relevés');
});

test('La saisie reste fonctionnelle en anglais et le téléchargement XLSX respecte les filtres', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button',{name:names.en,exact:true}).click();
  await page.getByRole('button',{name:'Production entry',exact:true}).click();
  await page.getByLabel('Production date',{exact:true}).fill('2026-10-23');
  expect(await page.getByRole('combobox',{name:'Shift',exact:true}).locator('option').evaluateAll(options => options.map(option=>option.value))).toEqual(['Matin','Après-Midi','Nuit']);
  await page.getByRole('combobox',{name:'Shift',exact:true}).selectOption({value:'Nuit'});
  await page.getByLabel('Good quantity',{exact:true}).fill('120');
  await page.getByLabel('Shift comment').fill('EN WORKSPACE TEST');
  await page.getByRole('button',{name:'Save record',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Record saved successfully');
  await page.getByRole('textbox',{name:'Search records'}).fill('EN WORKSPACE TEST');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Night');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export Excel',exact:true}).click();
  const download=await downloading;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(readFileSync(await download.path()));
  expect(workbook.worksheets[1].rowCount).toBe(2);
  expect(workbook.worksheets[1].getCell('N2').value).toBe(120);
  expect(workbook.worksheets[1].getCell('B2').value).toBe('Night');
  expect(workbook.worksheets[1].getCell('Z2').value).toBe('EN WORKSPACE TEST');
});

test('Les contrôles de langue et département restent utilisables sur mobile, y compris en arabe', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/');
  await page.getByRole('button',{name:names.ar,exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:label('Ouvrir le menu','ar')}).click();
  await page.getByRole('button',{name:label('Changer de département','ar')}).click();
  await page.getByRole('button',{name:label('Assemblage','ar'),exact:true}).click();
  await expect(page.getByRole('heading',{name:label('Aucune donnée dans ce département','ar')})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.runtime/workspace-arabic-mobile.png',fullPage:true});
});

for (const language of ['ar','it','zh']) test(`La saisie en ${language} conserve les valeurs métier et les modifications lors du changement de langue`, async ({ page }) => {
  await page.goto('/'); await page.getByRole('button',{name:names[language],exact:true}).click();
  await page.getByRole('button',{name:label('Saisie de production',language),exact:true}).click();
  await page.getByLabel(label('Date de production',language),{exact:true}).fill('2026-10-23');
  await page.getByRole('combobox',{name:label('Poste',language),exact:true}).selectOption({value:'Nuit'});
  await page.getByLabel(label('Quantité conforme',language),{exact:true}).fill('150');
  await page.getByLabel(label('Quantité planifiée',language),{exact:true}).fill('200');
  await page.getByLabel(label('Commentaire du poste',language)).fill(`${language} WORKSPACE SAVE`);
  await page.getByRole('button',{name:names.fr,exact:true}).click();
  await expect(page.getByLabel('Quantité conforme',{exact:true})).toHaveValue('150');
  await page.getByRole('button',{name:names[language],exact:true}).click();
  await page.getByRole('button',{name:label('Enregistrer le relevé',language),exact:true}).click();
  await expect(page.getByRole('status')).toContainText(label('Relevé enregistré avec succès.',language));
  await page.getByRole('textbox',{name:label('Rechercher un relevé',language)}).fill(`${language} WORKSPACE SAVE`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText(label('Nuit',language));
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qos-injection-v1')).records.at(-1));
  expect(saved.shift).toBe('Nuit'); expect(saved.good_qty).toBe(150); expect(saved.planned_qty).toBe(200);
});

test('Le pont Android reçoit un fichier Excel binaire en base64 sans corruption', async ({ browser }) => {
  const context=await browser.newContext({userAgent:'Mozilla/5.0 QOSAndroid/1.1'});
  try {
    const page=await context.newPage();
    await page.addInitScript(()=>{ window.prompt=message=>{ if(message.startsWith('QOS_NATIVE:'))window.nativeExport=JSON.parse(message.slice(11)); return 'ok'; }; });
    await page.goto('/'); await page.getByRole('button',{name:'Configuration',exact:true}).click();
    await page.getByRole('button',{name:'Exporter Excel',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.nativeExport?.encoding)).toBe('base64');
    const exported=await page.evaluate(()=>window.nativeExport);
    const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(exported.content,'base64'));
    expect(workbook.getWorksheet('Relevés').rowCount).toBe(64);
    expect(workbook.getWorksheet('Synthèse').getCell('B7').result).toBe(219520);
  } finally { await context.close(); }
});
