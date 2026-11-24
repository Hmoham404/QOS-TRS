import React, { useEffect, useRef } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { availabilityStops } from './availability-stops.js';
import { formatNumber as num, percent } from './domain.js';
import { t } from './i18n.js';

function StopTooltip({ active, payload }) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return <div className="chart-tooltip"><strong>{t(item.label)}</strong><div>{num(item.minutes, 1)} {t('min')} · {percent(item.share / 100)}</div></div>;
}

export default function AvailabilityStops({ rows, point, periodLabel }) {
  const section = useRef(null);
  const stops = availabilityStops(rows, point);
  useEffect(() => { section.current?.scrollIntoView({ block: 'nearest' }); }, [point.key]);
  return <section ref={section} className="availability-stops" aria-label={t('Causes des arrêts')} data-period={point.key}>
    <div className="availability-stops-heading"><div><span className="comparison-index">{periodLabel}</span><h3>{t('Causes des arrêts')}</h3></div><div className="availability-stops-totals"><span>{t('Disponibilité')} <strong>{percent(stops.availability)}</strong></span><span>{t('Arrêts')} <strong data-total-minutes={stops.total}>{num(stops.total, 1)} {t('min')}</strong></span></div></div>
    <p className="comparison-chart-note">{t('Arrêts non planifiés de la période sélectionnée. Les arrêts planifiés sont exclus du calcul de disponibilité.')}</p>
    {stops.items.length ? <>
      <div className="availability-stops-charts">
        <div className="availability-stop-panel"><h4>{t('Pareto des arrêts machine')}</h4><div className="availability-stop-chart" role="img" aria-label={t('Pareto des arrêts machine')}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={stops.items} margin={{ top: 15, right: 0, left: 0, bottom: 5 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)"/><XAxis dataKey="short" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false}/><YAxis yAxisId="minutes" width={48} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false}/><YAxis yAxisId="percent" orientation="right" domain={[0, 100]} width={42} tickFormatter={value => `${num(value)}%`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false}/><Tooltip content={<StopTooltip/>}/><ReferenceLine yAxisId="percent" y={80} stroke="var(--text-muted)" strokeDasharray="4 4"/><Bar yAxisId="minutes" dataKey="minutes" maxBarSize={50} radius={[5,5,0,0]} isAnimationActive={false}>{stops.items.map(item => <Cell key={item.short} fill={item.color}/>)}</Bar><Line yAxisId="percent" dataKey="cumulative" stroke="var(--text)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}/></ComposedChart></ResponsiveContainer></div><p className="comparison-chart-note">{t('Durée (min)')} · {t('Cumul (%)')} · {t('Seuil repère : 80 %')}</p></div>
        <div className="availability-stop-panel"><h4>{t('Répartition des arrêts')}</h4><div className="availability-stop-chart" role="img" aria-label={t('Répartition des arrêts')}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stops.items} dataKey="minutes" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={2} isAnimationActive={false}>{stops.items.map(item => <Cell key={item.short} fill={item.color}/>)}</Pie><Tooltip content={<StopTooltip/>}/></PieChart></ResponsiveContainer></div></div>
      </div>
      <ol className="availability-stop-causes">{stops.items.map(item => <li key={item.short}><span className="availability-stop-cause"><i style={{ background: item.color }}/><b>{item.short}</b> {t(item.label)}</span><strong>{num(item.minutes, 1)} {t('min')}</strong><span>{percent(item.share / 100)}</span></li>)}</ol>
    </> : <p className="comparison-chart-empty">{t('Aucun arrêt à classer.')}</p>}
  </section>;
}
