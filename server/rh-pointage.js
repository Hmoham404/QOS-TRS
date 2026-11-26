import { gunzipSync } from 'node:zlib';
import { RH_SOURCE } from './rh-source.js';
import { reportPeriod } from '../src/report-period.js';

const normalized = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
const identity = value => /^\d+$/.test(String(value ?? '').trim()) ? String(Number(value)) : String(value ?? '').trim();
const employeeKey = row => identity(row.zk || row.id || row.final_code || row.finalCode || row.saber);
const isoDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '');

export function decodeRhSnapshot(payload) {
  if (!payload || payload.cleared) return null;
  let data = { ...payload };
  if (data.pointageStorageGzipV1) {
    const decoded = JSON.parse(gunzipSync(Buffer.from(data.pointageStorageGzipV1, 'base64'), { maxOutputLength: 30 * 1024 * 1024 }).toString('utf8'));
    if (!decoded.fields || !Array.isArray(decoded.metadata)) throw new Error('Invalid RH storage');
    data = { ...data, ...decoded.fields };
  }
  const fields = data.currentFilePointageParentFields;
  if (Array.isArray(fields) && data.currentFilePointage === null) {
    data.currentFilePointage = Object.fromEntries(fields.map(field => [field, data[field]]));
  }
  return data;
}

export function summarizeRhPointage({ snapshot, employees, corrections = [], updatedAt = null }, from, to) {
  reportPeriod('day', from); reportPeriod('day', to);
  if (to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 365) throw new Error('Invalid period');
  const requested = [];
  for (let day = from; day <= to;) {
    requested.push(day);
    day = new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  }
  if (!snapshot) return { status: 'empty', hours: null, from, to, coveredDates: [], missingDates: requested, reviewCount: 0, updatedAt };
  const staff = new Map(), byId = new Map();
  for (const row of employees) {
    staff.set(employeeKey(row), row);
    for (const id of [row.id, row.final_code, row.finalCode]) if (id) byId.set(identity(id), row);
  }
  const eligible = row => normalized(row?.kind) === 'MOD' && normalized(row?.department).includes('PRODUCTION') && normalized(row?.status) === 'ACTIF';
  const cells = new Map(), coverage = new Set();
  for (const date of [...(snapshot.dailySummaries || []).map(row => row.isoDate), ...(snapshot.rawRows || []).map(row => row.isoDate), ...(snapshot.closedDates || [])]) if (isoDay(date)) coverage.add(date);
  for (const sheet of snapshot.weeklySheets || []) {
    // A calendar column alone is not evidence that attendance was imported.
    for (const day of sheet.dayColumns || []) if (isoDay(day.isoDate) && (sheet.rows || []).some(row => (row.days || []).some(cell => cell.isoDate === day.isoDate && !['EMPTY','X'].includes(normalized(cell.status))))) coverage.add(day.isoDate);
    for (const row of sheet.rows || []) {
      const person = staff.get(identity(row.employeeKey)) || byId.get(identity(row.id));
      if (!eligible(person)) continue;
      for (const day of row.days || []) if (isoDay(day.isoDate) && day.isoDate >= from && day.isoDate <= to) {
        const key = `${employeeKey(person)}|${day.isoDate}`;
        const cell = { status: day.status, minutes: day.workedMinutes };
        const previous = cells.get(key);
        cells.set(key, previous && JSON.stringify(previous) !== JSON.stringify(cell) ? { status: 'AVR', minutes: null } : cell);
      }
    }
  }
  // Older snapshots may contain daily results without the generated weekly view.
  for (const row of snapshot.dayRows || []) {
    if (row.isoDate < from || row.isoDate > to || !isoDay(row.isoDate)) continue;
    coverage.add(row.isoDate);
    const person = staff.get(identity(row.employeeKey)) || byId.get(identity(row.sourceId));
    if (!eligible(person)) continue;
    const key = `${employeeKey(person)}|${row.isoDate}`;
    if (!cells.has(key)) cells.set(key, { status: row.state === 'OK' && row.matchState === 'matched' ? 'POINTAGE' : 'AVR', minutes: row.roundedMinutes });
  }
  const allCorrections = [...(snapshot.manualCorrections || []), ...(snapshot.currentFilePointage?.manualCorrections || []), ...corrections]
    .sort((a, b) => String(a.correctedAt || '').localeCompare(String(b.correctedAt || '')));
  const minutes = time => {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time || '');
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  for (const correction of allCorrections) {
    if (correction.isoDate < from || correction.isoDate > to || !coverage.has(correction.isoDate)) continue;
    const person = staff.get(identity(correction.employeeKey));
    if (!eligible(person) || !correction.after) continue;
    const after = correction.after;
    let cell;
    if (['ABS', 'CONGE', 'CSS', 'CM', 'REPOS'].includes(normalized(after.status))) cell = {status: after.status, minutes: 0};
    else {
      const entry = minutes(after.entry), exit = minutes(after.exit), pause = Number(after.breakMinutes ?? 0);
      cell = entry != null && exit != null && exit > entry && Number.isFinite(pause) && pause >= 0
        ? { status: 'POINTAGE', minutes: Math.max(0, exit - entry - pause) } : { status: 'AVR', minutes: null };
    }
    cells.set(`${employeeKey(person)}|${correction.isoDate}`, cell);
  }
  let totalMinutes = 0, reviewCount = 0, employeeDays = 0;
  for (const cell of cells.values()) {
    const status = normalized(cell.status);
    if (['EMPTY', 'X'].includes(status)) continue;
    employeeDays++;
    if (['ABS', 'CONGE', 'CSS', 'CM', 'REPOS'].includes(status)) continue;
    if (status !== 'POINTAGE' || !Number.isFinite(cell.minutes) || cell.minutes < 0) reviewCount++;
    else totalMinutes += cell.minutes;
  }
  const coveredDates = requested.filter(day => coverage.has(day));
  const missingDates = requested.filter(day => !coverage.has(day));
  const status = !coveredDates.length || !employeeDays ? 'empty' : missingDates.length || reviewCount ? 'partial' : 'ready';
  return { status, hours: status === 'empty' || reviewCount && totalMinutes === 0 ? null : totalMinutes / 60, totalMinutes, from, to, coveredDates, missingDates, reviewCount, employeeDays, updatedAt };
}

export async function loadRhPointage(from, to, { fetchImpl = fetch } = {}) {
  // Validate before making any external read.
  summarizeRhPointage({ snapshot: null, employees: [] }, from, to);
  const base = process.env.RH_SUPABASE_URL || RH_SOURCE.url;
  const key = process.env.RH_SUPABASE_PUBLISHABLE_KEY || RH_SOURCE.key;
  async function read(table, params, range) {
    const response = await fetchImpl(`${base}/rest/v1/${table}?${new URLSearchParams(params)}`, {
      headers: { apikey: key, ...(range ? { Range: range } : {}) }, signal: AbortSignal.timeout(20000), cache: 'no-store',
    });
    if (!response.ok) throw new Error(`RH source unavailable (${response.status})`);
    return response.json();
  }
  async function readPages(table, params) {
    const rows = [];
    for (let offset = 0;; offset += 500) {
      const page = await read(table, params, `${offset}-${offset+499}`);
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }
  const [snapshots, registry, correctionRows] = await Promise.all([
    read('hr_dashboard_store', { select: 'payload,updated_at', id: 'eq.rh-pointage-analysis' }),
    read('hr_dashboard_store', { select: 'payload', id: 'eq.rh-staff-directory-active-records' }),
    readPages('hr_dashboard_store', { select: 'payload,updated_at', id: `like.rh-pointage-correction-${from.slice(0,7)}*`, order:'id.asc' }),
  ]);
  // Weeks may cross a month or a year: fetch the remaining months' corrections too.
  const months = new Set();
  for (let date = from; date <= to; date = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0,10)) months.add(date.slice(0,7));
  for (const month of [...months].slice(1)) correctionRows.push(...await readPages('hr_dashboard_store', { select: 'payload,updated_at', id: `like.rh-pointage-correction-${month}*`, order:'id.asc' }));
  const snapshot = decodeRhSnapshot(snapshots[0]?.payload);
  if (!snapshot) return summarizeRhPointage({snapshot:null, employees:[]}, from, to);
  const selected = registry[0]?.payload?.recordIds;
  const employees = await readPages('hr_staff_directory', { select: 'record_id,id,zk,saber,final_code,kind,department,status', order: 'record_id.asc' });
  const allowed = Array.isArray(selected) ? new Set(selected.map(String)) : null;
  const corrections = correctionRows.flatMap(row => row.payload?.cleared ? [] : row.payload?.correction ? [row.payload.correction] : row.payload?.corrections || []);
  const updatedAt = [snapshots[0]?.updated_at, ...correctionRows.map(row => row.updated_at)].filter(Boolean).sort().at(-1) || null;
  return summarizeRhPointage({ snapshot, employees: allowed ? employees.filter(row => allowed.has(String(row.record_id))) : employees, corrections, updatedAt }, from, to);
}
