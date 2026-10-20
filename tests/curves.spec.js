import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync(new URL('../src/seed.json', import.meta.url), 'utf8'));
const fixture = structuredClone(seed);
fixture.records = seed.records.map((r, index) => ({ ...r, planned_qty: index % 3 === 0 ? null : 6000 }));

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(data => localStorage.setItem('qos-injection-v1', JSON.stringify(data)), testInfo.title.includes('aucun planning') ? seed : fixture);
});

async function openCurves(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Courbes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Courbes de performance.' })).toBeVisible();
}

test('Courbes : quatre indicateurs, pertes, filtre par presse, dates et poste', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openCurves(page);
  for (const name of ['TRS global de l’atelier', 'TRS par machine', 'DLE de l’atelier', 'Taux de respect du planning']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pertes du TRS · Atelier' })).toBeVisible();
  await expect(page.getByTestId('curves-trs')).toHaveText('80,7 %');
  await expect(page.getByTestId('curves-planning')).not.toHaveText('—');
  await expect(page.locator('.curves-machines .curves-legend')).toContainText('D140.1');
  await page.getByText('Voir les valeurs par jour', { exact: true }).click();
  await expect(page.locator('.curves-values tbody tr')).toHaveCount(7);
  const emptyDay = page.locator('.curves-values tbody tr').filter({ hasText: '4 octobre 2026' });
  await expect(emptyDay).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'TRS global de l’atelier', exact: true }).locator('.recharts-xAxis')).not.toContainText('04 oct.');
  await page.screenshot({ path: '.runtime/curves-desktop.png', fullPage: true });
  const press = seed.presses.find(p => p.name === 'D140.1');
  const machineChart = page.getByRole('region', { name: 'TRS par machine', exact: true });
  const machineSelect = page.getByLabel('Presse du graphique TRS par machine');
  await expect(machineChart.locator('.recharts-line')).toHaveCount(3);
  await machineSelect.selectOption(press.id);
  await expect(machineChart.locator('.recharts-line')).toHaveCount(1);
  await expect(machineChart.locator('.curves-legend')).toContainText('D140.1');
  await expect(machineChart.locator('.curves-legend')).not.toContainText('D230.1');
  await expect(page.getByLabel('Filtrer par presse')).toHaveValue('all');
  await expect(page.getByTestId('curves-trs')).toHaveText('80,7 %');
  await expect(page.getByRole('heading', { name: 'Pertes du TRS · Atelier' })).toBeVisible();
  await machineChart.screenshot({ path: '.runtime/trs-machine-selected.png' });
  const missingPress = seed.presses.find(p => !seed.records.some(r => r.press_id === p.id));
  await machineSelect.selectOption(missingPress.id);
  await expect(machineChart.getByText('Aucun relevé pour cette presse', { exact: true })).toBeVisible();
  await machineSelect.selectOption('all');
  await expect(machineChart.locator('.recharts-line')).toHaveCount(3);
  await page.getByLabel('Filtrer par presse').selectOption(press.id);
  await expect(page.getByRole('heading', { name: 'TRS · D140.1', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pertes du TRS · D140.1' })).toBeVisible();
  await expect(page.locator('.curves-machines .curves-legend')).not.toContainText('D230.1');
  await expect(page.locator('.curves-values thead th')).toHaveCount(5);
  await page.getByLabel('Date de début').fill('2026-10-08');
  await page.getByLabel('Filtrer par poste').selectOption('Nuit');
  await expect(page.getByTestId('curves-trs')).toHaveText('—');
  await expect(page.locator('.curves-values tbody tr')).toHaveCount(1);
  await page.getByLabel('Date de fin').fill('2026-10-08');
  await page.getByLabel('Date de début').fill('2026-10-04');
  await page.getByLabel('Date de fin').fill('2026-10-04');
  await expect(page.getByRole('heading', { name: 'Aucun relevé sur cette période' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Courbes : aucun planning inventé et affichage mobile sans débordement', async ({ page }) => {
  await openCurves(page);
  await expect(page.getByText('Quantités planifiées non renseignées', { exact: true })).toBeVisible();
  await expect(page.getByTestId('curves-planning')).toHaveText('—');
  await page.setViewportSize({ width: 390, height: 844 });
  const press = seed.presses.find(p => p.name === 'D230.1');
  await page.getByLabel('Presse du graphique TRS par machine').selectOption(press.id);
  await expect(page.locator('.curves-machines .recharts-line')).toHaveCount(1);
  await expect(page.locator('.curves-machines .curves-legend')).toContainText('D230.1');
  await page.getByRole('button', { name: 'Afficher les histogrammes', exact: true }).click();
  await expect(page.locator('.curves-machines .recharts-bar')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Afficher les histogrammes', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByText('Voir les valeurs par jour', { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.runtime/curves-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.getByRole('button', { name: 'Courbes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Courbes', exact: true }).click();
  await page.getByRole('button', { name: 'Mode réunion', exact: true }).click();
  await expect(page.locator('.sidebar')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Mode réunion', exact: true })).toBeVisible();
});

test('Le mode histogrammes conserve les données, les filtres et la presse sélectionnée', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openCurves(page);
  const press = seed.presses.find(p => p.name === 'D140.1');
  const machineSelect = page.getByLabel('Presse du graphique TRS par machine');
  await machineSelect.selectOption(press.id);
  await page.getByText('Voir les valeurs par jour', { exact: true }).click();
  const values = await page.locator('.curves-values tbody').innerText();
  await page.getByRole('button', { name: 'Afficher les histogrammes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Afficher les courbes', exact: true })).toHaveAttribute('aria-pressed', 'false');
  for (const name of ['TRS global de l’atelier', 'DLE de l’atelier', 'TRS par machine', 'Taux de respect du planning']) {
    const chart = page.getByRole('region', { name, exact: true });
    await expect(chart.locator('.recharts-bar')).toHaveCount(1);
    await expect(chart.locator('.recharts-line')).toHaveCount(0);
    await expect(chart.locator('.recharts-xAxis')).not.toContainText('04 oct.');
  }
  await expect(machineSelect).toHaveValue(press.id);
  await expect(page.getByLabel('Filtrer par presse')).toHaveValue('all');
  expect(await page.locator('.curves-values tbody').innerText()).toBe(values);
  await expect(page.getByTestId('curves-trs')).toHaveText('80,7 %');
  await expect(page.locator('.curves-donut .recharts-pie')).toHaveCount(1);
  await machineSelect.selectOption('all');
  await expect(page.locator('.curves-machines .recharts-bar')).toHaveCount(3);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.runtime/curves-histograms-desktop.png', fullPage: true });
  await machineSelect.selectOption(press.id);
  await page.getByRole('button', { name: 'Afficher les courbes', exact: true }).click();
  await expect(page.locator('.curves-machines .recharts-line')).toHaveCount(1);
  await expect(page.locator('.curves-page .recharts-bar')).toHaveCount(0);
  await expect(machineSelect).toHaveValue(press.id);
  expect(await page.locator('.curves-values tbody').innerText()).toBe(values);
  expect(errors).toEqual([]);
});
