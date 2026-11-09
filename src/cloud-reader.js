import { departmentConfig } from './departments.js';

const departmentMessage = 'Exécutez supabase/07_departments.sql dans SQL Editor pour activer les espaces de production.';
const weldingMessage = 'Exécutez supabase/08_welding.sql dans SQL Editor pour activer l’atelier Soudure.';
const accessMessage = 'Exécutez supabase/05_planning_public_access.sql dans SQL Editor pour ouvrir cet atelier.';
const pageSize = 1000;

// Successful readiness checks are shared for this client session. Missing
// migrations and failed requests can be retried immediately after correction.
export function createCloudReader(client, { now = Date.now, onRead = () => {} } = {}) {
  const checks = new Map(), pending = new Map(), recent = new Map(), generations = new Map();
  function check(name, optional = false) {
    if (checks.has(name)) return checks.get(name);
    const task = Promise.resolve().then(() => client.rpc(name)).then(({data,error}) => {
      if (error && !(optional && error.code === 'PGRST202')) throw error;
      const ready = !error && data === true;
      if (!ready) checks.delete(name);
      return ready;
    }).catch(error => { checks.delete(name); throw error; });
    checks.set(name, task);
    return task;
  }
  async function ready(department = 'injection') {
    departmentConfig(department);
    const [access, departments, welding] = await Promise.all([
      check('qos_public_access_ready'), check('qos_departments_ready', true),
      department === 'welding' ? check('qos_welding_ready', true) : true,
    ]);
    if (!access) throw new Error(accessMessage);
    if (!departments && department !== 'injection') throw new Error(departmentMessage);
    if (!welding) throw new Error(weldingMessage);
    return { departments };
  }
  async function tableRows(table, department, scoped) {
    const all = [];
    let cursor;
    for (;;) {
      let query = client.from(table).select('*');
      if (scoped) query = query.eq('department', department);
      if (cursor) query = query.gt('id', cursor);
      const {data,error} = await query.order('id').limit(pageSize);
      if (error) throw error;
      all.push(...data);
      if (data.length < pageSize) return all;
      cursor = data.at(-1).id;
    }
  }
  function load(department = 'injection', { maxAge = 0 } = {}) {
    departmentConfig(department);
    if (pending.has(department)) return pending.get(department);
    const cached = recent.get(department);
    if (maxAge > 0 && cached && now() - cached.at < maxAge) return Promise.resolve(cached.data);
    const generation = generations.get(department) || 0;
    const task = (async () => {
      const {departments} = await ready(department);
      const [presses,articles,records] = await Promise.all(['presses','articles','production_records'].map(table => tableRows(table, department, departments)));
      const data = { department, presses, articles, records, cachedAt: new Date(now()).toISOString() };
      if ((generations.get(department) || 0) === generation) {
        recent.set(department, {at:now(), data});
        onRead(data);
      }
      return data;
    })().finally(() => { if (pending.get(department) === task) pending.delete(department); });
    pending.set(department, task);
    return task;
  }
  function invalidate(department) {
    generations.set(department, (generations.get(department) || 0) + 1);
    recent.delete(department);
    pending.delete(department);
  }
  return { load, ready, invalidate };
}
