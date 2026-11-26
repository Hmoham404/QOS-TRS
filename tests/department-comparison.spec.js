import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { departmentSeed } from '../src/departments.js';

test('Les couleurs OEE, DLE et rebut suivent les seuils des trois groupes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00Z'));
  const seed = JSON.parse(readFileSync(new URL('../src/seed.json', import.meta.url), 'utf8'));
  const departments = ['injection', 'assembly', 'welding', 'metallization', 'screen-printing'];
  const datasets = departments.map(id => id === 'injection' ? seed : departmentSeed(id));
  await page.goto('/');
  await page.evaluate(({ departments, datasets, template }) => {
    departments.forEach((department, index) => {
      const data = datasets[index];
      const limits = department === 'metallization' ? [.08, .10] : ['injection', 'welding'].includes(department) ? [.01, .02] : [.015, .03];
      const records = [.8, .9, .96].map((rate, i) => {
        const rejectRate = [limits[1] + .01, limits[0], 0][i];
        const good = Math.round(10000 * (1 - rejectRate));
        return { ...template, department, press_id: data.presses[0].id, article_id: data.articles[0].id,
          date: `2026-11-${24 - i}`, opening_min: 60, planned_min: 0,
          good_qty: good, startup_rejects: 10000 - good, production_rejects: 0,
          cycle_seconds: rate * 3600 / good, standard_seconds: rate * 3600 / good, labor_hours: 1,
        };
      });
      localStorage.setItem(`qos-${department}-v1`, JSON.stringify({ ...data, department, records }));
    });
  }, { departments, datasets, template: seed.records[0] });
  await page.reload();
  await page.locator('.brand').click();
  for (const [day, status] of [[24, 'red'], [23, 'yellow'], [22, 'green']]) {
    await page.getByLabel('Date analysée').fill(`2026-11-${day}`);
    await expect(page.locator(`.comparison-card [data-status=${status}]`)).toHaveCount(9);
    const backgrounds = await page.locator(`.comparison-card [data-status=${status}]`).evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
    expect(new Set(backgrounds).size).toBe(1);
    expect(backgrounds[0]).toBe({ red: 'rgb(254, 226, 226)', yellow: 'rgb(254, 243, 199)', green: 'rgb(220, 252, 231)' }[status]);
  }
  await page.screenshot({ path: '.runtime/metric-colors-green.png', fullPage: true });
  await page.getByLabel('Date analysée').fill('2026-11-23');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.runtime/metric-colors-yellow-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Mode nuit', exact: true }).click();
  await expect(page.locator('.comparison-card [data-status=yellow]').first()).toHaveCSS('background-color', 'rgb(68, 56, 17)');
});

test('Le bandeau usine pondère les cinq départements et suit les dates', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-24T12:00:00Z'));
  const seed = JSON.parse(readFileSync(new URL('../src/seed.json', import.meta.url), 'utf8'));
  const departments = ['injection', 'assembly', 'welding', 'metallization', 'screen-printing'];
  const datasets = departments.map(department => department === 'injection' ? seed : departmentSeed(department));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.brand')).toBeVisible();
  await page.evaluate(({ departments, datasets, template }) => {
    departments.forEach((department, index) => {
      const data = datasets[index];
      const total = 100 * (index + 1);
      const good = total * (0.9 - index * 0.1);
      localStorage.setItem(`qos-${department}-v1`, JSON.stringify({
        ...data, department, records: [{
          ...template, department, press_id: data.presses[0].id, article_id: data.articles[0].id,
          date: '2026-11-24', opening_min: 60, planned_min: 0,
          good_qty: good, startup_rejects: total - good, production_rejects: 0,
          cycle_seconds: 10, standard_seconds: 60, labor_hours: index + 1, sorting_hours: index / 2,
        }],
      }));
    });
  }, { departments, datasets, template: seed.records[0] });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.brand').click();
  const values = page.locator('.comparison-intro dd');
  await expect(values).toHaveText(['52,8 %', '105,6 %', '36,7 %', '5,00 h']);
  await page.getByLabel('Date analysée').fill('2026-11-23');
  await expect(values).toHaveText(['—', '—', '—', '—']);
  await page.getByRole('button', { name: 'Période', exact: true }).click();
  await page.getByLabel('Date de fin').fill('2026-11-24');
  await expect(values).toHaveText(['52,8 %', '105,6 %', '36,7 %', '5,00 h']);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(values.first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.runtime/factory-metrics-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: '.runtime/factory-metrics-desktop.png', fullPage: true });
});

test('Le logo ouvre la comparaison des cinq départements et filtre la période', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-08T12:00:00Z'));
  await page.goto('/');
  await page.locator('.brand').click();
  await expect(page.getByRole('heading', {name:'Comparaison des départements.'})).toBeVisible();
  const cards = page.locator('.comparison-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.locator('.comparison-metric.primary')).toHaveCount(3);
  const colors = await cards.locator('.comparison-metric.primary').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
  expect(new Set(colors).size).toBe(2);
  await expect(cards.locator('[data-status=neutral]')).toHaveCount(6);
  const injection = cards.filter({has: page.getByRole('heading', {name:'Injection', exact:true})});
  await page.getByLabel('Date analysée').fill('2026-10-08');
  await expect(injection.locator('.comparison-count')).not.toHaveText('0 relevés');
  await expect(cards.filter({has: page.getByRole('heading', {name:'Assemblage', exact:true})})).toContainText('Aucun relevé pour cette période.');
  await page.getByLabel('Date analysée').fill('2026-10-09');
  await expect(injection.locator('.comparison-count')).toHaveText('0 relevés');
  await injection.getByRole('button',{name:'OEE · Injection · Voir la courbe'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading',{name:'OEE · Évolution'})).toBeVisible();
  await expect(dialog).toContainText('Trois échelles de temps sur une seule courbe');
  await expect(dialog.locator('.comparison-chart-sections span')).toHaveCount(3);
  await expect(dialog.locator('.recharts-area')).toHaveCount(1);
  await dialog.getByRole('button',{name:'Fermer'}).click();
  await page.getByLabel('Date analysée').fill('2026-10-08');
  await page.getByRole('button',{name:'Jour précédent'}).click();
  await expect(page.getByLabel('Date analysée')).toHaveValue('2026-10-07');
  await page.getByRole('button',{name:'Jour suivant'}).click();
  await expect(page.getByLabel('Date analysée')).toHaveValue('2026-10-08');
  await page.getByRole('button',{name:'Période',exact:true}).click();
  await page.getByLabel('Date de début').fill('2026-10-01');
  await expect(page.getByLabel('Date de fin')).toHaveValue('2026-10-08');
  await expect(injection.locator('.comparison-count')).toHaveText('63 relevés');
  await page.getByRole('button',{name:'Jour',exact:true}).click();
  await expect(page.getByLabel('Date analysée')).toHaveValue('2026-10-01');
  await expect(page.getByRole('button',{name:'Actualiser',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Mode réunion'}).click();
  await expect(page.locator('.app')).toHaveClass(/meeting/);
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
