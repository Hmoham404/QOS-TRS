import { createClient } from '@supabase/supabase-js';
import seed from '@seed';
import { recordKey, validateRecord } from './domain';
import { overlapError } from './daily';
import { resolveSupabaseConfig } from './supabase-config';

const {url,key,error:configError}=resolveSupabaseConfig(import.meta.env);
export {configError};
export const configured=Boolean(url && key && !configError);
// L'accès public utilise toujours la clé publique, jamais une ancienne session.
export const supabase=configured?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null;
export const dataScope=configured?url:'local';
const CACHE='qos-cloud-cache:'+dataScope;
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
  try {
  if(!navigator.onLine)throw new TypeError('Failed to fetch');
  const access=await supabase.rpc('qos_public_access_ready');
  if(access.error)throw access.error;
  if(access.data!==true)throw new Error('Exécutez supabase/05_planning_public_access.sql dans SQL Editor pour ouvrir cet atelier.');
  const lists=await Promise.all(['presses','articles','production_records'].map(async table=>{
    const all=[];
    for(let offset=0;;offset+=1000) {
      const {data,error}=await supabase.from(table).select('*').order('id').range(offset,offset+999);
      if(error)throw error;
      all.push(...data); if(data.length<1000)break;
    }
    return all;
  }));
  const result={presses:lists[0],articles:lists[1],records:lists[2],cachedAt:new Date().toISOString()};
  try{localStorage.setItem(CACHE,JSON.stringify(result));}catch{/* La lecture réseau reste utilisable si le stockage est plein. */}
  return result;
  } catch(error) {
    const network=!navigator.onLine || /Failed to fetch|fetch failed|NetworkError|Load failed/i.test(error.message||'');
    if(network){
      let cache;try{cache=JSON.parse(localStorage.getItem(CACHE));}catch{}
      if(cache && Array.isArray(cache.records) && Array.isArray(cache.presses) && Array.isArray(cache.articles))return {...cache,offline:true};
      throw new Error(navigator.onLine?'La base Supabase est injoignable. Vérifiez l’adresse du projet et son état dans Supabase. Aucune connexion utilisateur n’est demandée. Vos brouillons sont conservés sur cet appareil.':'Internet est nécessaire pour charger cet atelier une première fois. Vos brouillons sont conservés sur cet appareil.');
    }
    if(['PGRST202','PGRST204','42501'].includes(error.code))throw new Error('Base à mettre à jour : exécutez supabase/05_planning_public_access.sql dans SQL Editor, puis actualisez.');
    throw error;
  }
}
export async function saveRecord(record) {
  const errors=validateRecord(record); if(errors.length)throw new Error(errors[0]);
  const r={...record};
  delete r.created_at; delete r.updated_at; delete r.created_by;
  if (supabase) {
    if(!navigator.onLine)throw new Error('Hors connexion : votre brouillon est conservé sur cet appareil. Reconnectez-vous puis enregistrez le relevé.');
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
    if(error)throw new Error(error.code==='23505'?'Un relevé existe déjà pour cette date, ce poste, cette presse et cet article. Modifiez-le depuis l’historique.':error.code==='PGRST204'&&/planned_qty/.test(error.message)?'Exécutez supabase/05_planning_public_access.sql dans SQL Editor. Le brouillon et sa quantité planifiée sont conservés.':error.message);
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
    if(!navigator.onLine)throw new Error('Reconnectez-vous pour enregistrer cette référence dans la base partagée.');
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
  if(/QOSAndroid\//.test(navigator.userAgent)){
    const result=window.prompt('QOS_NATIVE:'+JSON.stringify({action:'save',name,content:String(content),type}),'');
    if(result!=='ok')throw new Error('Le fichier n’a pas pu être préparé pour Android.');
    return;
  }
  const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
