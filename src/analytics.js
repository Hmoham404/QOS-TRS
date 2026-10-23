import { t as translate } from "./i18n.js";
import { calculate, SHIFTS } from "./domain.js";
import { STOP_TYPES, unplannedMinutes } from "./losses.js";
export { STOP_TYPES } from "./losses.js";
export const defaultStart = shift => ({
  Matin: "06:00",
  "Après-Midi": "14:00",
  Nuit: "22:00"
})[shift] || "06:00";
export function clockLabel(start, offset) {
  if (!start) return `+${offset} min`;
  const [h, m] = start.split(":").map(Number),
    minutes = h * 60 + m + offset;
  const day = Math.floor(minutes / 1440),
    remainder = (minutes % 1440 + 1440) % 1440;
  return `${String(Math.floor(remainder / 60)).padStart(2, "0")}:${String(Math.floor(remainder % 60)).padStart(2, "0")}${day ? translate(" J+") + day : ""}`;
}
export function stopTotals(events = []) {
  const result = Object.fromEntries(Object.values(STOP_TYPES).map(type => [type.field, 0]));
  for (const e of events) if (STOP_TYPES[e.category]) result[STOP_TYPES[e.category].field] += Number(e.end_min) - Number(e.start_min);
  return result;
}
export function validateTimeline(r) {
  const errors = [];
  if (!r.timeline_complete) {
    if (r.stop_events != null && !Array.isArray(r.stop_events)) {
      errors.push(translate("Le journal doit être une liste."));
      return errors;
    }
    if (r.stop_events?.length) errors.push(translate("Activez le journal détaillé pour enregistrer les arrêts horodatés."));
    return errors;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(r.shift_start || "")) errors.push(translate("Renseignez une heure de début valide."));
  if (!Array.isArray(r.stop_events) || r.stop_events.length > 100) {
    errors.push(translate("Le journal doit contenir au maximum 100 arrêts."));
    return errors;
  }
  const sorted = [...r.stop_events].sort((a, b) => Number(a.start_min) - Number(b.start_min));
  let end = 0;
  for (const e of sorted) {
    if (!STOP_TYPES[e.category] || !Number.isFinite(e.start_min) || !Number.isFinite(e.end_min) || e.start_min < 0 || e.end_min <= e.start_min || e.end_min > r.opening_min) {
      errors.push(translate("Chaque arrêt doit avoir une catégorie et une durée positive dans les limites du poste."));
      break;
    }
    if (e.start_min < end) {
      errors.push(translate("Deux arrêts ne peuvent pas se chevaucher."));
      break;
    }
    if (typeof e.cause !== "string" || e.cause.length > 120) {
      errors.push(translate("Une cause d’arrêt doit contenir au maximum 120 caractères."));
      break;
    }
    end = e.end_min;
  }
  const totals = stopTotals(r.stop_events);
  if (Object.keys(totals).some(k => Math.abs(totals[k] - Number(r[k] ?? 0)) > 1e-6)) errors.push(translate("Les durées du journal doivent correspondre aux totaux d’arrêt."));
  return errors;
}
export function timelineSegments(r) {
  if (!r?.timeline_complete || validateTimeline(r).length) return [];
  let cursor = 0;
  const result = [];
  for (const e of [...r.stop_events].sort((a, b) => a.start_min - b.start_min)) {
    if (e.start_min > cursor) result.push({
      start: cursor,
      end: e.start_min,
      state: 1,
      category: "running",
      label: translate("Marche déclarée")
    });
    result.push({
      start: e.start_min,
      end: e.end_min,
      state: 0,
      category: e.category,
      label: e.cause?.trim() || STOP_TYPES[e.category].label
    });
    cursor = e.end_min;
  }
  if (cursor < r.opening_min) result.push({
    start: cursor,
    end: r.opening_min,
    state: 1,
    category: "running",
    label: translate("Marche déclarée")
  });
  return result;
}
export function hourlyUseful(r) {
  const segments = timelineSegments(r);
  if (!segments.length) return [];
  const buckets = [];
  for (let start = 0; start < r.opening_min; start += 60) {
    const end = Math.min(start + 60, r.opening_min);
    const running = segments.filter(s => s.state === 1).reduce((sum, s) => sum + Math.max(0, Math.min(s.end, end) - Math.max(s.start, start)), 0);
    buckets.push({
      label: clockLabel(r.shift_start, start),
      end: clockLabel(r.shift_start, end),
      useful: running,
      lost: end - start - running,
      capacity: end - start
    });
  }
  return buckets;
}
export function buildPareto(rows, includePlanned = false) {
  const grouped = new Map();
  let detailed = 0;
  const add = (key, label, category, minutes) => {
    if (minutes <= 0) return;
    const v = grouped.get(key) || {
      label,
      category,
      minutes: 0
    };
    v.minutes += minutes;
    grouped.set(key, v);
  };
  for (const r of rows) {
    if (r.timeline_complete && !validateTimeline(r).length) {
      detailed++;
      for (const e of r.stop_events) {
        if (e.category === "planned" && !includePlanned) continue;
        const cause = e.cause.trim();
        const label = cause || STOP_TYPES[e.category].label;
        add(`${e.category}|${label.toLocaleLowerCase("fr")}`, label, e.category, e.end_min - e.start_min);
      }
    } else for (const [category, type] of Object.entries(STOP_TYPES)) if (includePlanned || category !== "planned") add(category + "|" + type.label.toLocaleLowerCase("fr"), type.label, category, Number(r[type.field]) || 0);
  }
  const values = [...grouped.values()].sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label));
  const total = values.reduce((n, v) => n + v.minutes, 0);
  let cumulative = 0;
  return {
    total,
    detailed,
    items: values.map((v, index) => {
      cumulative += v.minutes;
      return {
        ...v,
        rank: index + 1,
        short: String(index + 1).padStart(2, "0"),
        share: total ? v.minutes / total * 100 : 0,
        cumulative: total ? cumulative / total * 100 : 0,
        color: STOP_TYPES[v.category].color
      };
    })
  };
}
export function usefulByShift(rows) {
  return SHIFTS.map(shift => {
    const selected = rows.filter(r => r.shift === shift);
    return {
      label: translate(shift),
      useful: selected.reduce((s, r) => s + calculate(r).runtime, 0),
      lost: selected.reduce((s, r) => s + unplannedMinutes(r), 0),
      planned: selected.reduce((s, r) => s + r.planned_min, 0),
      count: selected.length
    };
  });
}
