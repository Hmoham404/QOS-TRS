import React, { lazy, Suspense, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DEPARTMENTS } from './DepartmentSwitcher.jsx';
import { loadData } from './data.js';
import { aggregate, formatNumber as num, percent, today } from './domain.js';
import { shiftDate } from './daily.js';
import { t } from './i18n.js';
import './department-comparison.css';
const ComparisonTrend = lazy(() => import('./ComparisonTrend.jsx'));

export default function DepartmentComparison() {
  const [results, setResults] = useState({});
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [dateMode, setDateMode] = useState('day');
  const [trend, setTrend] = useState(null);
  const selectDay = date => { setFrom(date); setTo(date); };
  const moveDay = days => selectDay(shiftDate(from === to && from ? from : today(), days));
  useEffect(() => {
    let active = true;
    setResults({});
    for (const department of DEPARTMENTS) {
      loadData(department.id, { maxAge: 30000 }).then(data => {
        if (active) setResults(current => ({ ...current, [department.id]: { data } }));
      }).catch(error => {
        if (active) setResults(current => ({ ...current, [department.id]: { error: error.message } }));
      });
    }
    return () => { active = false; };
  }, []);
  return <section className="department-comparison" aria-label={t('Comparaison des départements')}>
    <div className="comparison-intro"><div><span className="comparison-kicker">{t('TOUS LES ATELIERS')}</span><h2>{t('Une vue commune de la production')}</h2><p>{t('Comparez les indicateurs de chaque département sur la même période.')}</p></div><div className="comparison-filters"><div className="comparison-period"><span className="comparison-filter-label">{t('Période')}</span><div className="comparison-mode" role="group" aria-label={t('Période')}><button type="button" aria-pressed={dateMode === 'day'} onClick={() => { setDateMode('day'); selectDay(from || today()); }}>{t('Jour')}</button><button type="button" aria-pressed={dateMode === 'period'} onClick={() => setDateMode('period')}>{t('Période')}</button></div></div>{dateMode === 'day' ? <div className="comparison-day"><button type="button" aria-label={t('Jour précédent')} onClick={() => moveDay(-1)}><ChevronLeft size={18}/></button><label>{t('Date analysée')}<input type="date" aria-label={t('Date analysée')} value={from} onChange={e => { if (e.target.value) selectDay(e.target.value); }} /></label><button type="button" aria-label={t('Jour suivant')} onClick={() => moveDay(1)}><ChevronRight size={18}/></button></div> : <><label>{t('Du')}<input type="date" aria-label={t('Date de début')} value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label><label>{t('au')}<input type="date" aria-label={t('Date de fin')} value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label></>}</div></div>
    <div className="comparison-list">{DEPARTMENTS.map(({id,name,icon:Icon},index) => {
      const result = results[id];
      const rows = result?.data?.records.filter(row => (!from || row.date >= from) && (!to || row.date <= to)) || [];
      const totals = aggregate(rows);
      return <article className="comparison-card" data-department={id} key={id}>
        <div className="comparison-card-header"><div className="comparison-name"><span className="comparison-icon"><Icon size={20}/></span><div><span className="comparison-index">{String(index+1).padStart(2,'0')} / {t('DÉPARTEMENT')}</span><h3>{t(name)}</h3></div></div><span className="comparison-count">{result?.data ? `${num(rows.length)} ${t('relevés')}` : ''}</span></div>
        {!result ? <p className="comparison-state" role="status">{t('Chargement des données…')}</p> : result.error ? <p className="comparison-state comparison-error" role="alert">{t('Données indisponibles')} : {result.error}</p> : <>
          {result.data.offline && <p className="comparison-offline">{t('Copie hors connexion')}</p>}
          <div className="comparison-metrics">{[['OEE','trs'],['Disponibilité','availability'],['Performance','performance'],['Qualité','quality']].map(([label,metric],i) => { const value=totals[metric]; return <button type="button" className={i===0?'comparison-metric primary':'comparison-metric'} key={label} aria-label={`${t(label)} · ${t(name)} · ${t('Voir la courbe')}`} onClick={() => setTrend({department:name,metric,label,rows:result.data.records})}><span>{t(label)}</span><strong>{percent(value)}</strong><div className="comparison-track"><i style={{width: `${Math.max(0, Math.min(100, (value ?? 0)*100))}%`}} /></div></button>; })}</div>
          <div className="comparison-metrics comparison-labor">
            <button type="button" className="comparison-metric" aria-label={`${t('DLE')} · ${t(name)} · ${t('Voir la courbe')}`} onClick={() => setTrend({department:name,metric:'dle',label:'DLE',rows:result.data.records})}><span>{t('DLE')}</span><strong>{percent(totals.dle)}</strong><div className="comparison-track"><i style={{width: `${Math.max(0, Math.min(100, (totals.dle ?? 0)*100))}%`}} /></div></button>
            <div className="comparison-metric comparison-time"><span>{t('Temps recette')}</span><strong>{num(totals.earned, 2)} <small>{t('h')}</small></strong></div>
            <div className="comparison-metric comparison-time"><span>{t('Temps dépensé')}</span><strong>{num(totals.labor, 2)} <small>{t('h')}</small></strong></div>
          </div>
          <div className="comparison-summary"><span>{t('Pièces conformes')} <strong>{num(totals.good)}</strong></span><span>{t('Rebuts')} <strong>{num(totals.rejects)}</strong></span><span>{t('Temps machine')} <strong>{num(totals.runtime / 60,1)} h</strong></span></div>
          {!rows.length && <p className="comparison-empty">{t('Aucun relevé pour cette période.')}</p>}
        </>}
      </article>;
    })}</div>
    {trend && <Suspense fallback={<div role="status">{t('Chargement des données…')}</div>}><ComparisonTrend {...trend} onClose={() => setTrend(null)} /></Suspense>}
  </section>;
}
