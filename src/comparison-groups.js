export const COMPARISON_GROUPS = [
  { id: 'injection', name: 'Injection', sources: ['injection', 'welding'], activities: [
    { id: 'injection', name: 'Injection machines', source: 'injection' },
    { id: 'welding', name: 'Soudure', source: 'welding' },
  ] },
  { id: 'metallization', name: 'Métallisation', sources: ['metallization'], activities: [
    { id: 'metallization', name: 'Ligne de métallisation', source: 'metallization' },
    { id: 'painting', name: 'Ligne de peinture', source: 'metallization' },
    { id: 'bosage', name: 'Ligne de support Bosage', source: 'metallization' },
  ] },
  { id: 'assembly', name: 'Assemblage', sources: ['screen-printing', 'assembly'], activities: [
    { id: 'screen-printing', name: 'Décoration', source: 'screen-printing' },
    { id: 'assembly', name: 'Assemblage', source: 'assembly' },
  ] },
];

export const METALLIZATION_LINES = [
  { id: '70000000-0000-4000-8000-200000000000', name: 'Ligne Métallisation', activity: 'metallization' },
  { id: '70000000-0000-4000-8000-200000000001', name: 'Ligne de peinture', activity: 'painting' },
  { id: '70000000-0000-4000-8000-200000000002', name: 'Ligne de support Bosage', activity: 'bosage' },
];

export function metallizationActivity(press) {
  const known = METALLIZATION_LINES.find(line => line.id === press?.id);
  if (known) return known.activity;
  const name = (press?.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/bosage|bossage|brossage/.test(name)) return 'bosage';
  if (/peinture|painting/.test(name)) return 'painting';
  return 'metallization';
}

// Preserve existing identities, names, archives and production history.
export function withDepartmentLines(data) {
  if (data.department === 'screen-printing') return { ...data, presses: data.presses.map(press => press.name === 'Ligne Sérigraphie' ? { ...press, name: 'Ligne Décoration' } : press) };
  if (data.department !== 'metallization') return data;
  const missing = METALLIZATION_LINES.filter(line => !data.presses.some(press => metallizationActivity(press) === line.activity));
  return { ...data, presses: [...data.presses, ...missing.map(({ id, name }) => ({ id, name, active: true, department: 'metallization' }))] };
}

export function comparisonData(group, results, activityId = '') {
  const activity = group.activities.find(item => item.id === activityId);
  const sources = activity ? [activity.source] : group.sources;
  const pending = sources.some(id => !results[id]);
  const error = sources.map(id => results[id]?.error).filter(Boolean).join(' · ');
  const presses = [], records = [];
  for (const source of sources) {
    const data = results[source]?.data;
    if (!data) continue;
    const sourcePresses = data.presses.filter(press => !activity || source !== 'metallization' || metallizationActivity(press) === activity.id);
    const pressIds = new Set(sourcePresses.map(press => press.id));
    // Namespace IDs only in this read-only view, so machine filters cannot collide.
    presses.push(...sourcePresses.map(press => ({ ...press, id: `${source}:${press.id}` })));
    records.push(...data.records.filter(row => !activity || source !== 'metallization' || pressIds.has(row.press_id)).map(row => ({ ...row, department: source, press_id: `${source}:${row.press_id}` })));
  }
  return { pending, error, data: { presses, records, offline: sources.some(id => results[id]?.data?.offline) } };
}
