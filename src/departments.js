// Parameters supplied by the workshop. Cycles outside Injection are per piece.
export const DEPARTMENT_IDS = ['injection', 'assembly', 'welding', 'metallization', 'screen-printing'];
export const DEPARTMENT_CONFIG = {
  injection: { name: 'Injection', enabled: true, trs: .85, dle: null },
  assembly: { name: 'Assemblage', enabled: true, trs: .8, dle: .8 },
  welding: { name: 'Soudure', enabled: false, trs: .8, dle: .8 },
  metallization: { name: 'Métallisation', enabled: true, trs: .7, dle: .7 },
  'screen-printing': { name: 'Sérigraphie', enabled: true, trs: .8, dle: .8 },
};
export function departmentConfig(id = 'injection') {
  const config = DEPARTMENT_CONFIG[id];
  if (!config) throw new Error('Département inconnu.');
  return config;
}
export const departmentScope = (scope, department = 'injection') => department === 'injection' ? scope : `${scope}:${department}`;
export const targetStorageKey = department => department === 'injection' ? 'qos-target' : `qos-target:${department}`;

export function targetForRows(rows, indicator, fallback) {
  let weighted = 0, weight = 0;
  for (const row of rows) {
    const goal = row[`${indicator}_target`];
    const duration = indicator === 'trs' ? row.opening_min - row.planned_min : row.labor_hours;
    if (goal > 0 && goal <= 1 && duration > 0) {
      weighted += goal * duration;
      weight += duration;
    }
  }
  return weight ? weighted / weight : fallback;
}

const catalogs = {
  metallization: [
    ['Cover KIKO', '2.3.30156', .75, 22.5, 30],
    ['Base KIKO', '2.4.30050', .75, 22.5, 30],
    ['Cover PM Belotti', '11600CO', .75, 22.5, 30],
    ['Base PM Belotti', '11600BD', .75, 22.5, 30],
    ['Cover GM Belotti', '12900CO', 1.036, 31.08, 30],
    ['Cover GM Belotti', '12900BD', 1.036, 31.08, 30],
  ],
  'screen-printing': [['Base KIKO', '2.4.30051', 5, 7.5, 1.5]],
  assembly: [['Compact KIKO', '3.3.30273', 3.26, 42.35, 13]],
};
const groups = { assembly: '1', metallization: '2', 'screen-printing': '3' };
export function departmentSeed(department) {
  const config = departmentConfig(department);
  const group = groups[department];
  if (!group) return { department, presses: [], articles: [], records: [] };
  return {
    department,
    // A configurable production line, with no invented production history.
    presses: [{ id: `70000000-0000-4000-8000-${group}00000000000`, name: `Ligne ${config.name}`, active: true, department }],
    articles: catalogs[department].map(([name, code, cycle, standard, operators], index) => ({
      id: `71000000-0000-4000-8000-${group}${String(index + 1).padStart(11, '0')}`,
      department, name, code, cavities: 1, mold_cycle_seconds: cycle,
      standard_seconds: standard, standard_operators: operators,
      trs_target: config.trs, dle_target: config.dle, active: true,
    })),
    records: [],
  };
}
