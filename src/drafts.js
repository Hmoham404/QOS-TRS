// Les brouillons appartiennent à cet appareil et à cette base, pas au cache PWA.
const prefix=scope=>'qos-draft-v1:'+encodeURIComponent(scope)+':';
export const draftKey=(scope,editing,defaults={})=>prefix(scope)+(editing?'edit:'+editing.id:'new:'+['date','shift','press_id'].map(k=>defaults[k]||'').join('|'));
export function readDraft(key,storage=localStorage){
  try{const value=JSON.parse(storage.getItem(key));return value?.version===1&&value.record?.id&&typeof value.record==='object'?value:null;}catch{return null;}
}
export function writeDraft(key,record,editing,storage=localStorage){
  storage.setItem(key,JSON.stringify({version:1,record,editing:editing||null,savedAt:new Date().toISOString()}));
}
export function removeDraft(key,storage=localStorage){storage.removeItem(key);}
export function listDrafts(scope,storage=localStorage){
  try{return Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(k=>k?.startsWith(prefix(scope))).map(key=>({key,...readDraft(key,storage)})).filter(d=>d.record).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));}catch{return [];}
}
