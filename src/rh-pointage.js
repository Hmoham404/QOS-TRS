export async function fetchRhPointage(from, to, { signal } = {}) {
  const response = await fetch(`/api/rh-pointage?${new URLSearchParams({from, to})}`, { signal, cache:'no-store' });
  if (!response.ok) throw new Error('RH unavailable');
  const result = await response.json();
  if (!['ready','partial','empty'].includes(result.status) || result.from !== from || result.to !== to || !Array.isArray(result.coveredDates) || !Array.isArray(result.missingDates) || !(result.hours === null || Number.isFinite(result.hours) && result.hours >= 0)) throw new Error('Invalid RH response');
  return result;
}
