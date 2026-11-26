export { reportPeriod } from './report-period.js';
import { isSortingOnly } from './sorting.js';

// Each historical cycle stays separate: catalogue changes must not rewrite earned time.
export function productionReport(datasets, from, to) {
  const lines = [];
  for (const data of datasets) {
    const groups = new Map();
    for (const row of data.records) {
      if (isSortingOnly(row)) continue;
      if (row.date < from || row.date > to) continue;
      const article = data.articles.find(item => item.id === row.article_id);
      const cycle = Number(row.cycle_seconds);
      const quantity = Number(row.good_qty);
      const key = `${row.article_id}:${cycle}`;
      if (!groups.has(key)) groups.set(key, {
        key: `${data.department}:${key}`, department: data.department,
        name: article?.name || row.article_id, code: article?.code || '',
        cycle, quantity: 0, seconds: 0, count: 0, invalid: false,
      });
      const line = groups.get(key);
      line.count++;
      if (!Number.isFinite(cycle) || cycle <= 0 || row.good_qty == null || String(row.good_qty).trim() === '' || !Number.isInteger(quantity) || quantity < 0) line.invalid = true;
      else { line.quantity += quantity; line.seconds += quantity * cycle; }
    }
    // Show the available operations even when the selected period has no production.
    for (const article of data.articles) {
      if (article.active === false || [...groups.values()].some(line => line.key.startsWith(`${data.department}:${article.id}:`))) continue;
      groups.set(article.id, {
        key: `${data.department}:${article.id}:empty`, department: data.department,
        name: article.name, code: article.code, cycle: article.mold_cycle_seconds / article.cavities,
        quantity: 0, seconds: 0, count: 0, invalid: false,
      });
    }
    lines.push(...groups.values());
  }
  const invalid = lines.some(line => line.invalid);
  return {
    lines, invalid, count: lines.reduce((sum, line) => sum + line.count, 0),
    hours: invalid ? null : lines.reduce((sum, line) => sum + line.seconds, 0) / 3600,
  };
}

export function reportDle(hours, clocked) {
  if (clocked.trim() === '') return null;
  const value = Number(clocked.replace(',', '.'));
  return hours != null && Number.isFinite(value) && value > 0 ? hours / value : null;
}
