const iso = date => date.toISOString().slice(0, 10);

export function shiftReportReference(mode, reference, direction) {
  reportPeriod(mode, reference);
  const date = new Date(`${reference}T12:00:00Z`);
  if (mode === 'month') {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + direction);
  } else date.setUTCDate(date.getUTCDate() + direction * (mode === 'week' ? 7 : 1));
  return iso(date);
}

// UTC arithmetic keeps civil dates stable across daylight-saving changes.
export function reportPeriod(mode, reference) {
  const date = new Date(`${reference}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reference) || !Number.isFinite(date.getTime()) || iso(date) !== reference) {
    throw new Error('Choisissez une date valide.');
  }
  if (mode === 'day') return { from: reference, to: reference };
  if (mode === 'month') {
    return {
      from: `${reference.slice(0, 7)}-01`,
      to: iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12))),
    };
  }
  if (mode === 'week') {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const from = iso(date);
    date.setUTCDate(date.getUTCDate() + 6);
    return { from, to: iso(date) };
  }
  throw new Error('Période inconnue.');
}
