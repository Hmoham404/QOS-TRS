import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { availabilityStops } from '../src/availability-stops.js';

const rows = JSON.parse(readFileSync(new URL('../src/seed.json', import.meta.url), 'utf8')).records;

test('Un point de disponibilité ouvre le Pareto et le cercle du mois, de la semaine et du jour', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-08T12:00:00Z'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('.brand').click();
  await page.getByRole('button', { name: 'Disponibilité · Injection · Voir la courbe', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.availability-stops')).toHaveCount(0);
  await dialog.locator('.comparison-chart text.availability-point').first().click();
  const detail = dialog.locator('.availability-stops');
  await expect(detail).toHaveAttribute('data-period', 'month-2026-10-01');
  await expect(detail.locator('[data-total-minutes]')).toHaveAttribute('data-total-minutes', '1470');
  await expect(detail.getByRole('img', { name: 'Pareto des arrêts machine', exact: true })).toBeVisible();
  await expect(detail.getByRole('img', { name: 'Répartition des arrêts', exact: true })).toBeVisible();
  await expect(detail.locator('.recharts-pie-sector')).not.toHaveCount(0);
  await detail.screenshot({ path: '.runtime/availability-stops-desktop.png' });
  await dialog.locator('[data-point-key="week-2026-10-05"]').first().click();
  await expect(detail).toHaveAttribute('data-period', 'week-2026-10-05');
  const weekly = availabilityStops(rows, { start: '2026-10-05', end: '2026-10-11' });
  await expect(detail.locator('[data-total-minutes]')).toHaveAttribute('data-total-minutes', String(weekly.total));
  const day = dialog.locator('[data-point-key="day-2026-10-08"]').first();
  await day.focus();
  await page.keyboard.press('Enter');
  await expect(detail).toHaveAttribute('data-period', 'day-2026-10-08');
  const daily = availabilityStops(rows, { start: '2026-10-08', end: '2026-10-08' });
  await expect(detail.locator('[data-total-minutes]')).toHaveAttribute('data-total-minutes', String(daily.total));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(detail.getByRole('img', { name: 'Répartition des arrêts', exact: true })).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await detail.screenshot({ path: '.runtime/availability-stops-mobile.png' });
  expect(errors).toEqual([]);
});
