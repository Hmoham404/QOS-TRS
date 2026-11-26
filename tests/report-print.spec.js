import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Les contrôles du haut sont alignés et le rapport mensuel imprime toutes les lignes en A4', async ({ page, context }) => {
  await page.route('**/api/rh-pointage?**',route=>{
    const query=new URL(route.request().url()).searchParams;
    return route.fulfill({json:{status:'empty',hours:null,from:query.get('from'),to:query.get('to'),coveredDates:[],missingDates:[],reviewCount:0}});
  });
  await page.addInitScript(() => { window.print = () => { window.__reportPrintCalled = true; }; });
  await page.goto('/');
  const trigger = page.getByRole('button',{name:'Rapport de production',exact:true});
  await expect(trigger).toBeVisible();
  for (const width of [1660,1440,1024]) {
    await page.setViewportSize({width,height:1000});
    const boxes = await page.locator('.topbar .report-trigger,.topbar .language-options,.topbar .theme-switcher').evaluateAll(nodes => nodes.map(node => {const r=node.getBoundingClientRect();return {y:r.y+r.height/2,height:r.height};}));
    expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(2);
    expect(boxes.every(box=>box.height===42)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:1660,height:1000});
  await page.screenshot({path:'.runtime/report-header-aligned.png'});
  await trigger.click();
  const dialog = page.getByRole('dialog',{name:'Rapport de production'});
  await dialog.getByRole('button',{name:'Mois',exact:true}).click();
  await dialog.getByLabel('Mois du rapport').fill('2026-10');
  const print = dialog.getByRole('button',{name:'Imprimer / PDF'});
  await expect(print).toBeEnabled();
  await print.click();
  const frame = page.frameLocator('iframe[title="Imprimer le rapport"]');
  await expect(frame.getByRole('heading',{name:'Rapport de production'})).toBeAttached();
  const iframe = page.frames().find(f=>f.parentFrame());
  await expect.poll(()=>iframe.evaluate(()=>window.__reportPrintCalled)).toBe(true);
  const html = await iframe.content();
  expect(html).toContain('01 octobre 2026 - 31 octobre 2026');
  expect(html).toContain('271,00');
  expect(await frame.locator('tbody tr:not(.group)').count()).toBe(await dialog.locator('tbody tr:not(.pr-group):not(.pr-empty-row)').count());
  const paper = await context.newPage();
  await paper.setContent(html);
  await paper.emulateMedia({media:'print'});
  await paper.pdf({path:'.runtime/production-report-monthly.pdf',preferCSSPageSize:true,printBackground:true});
  writeFileSync('.runtime/production-report-print.html',html,'utf8');
  await paper.close();
  await page.setViewportSize({width:390,height:844});
  await expect(print).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
