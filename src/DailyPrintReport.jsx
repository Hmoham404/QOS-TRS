import React from 'react';
import { Activity, Factory, Layers3, Pause, ShieldAlert } from 'lucide-react';
import { aggregate, calculate, dateLabel, formatNumber as num, percent, SHIFTS } from './domain';
import { dailyStops } from './daily';
import { STOP_TYPES } from './analytics';

const pData=(rows,data)=>aggregate(rows);

export default function DailyPrintReport({data,date,presses,rows}){
 const total=pData(rows,data),pressCount=presses.filter(p=>p.status==='worked').length;
 const rejects=rows.reduce((n,r)=>n+Number(r.startup_rejects)+Number(r.production_rejects),0);
 const causesMap=new Map();
 for(const stop of dailyStops(rows)){
  const key=`${stop.category}|${stop.label.toLocaleLowerCase('fr')}`;
  const item=causesMap.get(key)||{label:stop.label,category:stop.category,minutes:0,events:0,presses:new Set(),timed:0};
  item.minutes+=stop.minutes;item.events++;item.presses.add(data.presses.find(p=>p.id===stop.record.press_id)?.name||'Presse');if(stop.timed)item.timed+=stop.minutes;
  causesMap.set(key,item);
 }
 const causeList=[...causesMap.values()].sort((a,b)=>b.minutes-a.minutes||a.label.localeCompare(b.label,'fr')).slice(0,7);
 const detailed=rows.filter(r=>r.timeline_complete).length;
 const perPress=presses.map(press=>{
  const records=press.records;
  return {press,totals:aggregate(records),byShift:SHIFTS.map(shift=>aggregate(records.filter(r=>r.shift===shift)))};
 });
 const unavailable=!rows.length;
 return <section className="daily-print-report" data-testid="daily-print-sheet" aria-label="Rapport PDF de production et défauts">
  <header className="daily-print-header"><div className="daily-print-brand"><span><Activity size={17}/></span><b>QOS</b><i>ATELIER INJECTION</i></div><div><span>RAPPORT JOURNALIER · PRODUCTION & DÉFAUTS</span><h1>{dateLabel(date)} {date.slice(0,4)}</h1><p>Date de début des postes · données : {rows.length} relevés · {pressCount} presses avec du temps machine déclaré</p></div><div className="daily-print-page-tag">SYNTHÈSE DE L’ATELIER</div></header>
  {unavailable&&<div className="daily-print-no-data">Aucun relevé ne correspond à la date et aux filtres sélectionnés.</div>}
  <div className="daily-print-metrics"><div><Factory/><span>Marche machine<strong>{rows.length?num(total.runtime/60,1)+' h':'—'}</strong></span></div><div><Layers3/><span>Pièces conformes<strong>{rows.length?num(total.good):'—'}</strong></span></div><div><ShieldAlert/><span>Rebuts totaux<strong>{rows.length?num(rejects):'—'}</strong></span></div><div><Pause/><span>Arrêts déclarés<strong>{rows.length?num(total.planned+total.breakdown+total.startup+total.changeover,0)+' min':'—'}</strong></span></div></div>
  <main className="daily-print-columns">
   <section className="daily-print-section"><header><span className="daily-print-section-icon production"><Factory size={15}/></span><div><span>01 · RÉSULTATS DE PRODUCTION</span><h2>Production par presse</h2></div><span className="daily-print-unit">Pièces conformes · temps machine</span></header><table className="daily-print-table production"><thead><tr><th>Presse</th>{SHIFTS.map(s=><th key={s}>{s}</th>)}<th>Total</th></tr></thead><tbody>{perPress.map(({press:p,totals:t,byShift})=><tr key={p.id}><th>{p.name}</th>{byShift.map((shift,index)=>{const has=p.records.some(r=>r.shift===SHIFTS[index]);return <td key={SHIFTS[index]} className={!has?'unreported':''}>{has?<><strong>{num(shift.good)} <small>pcs</small></strong><span>{num(shift.runtime/60,1)} h marche</span><i>{percent(shift.trs)} TRS</i></>:'—'}</td>;})}<td className="daily-print-total">{p.records.length?<><strong>{num(t.good)}</strong><span>{num(t.runtime/60,1)} h marche</span><i>{percent(t.trs)} TRS</i></>:'—'}</td></tr>)}</tbody></table><p className="daily-print-note">Les heures machine s’additionnent entre postes. TRS par presse : conformes × cycle ÷ temps requis cumulé.</p></section>
   <section className="daily-print-section"><header><span className="daily-print-section-icon defect"><ShieldAlert size={15}/></span><div><span>02 · QUALITÉ & DISPONIBILITÉ</span><h2>Rebuts et arrêts</h2></div><span className="daily-print-unit">Pièces rebutées · minutes perdues</span></header><table className="daily-print-table defects"><thead><tr><th>Presse</th><th>Rebuts démarrage / réglage</th><th>Rebuts production</th><th>Total rebuts</th><th>Arrêts <small>min</small></th></tr></thead><tbody>{perPress.map(({press:p})=>{const records=p.records,begin=records.reduce((n,r)=>n+Number(r.startup_rejects),0),prod=records.reduce((n,r)=>n+Number(r.production_rejects),0),stops=records.reduce((n,r)=>n+Number(r.planned_min)+Number(r.breakdown_min)+Number(r.startup_min)+Number(r.changeover_min),0);return <tr key={p.id}><th>{p.name}</th><td>{records.length?num(begin):'—'}</td><td>{records.length?num(prod):'—'}</td><td className="daily-print-total">{records.length?num(begin+prod):'—'}</td><td>{records.length?num(stops,0):'—'}</td></tr>;})}</tbody><tfoot><tr><th>Total</th><td>{num(total.rejects?rows.reduce((n,r)=>n+Number(r.startup_rejects),0):0)}</td><td>{num(rows.reduce((n,r)=>n+Number(r.production_rejects),0))}</td><td className="daily-print-total">{num(rejects)}</td><td>{num(total.planned+total.breakdown+total.startup+total.changeover,0)}</td></tr></tfoot></table>
    <div className="daily-print-causes"><h3>Causes prioritaires d’arrêt</h3>{causeList.length?<ol>{causeList.map((cause,i)=><li key={cause.category+'|'+cause.label}><span className="daily-print-rank">{String(i+1).padStart(2,'0')}</span><span className="daily-print-cause-name"><strong>{cause.label}</strong><small>{cause.category==='planned'?'Arrêt planifié':STOP_TYPES[cause.category]?.label} · {cause.presses.size} presse{cause.presses.size>1?'s':''}{cause.timed<cause.minutes?' · totaux historiques sans horaires':''}</small></span><b>{num(cause.minutes,0)} <small>min</small></b></li>)}</ol>:<p>Aucun arrêt déclaré pour ce périmètre.</p>}<div className="daily-print-causes-foot">Arrêts cumulés : {num(total.planned+total.breakdown+total.startup+total.changeover,0)} min · Journaux avec horaires : {detailed}/{rows.length}</div></div>
    <p className="daily-print-note">Les rebuts distinguent démarrage/réglage et production, conformément à la saisie Excel. Une cause détaillée apparaît lorsqu’elle est renseignée dans le journal des arrêts.</p>
   </section>
  </main>
  <footer className="daily-print-footer"><span>QOS · Atelier Injection</span><span>Le journal d’arrêt donne les horaires ; les totaux anciens restent sans chronologie.</span><span>{date}</span></footer>
 </section>;
}
