import { aggregate, SHIFTS, today } from './domain.js';
import { timelineSegments, STOP_TYPES, validateTimeline } from './analytics.js';

// Calendar dates are workshop-local dates. UTC is only used for date arithmetic.
export function shiftDate(date, days) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const yesterday = () => shiftDate(today(), -1);
export function recordWindow(record) {
  if (!record.timeline_complete || validateTimeline(record).length) return null;
  const [h, m] = record.shift_start.split(':').map(Number);
  const start = Date.parse(record.date + 'T00:00:00Z') / 60000 + h * 60 + m;
  return { start, end: start + Number(record.opening_min) };
}
export function overlapError(record, records) {
  const window = recordWindow(record);
  if (!window) return null;
  const conflict = records.find(other => {
    if (other.id === record.id || other.press_id !== record.press_id) return false;
    const w = recordWindow(other);
    return w && window.start < w.end && w.start < window.end;
  });
  return conflict ? `Cette presse possède déjà un journal sur ce créneau (${conflict.date}, ${conflict.shift}). Corrigez le début ou la durée du relevé : deux productions ne peuvent pas se chevaucher.` : null;
}
export function dailyPresses(data, date, { press = 'all', shift = 'all' } = {}) {
  const rows = data.records.filter(r => r.date === date && (shift === 'all' || r.shift === shift));
  return data.presses.filter(p => (p.active !== false || rows.some(r => r.press_id === p.id)) && (press === 'all' || p.id === press))
    .map(p => {
      const records = rows.filter(r => r.press_id === p.id).sort((a,b)=>SHIFTS.indexOf(a.shift)-SHIFTS.indexOf(b.shift));
      const totals = aggregate(records);
      const shifts = SHIFTS.filter(s => shift === 'all' || s === shift).map(name => {
        const selected = records.filter(r => r.shift === name);
        return { name, records: selected, ...aggregate(selected) };
      });
      const complete = records.filter(r => r.timeline_complete && !validateTimeline(r).length);
      return { ...p, records, totals, shifts, complete,
        status: !records.length ? 'missing' : totals.runtime > 0 ? 'worked' : 'stopped',
        opening: records.reduce((sum, r) => sum + Number(r.opening_min), 0),
        stopped: totals.planned + totals.breakdown + totals.startup + totals.changeover,
        conflicts: complete.some(r => overlapError(r, data.records)),
      };
    }).sort((a, b) => ({worked:0, stopped:1, missing:2}[a.status] - {worked:0, stopped:1, missing:2}[b.status]) || a.name.localeCompare(b.name, 'fr', { numeric: true }));
}
export function dailyTimeline(records) {
  const base = records[0] ? Date.parse(records[0].date + 'T00:00:00Z') / 60000 : 0;
  const journals = records.map(record => {
    const window = recordWindow(record);
    if (!window) return null;
    return { record, start: window.start - base, end: window.end - base,
      segments: timelineSegments(record).map(s => ({ ...s, start: s.start + window.start - base, end: s.end + window.start - base, record })) };
  }).filter(Boolean).sort((a, b) => a.start - b.start);
  const end = Math.max(1440, ...journals.map(j => j.end));
  let cursor = 0;
  const gaps = [];
  for (const j of journals) {
    if (j.start > cursor) gaps.push({ start: cursor, end: j.start });
    cursor = Math.max(cursor, j.end);
  }
  if (cursor < end) gaps.push({ start: cursor, end });
  return { journals, gaps, end };
}
export function dailyStops(records) {
  return records.flatMap(r => {
    if (r.timeline_complete && !validateTimeline(r).length) return r.stop_events.map((e, index) => ({ ...e, key: r.id + ':' + index, record: r, minutes: e.end_min - e.start_min, timed: true, label: e.cause.trim() || STOP_TYPES[e.category].label }));
    return Object.entries(STOP_TYPES).filter(([, t]) => Number(r[t.field]) > 0).map(([category, t]) => ({ key: r.id + ':' + category, category, record: r, minutes: Number(r[t.field]), timed: false, label: t.label }));
  }).sort((a, b) => SHIFTS.indexOf(a.record.shift) - SHIFTS.indexOf(b.record.shift) || (a.start_min ?? 0) - (b.start_min ?? 0));
}
