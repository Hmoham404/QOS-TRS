import React, { lazy, Suspense, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DEPARTMENTS } from './DepartmentSwitcher.jsx';
import { loadData } from './data.js';
import { aggregate, formatNumber as num, percent, ratio, today } from './domain.js';
import { shiftDate } from './daily.js';
import { t } from './i18n.js';
import MachineSelector from './MachineSelector.jsx';
import './department-comparison.css';
const ComparisonTrend = lazy(() => import('./ComparisonTrend.jsx'));

export default function DepartmentComparison() {
  const [results, setResults] = useState({});
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [dateMode, setDateMode] = useState('day');
  const [trend, setTrend] = useState(null);
  const [machines, setMachines] = useState({});
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
  const inPeriod = row => (!from || row.date >= from) && (!to || row.date <= to);
  const factoryReady = DEPARTMENTS.every(({ id }) => results[id]?.data);
  const factoryError = DEPARTMENTS.some(({ id }) => results[id]?.error);
  const factoryOffline = DEPARTMENTS.some(({ id }) => results[id]?.data?.offline);
  const factoryTotals = aggregate(DEPARTMENTS.flatMap(({ id }) => results[id]?.data?.records.filter(inPeriod) || []));
  const factoryMetrics = [['OEE', factoryTotals.trs], ['DLE', factoryTotals.dle], ['% Rebut', ratio(factoryTotals.rejects, factoryTotals.total)]];
  return <section className="department-comparison" aria-label={t('Comparaison des départements')}>
    <div className="comparison-intro"><div className="comparison-factory"><dl className="comparison-factory-metrics" aria-label={t('Indicateurs globaux de l’usine')} aria-busy={!factoryReady && !factoryError}>{factoryMetrics.map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{factoryReady ? percent(value) : '—'}</dd></div>)}</dl>{!factoryReady && <p role={factoryError ? 'alert' : 'status'}>{t(factoryError ? 'Données indisponibles' : 'Chargement des données…')}</p>}{factoryReady && factoryOffline && <p>{t('Copie hors connexion')}</p>}</div><div className="comparison-filters"><div className="comparison-period"><span className="comparison-filter-label">{t('Période')}</span><div className="comparison-mode" role="group" aria-label={t('Période')}><button type="button" aria-pressed={dateMode === 'day'} onClick={() => { setDateMode('day'); selectDay(from || today()); }}>{t('Jour')}</button><button type="button" aria-pressed={dateMode === 'period'} onClick={() => setDateMode('period')}>{t('Période')}</button></div></div>{dateMode === 'day' ? <div className="comparison-day"><button type="button" aria-label={t('Jour précédent')} onClick={() => moveDay(-1)}><ChevronLeft size={18}/></button><label>{t('Date analysée')}<input type="date" aria-label={t('Date analysée')} value={from} onChange={e => { if (e.target.value) selectDay(e.target.value); }} /></label><button type="button" aria-label={t('Jour suivant')} onClick={() => moveDay(1)}><ChevronRight size={18}/></button></div> : <><label>{t('Du')}<input type="date" aria-label={t('Date de début')} value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label><label>{t('au')}<input type="date" aria-label={t('Date de fin')} value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label></>}</div></div>
    <div className="comparison-list">{DEPARTMENTS.map(({id,name,icon:Icon},index) => {
      const result = results[id];
      const periodRows = result?.data?.records.filter(inPeriod) || [];
      const selectedMachine = machines[id] || '';
      const machineRows = result?.data?.records.filter(row => !selectedMachine || row.press_id === selectedMachine) || [];
      const rows = machineRows.filter(inPeriod);
      const machine = result?.data?.presses.find(press => press.id === selectedMachine);
      const trendDepartment = machine ? `${t(name)} · ${machine.name}` : name;
      const totals = aggregate(rows);
      return <article className="comparison-card" data-department={id} key={id}>
        <div className="comparison-card-header"><div className="comparison-heading-group"><div className="comparison-name"><span className="comparison-icon"><Icon size={20}/></span><div><span className="comparison-index">{String(index+1).padStart(2,'0')} / {t('DÉPARTEMENT')}</span><h3>{t(name)}</h3></div></div>{result?.data && <MachineSelector presses={result.data.presses} rows={periodRows} records={result.data.records} value={selectedMachine} onChange={value => setMachines(current => ({...current, [id]: value}))} department={name}/>}</div><span className="comparison-count">{result?.data ? `${num(rows.length)} ${t('relevés')}` : ''}</span></div>
        {!result ? <p className="comparison-state" role="status">{t('Chargement des données…')}</p> : result.error ? <p className="comparison-state comparison-error" role="alert">{t('Données indisponibles')} : {result.error}</p> : <>
          {result.data.offline && <p className="comparison-offline">{t('Copie hors connexion')}</p>}
          <div className="comparison-metrics">{[['OEE','trs'],['Disponibilité','availability'],['Performance','performance'],['Qualité','quality']].map(([label,metric],i) => { const value=totals[metric]; return <button type="button" className={i===0?'comparison-metric primary':'comparison-metric'} key={label} aria-label={`${t(label)} · ${t(name)} · ${t('Voir la courbe')}`} onClick={() => setTrend({department:trendDepartment,metric,label,rows:machineRows})}><span>{t(label)}</span><strong>{percent(value)}</strong><div className="comparison-track"><i style={{width: `${Math.max(0, Math.min(100, (value ?? 0)*100))}%`}} /></div></button>; })}</div>
          <div className="comparison-metrics comparison-labor">
            <button type="button" className="comparison-metric" aria-label={`${t('DLE')} · ${t(name)} · ${t('Voir la courbe')}`} onClick={() => setTrend({department:trendDepartment,metric:'dle',label:'DLE',rows:machineRows})}><span>{t('DLE')}</span><strong>{percent(totals.dle)}</strong><div className="comparison-track"><i style={{width: `${Math.max(0, Math.min(100, (totals.dle ?? 0)*100))}%`}} /></div></button>
            <div className="comparison-metric comparison-time"><span>{t('Heures gammes')}</span><strong>{num(totals.earned, 2)} <small>{t('h')}</small></strong></div>
            <div className="comparison-metric comparison-time"><span>{t('Heures déclarées')}</span><strong>{num(totals.labor, 2)} <small>{t('h')}</small></strong></div>
            <div className="comparison-metric comparison-time"><span>{t('Heures de pointage')}</span><strong>{num(totals.labor, 2)} <small>{t('h')}</small></strong></div>
          </div>
          <div className="comparison-metrics comparison-quality">
            <div className="comparison-metric"><span>{t('% Rebut')}</span><strong>{percent(ratio(totals.rejects, totals.total))}</strong><div className="comparison-track"><i style={{width: `${Math.max(0, Math.min(100, (ratio(totals.rejects, totals.total) ?? 0) * 100))}%`}} /></div></div>
            <div className="comparison-metric comparison-time"><span>{t('Pièces conformes')}</span><strong>{num(totals.good)}</strong></div>
            <div className="comparison-metric comparison-time"><span>{t('Pièces rebutées')}</span><strong>{num(totals.rejects)}</strong></div>
            <div className="comparison-metric comparison-time"><span>{t('Heures de tri')}</span><strong>{totals.sortingCount ? num(totals.sorting, 2) : '—'} <small>{t('h')}</small></strong></div>
          </div>
          {!rows.length && <p className="comparison-empty">{t('Aucun relevé pour cette période.')}</p>}
        </>}
      </article>;
    })}</div>
    {trend && <Suspense fallback={<div role="status">{t('Chargement des données…')}</div>}><ComparisonTrend {...trend} onClose={() => setTrend(null)} /></Suspense>}
  </section>;
}
