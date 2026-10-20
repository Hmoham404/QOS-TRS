import { aggregate, calculate, ratio } from './domain.js';

// Only compare production and planning on the same records. A missing plan is
// different from an explicit zero, and must not inflate the completion rate.
export function planningRate(rows) {
  const plannedRows = rows.filter(r => r.planned_qty != null);
  const planned = plannedRows.reduce((sum, r) => sum + r.planned_qty, 0);
  const actual = plannedRows.reduce((sum, r) => sum + r.good_qty, 0);
  return { planned, actual, count: plannedRows.length, missing: rows.length - plannedRows.length, rate: ratio(actual, planned) };
}

export function trsLosses(rows) {
  const totals = { breakdown: 0, startup: 0, changeover: 0, speed: 0, quality: 0 };
  let speedGain = 0;
  for (const r of rows) {
    const c = calculate(r);
    totals.breakdown += r.breakdown_min;
    totals.startup += r.startup_min;
    totals.changeover += r.changeover_min;
    const speed = c.runtime - c.total * r.cycle_seconds / 60;
    totals.speed += Math.max(0, speed);
    speedGain += Math.max(0, -speed);
    totals.quality += c.rejects * r.cycle_seconds / 60;
  }
  const labels = {
    breakdown: ['Pannes', '#db7272'],
    startup: ['Démarrage / réglage', '#c08b39'],
    changeover: ['Changement de moule', '#739ca8'],
    speed: ['Pertes de cadence', '#487ac3'],
    quality: ['Rebuts', '#8b6bc0'],
  };
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const items = Object.entries(totals).map(([key, minutes]) => ({
    key, name: labels[key][0], color: labels[key][1], minutes,
    share: total > 0 ? minutes / total : 0,
  }));
  return { items, total, speedGain };
}

export function curveSeries(rows, presses) {
  if (!rows.length) return { days: [], machines: [] };
  const byDate = new Map();
  const pressIds = new Set();
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
    pressIds.add(row.press_id);
  }
  const machines = presses.filter(p => pressIds.has(p.id)).map(p => ({ ...p, key: 'press_' + p.id }));
  const dates = [...byDate.keys()].sort();
  const days = [];
  // Rest days and other dates without an entry have no point on the curves.
  // A Sunday with an entry remains a real production day.
  for (const date of dates) {
    const selected = byDate.get(date);
    const totals = aggregate(selected);
    const plan = planningRate(selected);
    const point = { date, trs: totals.trs, dle: totals.dle, planning: plan.rate, planned: plan.planned, actual: plan.actual, count: selected.length };
    for (const machine of machines) point[machine.key] = aggregate(selected.filter(r => r.press_id === machine.id)).trs;
    days.push(point);
  }
  return { days, machines };
}
