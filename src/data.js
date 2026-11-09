import { createCloudReader } from './cloud-reader.js';
import seed from '@seed';
import { createLocalStore } from './local-data.js';
import { validateRecord } from './domain';
import { resolveSupabaseConfig } from './supabase-config';
import { departmentConfig, departmentScope } from './departments.js';

const {url,key,error:configError}=resolveSupabaseConfig(import.meta.env);
export {configError};
export const configured=Boolean(url && key && !configError);
// The local workshop does not download the Supabase SDK.
export let supabase=null;
export const dataScope=configured?url:'local';
const cacheKey = department => 'qos-cloud-cache:' + departmentScope(dataScope, department);
const localStore = () => createLocalStore(seed, localStorage);
let cloudPromise;
function cloud() {
  if (!cloudPromise) cloudPromise=import('@supabase/supabase-js').then(({createClient})=>{
    supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    return {supabase,reader:createCloudReader(supabase,{onRead:result=>{
      try{localStorage.setItem(cacheKey(result.department),JSON.stringify(result));}catch{/* A full cache must not prevent a successful read. */}
    }})};
  }).catch(error=>{cloudPromise=null;throw error;});
  return cloudPromise;
}
export async function loadData(department = 'injection', options = {}) {
  departmentConfig(department);
  if (!configured) return localStore().read(department);
  try {
    if(!navigator.onLine)throw new TypeError('Failed to fetch');
    const {reader}=await cloud();
    return await reader.load(department,options);
  } catch(error) {
    const network=!navigator.onLine || /Failed to fetch|fetch failed|NetworkError|Load failed/i.test(error.message||'');
    if(network){
      let cache;try{cache=JSON.parse(localStorage.getItem(cacheKey(department)));}catch{}
      if(cache && Array.isArray(cache.records) && Array.isArray(cache.presses) && Array.isArray(cache.articles) && (!cache.department || cache.department === department))return {...cache,department,offline:true};
      throw new Error(navigator.onLine?'La base Supabase est injoignable. Vérifiez l’adresse du projet et son état dans Supabase. Aucune connexion utilisateur n’est demandée. Vos brouillons sont conservés sur cet appareil.':'Internet est nécessaire pour charger cet atelier une première fois. Vos brouillons sont conservés sur cet appareil.');
    }
    if(['PGRST202','PGRST204','42501'].includes(error.code))throw new Error('Base à mettre à jour : exécutez supabase/05_planning_public_access.sql dans SQL Editor, puis actualisez.');
    throw error;
  }
}
export async function saveRecord(record, department = 'injection') {
  departmentConfig(department);
  if (record.department && record.department !== department) throw new Error('Le relevé appartient à un autre département.');
  const errors=validateRecord(record); if(errors.length)throw new Error(errors[0]);
  const r={...record};
  delete r.created_at; delete r.updated_at; delete r.created_by;
  if (configured) {
    if(!navigator.onLine)throw new Error('Hors connexion : votre brouillon est conservé sur cet appareil. Reconnectez-vous puis enregistrez le relevé.');
    const {supabase,reader}=await cloud();
    const {departments}=await reader.ready(department);
    if (departments) r.department = department;
    else for (const key of ['department','standard_operators','trs_target','dle_target']) delete r[key];
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
    if(error?.code==='PGRST204' && /staffing_min|mold_breakdown_min|peripherals_min|material_shortage_min|quality_stop_min|power_cut_min|adjustment_min|other_loss_min/.test(error.message)) throw new Error('Exécutez supabase/06_loss_categories.sql dans SQL Editor. Le brouillon et ses pertes sont conservés.');
    if(error)throw new Error(error.code==='23505'?'Un relevé existe déjà pour cette date, ce poste, cette presse et cet article. Modifiez-le depuis l’historique.':error.code==='PGRST204'&&/planned_qty/.test(error.message)?'Exécutez supabase/05_planning_public_access.sql dans SQL Editor. Le brouillon et sa quantité planifiée sont conservés.':error.message);
    if(!data?.length)throw new Error('Ce relevé a été modifié par un autre utilisateur. Actualisez avant de réessayer.');
    reader.invalidate(department);
  } else {
    localStore().saveRecord(record, department);
  }
}
export async function saveReference(table,item,department = 'injection') {
  departmentConfig(department);
  if (!['presses','articles'].includes(table)) throw new Error('Type de référence invalide.');
  if (item.department && item.department !== department) throw new Error('La référence appartient à un autre département.');
  if(configured) {
    if(!navigator.onLine)throw new Error('Reconnectez-vous pour enregistrer cette référence dans la base partagée.');
    const {supabase,reader}=await cloud();
    const {departments}=await reader.ready(department);
    item = {...item};
    if (departments) item.department = department;
    else for (const key of ['department','standard_operators','trs_target','dle_target']) delete item[key];
    const {error}=await supabase.from(table).upsert(item);
    if(error)throw error;
    reader.invalidate(department);
  } else {
    localStore().saveReference(table, item, department);
  }
}
export function download(name,content,type='application/json') {
  if(/QOSAndroid\//.test(navigator.userAgent)){
    const binary=content instanceof ArrayBuffer || ArrayBuffer.isView(content);
    let encoding='utf8',payload=String(content);
    if(binary){
      if(/QOSAndroid\/1\.0(?:\D|$)/.test(navigator.userAgent))throw new Error('Mettre à jour l’APK pour exporter un fichier Excel.');
      const bytes=content instanceof ArrayBuffer?new Uint8Array(content):new Uint8Array(content.buffer,content.byteOffset,content.byteLength);
      let raw='';for(let offset=0;offset<bytes.length;offset+=32768)raw+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
      payload=btoa(raw);encoding='base64';
    }
    const result=window.prompt('QOS_NATIVE:'+JSON.stringify({action:'save',name,content:payload,type,encoding}),'');
    if(result!=='ok')throw new Error('Le fichier n’a pas pu être préparé pour Android.');
    return;
  }
  const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
