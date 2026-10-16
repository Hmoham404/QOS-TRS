import React from 'react';
import { listDrafts } from './drafts';
import { dataScope } from './data';
export default function DraftList({onResume}){
  const drafts=listDrafts(dataScope);
  if(!drafts.length)return null;
  return <details className="draft-list"><summary>Brouillons sur cet appareil ({drafts.length})</summary><p>Ces saisies ne sont pas encore enregistrées dans l’atelier.</p>{drafts.map(d=><button className="btn" key={d.key} type="button" onClick={()=>onResume(d)}>Reprendre · {d.record.date} · {d.record.shift}{d.editing?' · modification':''}</button>)}</details>;
}
