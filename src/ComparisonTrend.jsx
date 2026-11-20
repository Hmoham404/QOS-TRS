import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, LabelList } from 'recharts';
import { aggregate, formatNumber as num, today } from './domain.js';
import { getLocale, t } from './i18n.js';

const dateString = d => d.toISOString().slice(0, 10);
const atNoon = date => new Date(date + 'T12:00:00Z');
const addDays = (date, days) => { const d=atNoon(date); d.setUTCDate(d.getUTCDate()+days); return dateString(d); };
const monday = date => { const d=atNoon(date); return addDays(date, -(d.getUTCDay()+6)%7); };
const formatDate = (date, options) => atNoon(date).toLocaleDateString(getLocale(), {...options,timeZone:'UTC'});

export function comparisonTrend(rows, metric, reference = today()) {
  const endMonth = reference.slice(0,7);
  const endDate = atNoon(reference);
  const monthStart = endMonth+'-01';
  const monthEndDate = new Date(Date.UTC(endDate.getUTCFullYear(),endDate.getUTCMonth()+1,0,12));
  const monthEnd = dateString(monthEndDate);
  const weekStart = monday(reference);
  const result = [];
  const add = (key, label, group, start, end) => {
    const selected = rows.filter(r => r.date >= start && r.date <= end);
    const value = aggregate(selected)[metric];
    result.push({key,label,group,start,end,value:value == null ? null : value*100});
  };
  for (let offset=2; offset>=0; offset--) {
    const date = new Date(Date.UTC(endDate.getUTCFullYear(),endDate.getUTCMonth()-offset,1,12));
    const start=dateString(date), end=dateString(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0,12)));
    add('month-'+start,formatDate(start,{month:'short'}),'month',start,end);
  }
  let start=monday(monthStart), index=1;
  while(start<=monthEnd) {
    const end=addDays(start,6);
    add('week-'+start,`${t('S')} ${index++}`,'week',start<monthStart?monthStart:start,end>monthEnd?monthEnd:end);
    start=addDays(start,7);
  }
  for(let day=0;day<7;day++) {
    const date=addDays(weekStart,day);
    add('day-'+date,formatDate(date,{weekday:'short'}),'day',date,date);
  }
  return result;
}

function PointLabel({x,y,value}) {
  return value == null ? null : <text x={x} y={y-18} textAnchor="middle" fill="var(--text)" fontSize="18" fontWeight="800">{num(value,1)}%</text>;
}
function ChartTooltip({active,payload}) {
  const point=payload?.[0]?.payload;
  if (!active || !point || point.value == null) return null;
  const options={day:'numeric',month:'short',year:'numeric'};
  return <div className="chart-tooltip"><strong>{point.start===point.end ? formatDate(point.start,options) : `${formatDate(point.start,options)} – ${formatDate(point.end,options)}`}</strong><div>{num(point.value,1)} %</div></div>;
}
export default function ComparisonTrend({ department, metric, label, rows, onClose }) {
  const dialog = useRef(null);
  const points = comparisonTrend(rows, metric);
  const hasValues = points.some(point => point.value != null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="comparison-dialog" onClose={onClose} aria-labelledby="comparison-trend-title">
    <div className="comparison-dialog-header"><div><span className="comparison-index">{t(department)}</span><h2 id="comparison-trend-title">{t(label)} · {t('Évolution')}</h2><p>{t('Trois échelles de temps sur une seule courbe')}</p></div><button className="comparison-close" type="button" aria-label={t('Fermer')} onClick={() => dialog.current?.close()}><X size={20}/></button></div>
    {hasValues ? <><p className="comparison-chart-note">{t('Les valeurs sont calculées à partir des relevés de chaque période. Les périodes sans données restent vides.')}</p><div className="comparison-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{top:35,right:20,left:0,bottom:10}} accessibilityLayer><defs><linearGradient id="comparison-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#438cd8" stopOpacity={.38}/><stop offset="100%" stopColor="#438cd8" stopOpacity={.02}/></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="key" tickFormatter={key => points.find(point => point.key===key)?.label || ''} interval={0} tick={{fill:'var(--text-muted)',fontSize:11}} tickLine={false}/><YAxis domain={[0,max => Math.max(100,Math.ceil(max/20)*20)]} tickFormatter={value => `${num(value)} %`} width={58} tick={{fill:'var(--text-muted)',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><ReferenceLine x={points[2]?.key} stroke="#81b6bf" strokeDasharray="5 5"/><ReferenceLine x={points.filter(point => point.group==='week').at(-1)?.key} stroke="#81b6bf" strokeDasharray="5 5"/><Area type="linear" dataKey="value" stroke="#0d8d83" strokeWidth={3} fill="url(#comparison-area)" dot={{r:5,fill:'#0d8d83',stroke:'#fff',strokeWidth:3}} activeDot={{r:6}} connectNulls={false} isAnimationActive={false}><LabelList dataKey="value" content={<PointLabel/>}/></Area></AreaChart></ResponsiveContainer></div><div className="comparison-chart-sections"><span>{t('3 derniers mois')}</span><span>{t('Mois actuel')}</span><span>{t('Semaine actuelle')}</span></div></> : <p className="comparison-chart-empty">{t('Aucun relevé pour les périodes affichées.')}</p>}
  </dialog>;
}
