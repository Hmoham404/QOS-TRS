import React from 'react';
import { clockLabel } from './analytics';
import { dateLabel } from './domain';
import { shiftDate } from './daily';

export default function StopTimeInput({record,event,index,kind,mode,disabled,onChange}) {
  const isStart=kind==='start_min',label=isStart?'Début':'Fin';
  const [h,m]=(record.shift_start||'00:00').split(':').map(Number),base=h*60+m;
  const offset=Number(event[kind])||0,absolute=base+offset,day=Math.floor(absolute/1440);
  function setClock(value, nextDay=day){
    if(!value){onChange('');return;}
    const [hour,minute]=value.split(':').map(Number);
    onChange(hour*60+minute+nextDay*1440-base);
  }
  const clock=event[kind]===''?'':clockLabel(record.shift_start,offset).slice(0,5);
  if(mode==='minutes') return <label className="field"><span>{label} (min)</span><input aria-label={`${label} arrêt ${index+1}`} type="number" min="0" max={record.opening_min} step="any" value={event[kind]} disabled={disabled} required onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))}/></label>;
  return <div className="field stop-clock-input"><label><span>{label}</span><input type="time" required aria-label={`Heure de ${isStart?'début':'fin'} arrêt ${index+1}`} value={clock} disabled={disabled} onChange={e=>setClock(e.target.value)}/></label><select aria-label={`Jour de ${isStart?'début':'fin'} arrêt ${index+1}`} value={Math.max(0,day)} disabled={disabled} onChange={e=>setClock(clock,Number(e.target.value))}><option value="0">{record.date?dateLabel(record.date):'Jour du poste'} · J</option><option value="1">{record.date?dateLabel(shiftDate(record.date,1)):'Lendemain'} · J+1</option></select></div>;
}
