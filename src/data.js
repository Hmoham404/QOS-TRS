import { createClient } from '@supabase/supabase-js';
import seed from '@seed';
import { recordKey, validateRecord } from './domain';
import { overlapError } from './daily';
import { resolveSupabaseConfig } from './supabase-config';

const {url,key,error:configError,configured}=resolveSupabaseConfig(import.meta.env,import.meta.env.VITE_REQUIRE_SUPABASE==='true');
export {configError,configured};
export const supabase=configured?createClient(url,key):null;
const STORAGE='qos-injection-v1';
function localRead() {
  const raw=localStorage.getItem(STORAGE);
  if (!raw) return structuredClone(seed);
  const data=JSON.parse(raw);
  if (!Array.isArray(data.records)||!Array.isArray(data.presses)||!Array.isArray(data.articles)) throw new Error('La sauvegarde locale est illisible. Conservez-la avant toute réinitialisation.');
  return data;
}
export async function loadData() {
  if (!supabase) return localRead();
  const lists=await Promise.all(['presses','articles','production_records'].map(async table=>{
    const all=[];
    for(let offset=0;;offset+=1000) {
      const {data,error}=await supabase.from(table).select('*').order('id').range(offset,offset+999);
      if(error)throw error;
      all.push(...data); if(data.length<1000)break;
    }
    return all;
  }));
  return {presses:lists[0],articles:lists[1],records:lists[2]};
}
export async function saveRecord(record) {
  const errors=validateRecord(record); if(errors.length)throw new Error(errors[0]);
  const r={...record};
  delete r.created_at; delete r.updated_at; delete r.created_by;
  if (supabase) {
    let query;
    if(record.updated_at) query=supabase.from('production_records').update(r).eq('id',r.id).eq('updated_at',record.updated_at);
    else query=supabase.from('production_records').insert(r);
    let {data,error}=await query.select();
    if(error?.code==='PGRST204' && /shift_start|stop_events|timeline_complete/.test(error.message)) {
      if(record.timeline_complete)throw new Error('Le journal nécessite la mise à jour Supabase : exécutez supabase/03_stop_journal.sql dans SQL Editor, puis réessayez. Votre saisie est conservée à l’écran.');
      delete r.shift_start;delete r.stop_events;delete r.timeline_complete;
      let retry=record.updated_at?supabase.from('production_records').update(r).eq('id',r.id).eq('updated_at',record.updated_at):supabase.from('production_records').insert(r);
      ({data,error}=await retry.select());
    }
    if(error)throw new Error(error.code==='23505'?'Un relevé existe déjà pour cette date, ce poste, cette presse et cet article. Modifiez-le depuis l’historique.':error.message);
    if(!data?.length)throw new Error('Ce relevé a été modifié par un autre utilisateur. Actualisez avant de réessayer.');
  } else {
    const data=localRead();
    const conflict=overlapError(r,data.records);if(conflict)throw new Error(conflict);
    if(data.records.some(x=>x.id!==r.id && recordKey(x)===recordKey(r)))throw new Error('Ce relevé existe déjà. Modifiez-le depuis l’historique.');
    const old=data.records.find(x=>x.id===r.id);
    if(old?.updated_at && old.updated_at!==record.updated_at)throw new Error('Ce relevé a changé dans un autre onglet. Actualisez la page.');
    r.updated_at=new Date().toISOString();
    data.records=old?data.records.map(x=>x.id===r.id?r:x):[...data.records,r];
    localStorage.setItem(STORAGE,JSON.stringify(data));
  }
}
export async function saveReference(table,item) {
  if(supabase) {
    const {error}=await supabase.from(table).upsert(item);
    if(error)throw error;
  } else {
    const data=localRead();
    const identity=table==='presses'?'name':'code';
    if(data[table].some(x=>x.id!==item.id && x[identity].toLowerCase()===item[identity].toLowerCase()))throw new Error('Cette référence existe déjà.');
    data[table]=data[table].some(x=>x.id===item.id)?data[table].map(x=>x.id===item.id?item:x):[...data[table],item];
    localStorage.setItem(STORAGE,JSON.stringify(data));
  }
}
export function download(name,content,type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
