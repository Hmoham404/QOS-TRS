import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {UNPLANNED_TYPES,EXTRA_LOSS_FIELDS} from '../src/losses.js';
import messages from '../src/locales/messages.js';
const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));

test('Les neuf causes demandées se sauvegardent, se recalculent et restent traduites sur mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Saisie de production',exact:true}).click();
 await page.getByLabel('Date de production').fill('2026-10-23');
 await page.getByLabel('Quantité conforme',{exact:true}).fill('100');
 for(const [,type] of UNPLANNED_TYPES)await page.getByLabel(type.source,{exact:true}).fill('5');
 await expect(page.locator('.loss-subtotal')).toContainText('55,0');
 await expect(page.locator('.machine-time')).toContainText('425,0');
 await page.screenshot({path:'.runtime/losses-entry-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Enregistrer le relevé',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Relevé enregistré');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qos-injection-v1')).records.find(r=>r.date==='2026-10-23'));
 for(const field of [...EXTRA_LOSS_FIELDS,'breakdown_min','startup_min','changeover_min'])expect(saved[field]).toBe(5);
 await page.reload();await page.getByRole('button',{name:'Saisie de production',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 for(const lang of ['en','ar','it','zh']){
  const languageName={en:'English (EN)',ar:'العربية (AR)',it:'Italiano (IT)',zh:'中文 (ZH)'}[lang];
  await page.getByRole('button',{name:languageName,exact:true}).click();
  for(const [,type] of UNPLANNED_TYPES)await expect(page.getByLabel(messages[type.source][lang],{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(lang==='ar')await page.screenshot({path:'.runtime/losses-entry-ar-mobile.png',fullPage:true});
 }
 expect(errors).toEqual([]);
});

test('Chaque courbe affiche ses valeurs, y compris zéro ; les valeurs absentes ne sont pas inventées',async({page})=>{
 const data=structuredClone(seed);data.records=data.records.slice(3,6).map((r,i)=>({...r,date:`2026-10-0${i+1}`,opening_min:480,planned_min:0,breakdown_min:0,startup_min:0,changeover_min:0,good_qty:i===0?0:100,startup_rejects:0,production_rejects:0,planned_qty:i===2?null:200}));
 await page.addInitScript(data=>localStorage.setItem('qos-injection-v1',JSON.stringify(data)),data);
 await page.goto('/');await page.getByRole('button',{name:'Courbes',exact:true}).click();
 for(const name of ['TRS global de l’atelier','DLE de l’atelier','TRS par machine','Taux de respect du planning']){
  const chart=page.getByRole('region',{name,exact:true});
  await expect(chart.locator('.chart-point-value').first()).toBeVisible();
  expect(await chart.locator('.chart-point-value').count()).toBeGreaterThan(0);
 }
 const plan=page.getByRole('region',{name:'Taux de respect du planning',exact:true});
 await expect(plan.locator('.chart-point-value')).toHaveCount(2);
 await expect(plan.locator('.chart-point-value').first()).toHaveText('0,0 %');
 await page.screenshot({path:'.runtime/losses-curves-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Vue d’ensemble',exact:true}).click();
 await expect(page.locator('.trend-chart .chart-point-value')).toHaveCount(3);
 await page.getByLabel('Indicateur du graphique').selectOption('dle');
 await expect(page.locator('.trend-chart .chart-point-value')).toHaveCount(3);
 await page.screenshot({path:'.runtime/refined-dashboard-desktop.png',fullPage:true});
});

test('Une perte du journal alimente les champs et le Pareto sans double comptage',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Saisie de production',exact:true}).click();
 await page.getByLabel('Date de production').fill('2026-10-23');
 await page.getByRole('checkbox',{name:/Utiliser les arrêts horodatés/}).check();
 await page.getByRole('button',{name:'Minutes depuis le début',exact:true}).click();
 await page.getByRole('button',{name:'Ajouter un arrêt',exact:true}).click();
 await page.getByLabel('Catégorie arrêt 1',{exact:true}).selectOption('material');
 await page.getByLabel('Début arrêt 1',{exact:true}).fill('10');
 await page.getByLabel('Fin arrêt 1',{exact:true}).fill('30');
 await expect(page.getByLabel('Rupture MP',{exact:true})).toHaveValue('20');
 await expect(page.getByLabel('Rupture MP',{exact:true})).toBeDisabled();
 await expect(page.locator('.machine-time')).toContainText('460,0');
 await page.getByRole('button',{name:'Enregistrer le relevé',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Relevé enregistré');
 await page.getByRole('button',{name:'Vue d’ensemble',exact:true}).click();
 await page.getByLabel('Date de début').fill('2026-10-23');
 await expect(page.locator('.pareto-summary strong')).toContainText('20,0');
 await expect(page.locator('.cause-ranking')).toContainText('Rupture MP');
 await expect(page.locator('.analysis-chart .chart-point-value')).toHaveText('100,0 %');
});
