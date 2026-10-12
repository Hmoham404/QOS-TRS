import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const seed=JSON.parse(readFileSync(new URL('../src/seed.json',import.meta.url),'utf8'));

test('Accueil J−1 : date réelle, presses, postes, absence de saisie et mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-10-09T10:00:00'));
 await page.goto('/');await expect(page.getByLabel('Date du bilan journalier')).toHaveValue('2026-10-08');
 await expect(page.locator('.daily-fleet tbody tr')).toHaveCount(16);await expect(page.locator('.daily-press-card')).toHaveCount(3);
 await expect(page.locator('.daily-hero')).toContainText('3 presses ont travaillé');
 await expect(page.locator('.daily-fleet .daily-status.missing')).toHaveCount(13);
 await page.screenshot({path:'.runtime/daily-desktop.png',fullPage:true});
 await page.getByLabel('Poste du bilan journalier').selectOption('Nuit');await expect(page.locator('.daily-fleet .daily-status.stopped')).toHaveCount(3);
 await expect(page.locator('.daily-hero')).toContainText('Aucune marche déclarée');
 await page.getByLabel('Poste du bilan journalier').selectOption('all');
 await page.getByLabel('Date du bilan journalier').fill('2026-10-04');await expect(page.locator('.daily-empty')).toBeVisible();
 await page.getByRole('button',{name:'Actualiser le bilan',exact:true}).click();await expect(page.getByLabel('Date du bilan journalier')).toHaveValue('2026-10-04');
 await page.getByRole('button',{name:'J−1',exact:true}).click();await expect(page.getByLabel('Date du bilan journalier')).toHaveValue('2026-10-08');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.runtime/daily-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Jour précédent',exact:true}).click();await expect(page.getByLabel('Date du bilan journalier')).toHaveValue('2026-10-07');
 await page.getByLabel('Date du bilan journalier').fill('2026-10-04');await page.getByRole('button',{name:'Saisir cette journée'}).click();await expect(page.getByLabel('Date de production')).toHaveValue('2026-10-04');
 expect(errors).toEqual([]);
});

test('Un seul PDF A4 paysage réunit production et défauts avec les filtres actifs',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-09T10:00:00'));await page.goto('/');
 await page.getByLabel('Presse du bilan journalier').selectOption(seed.records.find(r=>r.date==='2026-10-08').press_id);
 const printed=page.evaluate(()=>{window.print=()=>document.documentElement.dataset.qosPrint='opened';});await printed;
 await page.getByRole('button',{name:'Télécharger PDF Production et Défauts'}).click();await expect(page.locator('html')).toHaveAttribute('data-qos-print','opened');
 await page.emulateMedia({media:'print'});
 const report=page.getByTestId('daily-print-sheet');await expect(report).toBeVisible();await expect(page.locator('.daily-review')).not.toBeVisible();
 await expect(report.locator('.daily-print-section')).toHaveCount(2);await expect(report.getByRole('heading',{name:'Production par presse'})).toBeVisible();await expect(report.getByRole('heading',{name:'Rebuts et arrêts'})).toBeVisible();
 expect(await report.locator('.daily-print-table.production tbody tr').count()).toBe(1);expect(await report.locator('.daily-print-table.defects tbody tr').count()).toBe(1);
 const layout=await report.evaluate(e=>{const r=e.getBoundingClientRect(),sections=[...e.querySelectorAll('.daily-print-section')].map(s=>({scroll:s.scrollHeight,client:s.clientHeight}));return{width:r.width,height:r.height,scroll:e.scrollHeight,client:e.clientHeight,sections,grid:getComputedStyle(e.querySelector('.daily-print-columns')).gridTemplateColumns,page:getComputedStyle(document.querySelector('.daily-print-report')).breakInside};});
 expect(layout.width).toBeGreaterThan(1000);expect(layout.scroll).toBeLessThanOrEqual(layout.client+1);expect(layout.sections.every(s=>s.scroll<=s.client+1)).toBe(true);
 await page.screenshot({path:'.runtime/daily-pdf-print.png'});
 await page.emulateMedia({media:'screen'});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Courbe par presse : pauses, causes, heures de nuit, mise à jour et sauvegarde',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-10-09T10:00:00'));await page.goto('/');
 const r=seed.records.find(r=>r.date==='2026-10-08'&&r.shift==='Nuit');
 const press=seed.presses.find(p=>p.id===r.press_id);
 const card=page.getByRole('article',{name:'Analyse '+press.name,exact:true});
 await card.locator('.daily-record-link').filter({hasText:'Nuit'}).click();
 await page.getByRole('checkbox',{name:/Utiliser les arrêts horodatés/}).check();await expect(page.getByLabel('Heure de début du relevé')).toHaveValue('22:00');
 await page.getByRole('button',{name:'Ajouter un arrêt',exact:true}).click();
 await page.getByLabel('Heure de début arrêt 1',{exact:true}).fill('23:50');
 await page.getByLabel('Heure de fin arrêt 1',{exact:true}).fill('00:10');
 await page.getByLabel('Jour de fin arrêt 1',{exact:true}).selectOption('1');
 await page.getByLabel('Catégorie arrêt 1',{exact:true}).selectOption('planned');await page.getByLabel('Cause arrêt 1',{exact:true}).fill('Pause équipe');
 await page.getByRole('button',{name:'Ajouter un arrêt',exact:true}).click();
 await page.getByLabel('Heure de début arrêt 2',{exact:true}).fill('01:00');await page.getByLabel('Jour de début arrêt 2',{exact:true}).selectOption('1');
 await page.getByLabel('Heure de fin arrêt 2',{exact:true}).fill('01:10');await page.getByLabel('Jour de fin arrêt 2',{exact:true}).selectOption('1');
 await page.getByLabel('Cause arrêt 2',{exact:true}).fill('Hydraulique');
 await expect(page.getByLabel('Arrêts planifiés',{exact:true})).toHaveValue('20');await expect(page.getByLabel('Pannes',{exact:true})).toHaveValue('10');
 await page.screenshot({path:'.runtime/daily-journal.png',fullPage:true});
 await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();await expect(page.getByRole('status')).toContainText('Relevé enregistré');
 await expect(page.getByLabel('Date du bilan journalier')).toHaveValue('2026-10-08');await expect(card.locator('.daily-curve')).toBeVisible();
 await card.getByRole('button',{name:/Pauses & causes d’arrêt/}).click();await expect(card.locator('.daily-stop-list')).toContainText('Pause équipe');await expect(card.locator('.daily-stop-list')).toContainText('00:10 J+1');
 await card.getByRole('button',{name:/Pause équipe, 20,0 minutes/}).focus();await expect(card.locator('.daily-curve-legend')).toContainText('20,0 min');
 await card.screenshot({path:'.runtime/daily-curve-desktop.png'});
 await page.reload();await expect(page.getByRole('img',{name:'Courbe marche et arrêt de '+press.name})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect.poll(()=>card.locator('.daily-curve-scroll').evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);await card.screenshot({path:'.runtime/daily-curve-mobile.png'});
 expect(errors).toEqual([]);
});
