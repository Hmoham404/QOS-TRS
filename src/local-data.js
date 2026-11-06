import { departmentConfig, departmentSeed } from './departments.js';
import { recordKey, validateRecord } from './domain.js';
import { overlapError } from './daily.js';

export function createLocalStore(seed, storage) {
  const key = department => department === 'injection' ? 'qos-injection-v1' : `qos-${department}-v1`;
  function read(department = 'injection') {
    departmentConfig(department);
    const raw = storage.getItem(key(department));
    if (!raw) return department === 'injection' ? {...structuredClone(seed), department} : departmentSeed(department);
    const data = JSON.parse(raw);
    if (!['presses','articles','records'].every(field => Array.isArray(data[field]))) throw new Error('La sauvegarde locale est illisible. Conservez-la avant toute réinitialisation.');
    if (data.department && data.department !== department) throw new Error('La sauvegarde appartient à un autre département.');
    return {...data, department};
  }
  function saveRecord(record, department = 'injection') {
    const data = read(department), r = {...record};
    if (r.department && r.department !== department) throw new Error('Le relevé appartient à un autre département.');
    const press = data.presses.find(p => p.id === r.press_id);
    const article = data.articles.find(a => a.id === r.article_id);
    if (!press || !article) throw new Error('Choisissez un équipement et un article de ce département.');
    const old = data.records.find(x => x.id === r.id);
    if (((!old || old.press_id !== r.press_id) && !press.active) || ((!old || old.article_id !== r.article_id) && !article.active)) throw new Error('Équipement ou article inactif.');
    const snapshot = old?.article_id === r.article_id ? old : article;
    r.cycle_seconds = old?.article_id === r.article_id ? old.cycle_seconds : article.mold_cycle_seconds / article.cavities;
    r.standard_seconds = snapshot.standard_seconds;
    r.department = department;
    for (const field of ['standard_operators','trs_target','dle_target']) r[field] = snapshot[field] ?? null;
    const errors = validateRecord(r); if (errors.length) throw new Error(errors[0]);
    const conflict = overlapError(r,data.records); if (conflict) throw new Error(conflict);
    if (data.records.some(x => x.id !== r.id && recordKey(x) === recordKey(r))) throw new Error('Ce relevé existe déjà. Modifiez-le depuis l’historique.');
    if (old?.updated_at && old.updated_at !== record.updated_at) throw new Error('Ce relevé a changé dans un autre onglet. Actualisez la page.');
    delete r.created_by;
    if (old?.created_at) r.created_at = old.created_at;
    r.updated_at = new Date().toISOString();
    data.records = old ? data.records.map(x => x.id === r.id ? r : x) : [...data.records,r];
    storage.setItem(key(department),JSON.stringify(data));
  }
  function saveReference(table, item, department = 'injection') {
    if (!['presses','articles'].includes(table)) throw new Error('Type de référence invalide.');
    if (item.department && item.department !== department) throw new Error('La référence appartient à un autre département.');
    const data = read(department), identity = table === 'presses' ? 'name' : 'code';
    if (!item.name?.trim() || !item[identity]?.trim()) throw new Error('Le nom et la référence sont obligatoires.');
    if (table === 'articles') {
      if (!(Number.isInteger(item.cavities) && item.cavities > 0 && item.mold_cycle_seconds > 0 && item.standard_seconds > 0)) throw new Error('Vérifiez les temps et les empreintes.');
      if (department !== 'injection' && (item.cavities !== 1 || !(item.standard_operators > 0 && item.trs_target > 0 && item.trs_target <= 1 && item.dle_target > 0 && item.dle_target <= 1))) throw new Error('Vérifiez l’effectif standard et les objectifs.');
    }
    if (data[table].some(x => x.id !== item.id && x[identity].toLowerCase() === item[identity].toLowerCase())) throw new Error('Cette référence existe déjà.');
    const reference = {...item, department};
    data[table] = data[table].some(x => x.id === item.id) ? data[table].map(x => x.id === item.id ? reference : x) : [...data[table],reference];
    storage.setItem(key(department),JSON.stringify(data));
  }
  return {read,saveRecord,saveReference};
}
