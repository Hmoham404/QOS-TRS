import { loadRhPointage } from '../server/rh-pointage.js';
import { reportPeriod } from '../src/report-period.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow','GET'); res.end(JSON.stringify({error:'Method not allowed'})); return; }
  const url = new URL(req.url, 'http://localhost');
  const from = url.searchParams.get('from'), to = url.searchParams.get('to');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '') || to < from || Date.parse(to) - Date.parse(from) > 365 * 86400000) {
    res.statusCode = 400; res.end(JSON.stringify({error:'Invalid period'})); return;
  }
  try { reportPeriod('day',from); reportPeriod('day',to); }
  catch { res.statusCode = 400; res.end(JSON.stringify({error:'Invalid period'})); return; }
  try { res.end(JSON.stringify(await loadRhPointage(from, to))); }
  catch { res.statusCode = 503; res.end(JSON.stringify({error:'Pointage RH indisponible. Réessayez avec Actualiser.'})); }
}
