import React, { useEffect, useRef, useState } from 'react';
import { FileText, Printer, RefreshCw, X, ChevronLeft, ChevronRight, Timer, Clock3, Gauge } from 'lucide-react';
import { loadData } from './data.js';
import { DEPARTMENT_IDS, departmentConfig } from './departments.js';
import { today, formatNumber as num, percent } from './domain.js';
import { t, getLocale } from './i18n.js';
import { productionReport, reportPeriod, reportDle } from './production-report.js';
import { calendarWeekLabel } from './calendar-week.js';
import { reportPrintHtml, printReport } from './report-print.js';
import { shiftReportReference } from './report-period.js';
import { fetchRhPointage } from './rh-pointage.js';

const ORDER = ['injection', 'welding', 'metallization', 'assembly', 'screen-printing'];
const dateLabel = date => new Date(`${date}T12:00:00Z`).toLocaleDateString(getLocale(), { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function ProductionReport({ onClose }) {
  const dialog = useRef(null);
  const [mode, setMode] = useState('day');
  const [reference, setReference] = useState(today);
  const [results, setResults] = useState({});
  const [reload, setReload] = useState(0);
  const [pointages, setPointages] = useState({});
  const [rh, setRh] = useState(null);
  const period = reportPeriod(mode, reference);
  const periodKey = `${mode}:${period.from}:${period.to}`;
  const rhCurrent = rh?.key === periodKey ? rh : null;
  const manualPointage = Object.hasOwn(pointages, periodKey);
  const pointage = manualPointage ? pointages[periodKey] : rhCurrent?.hours != null ? String(rhCurrent.hours) : '';
  const rhComplete = manualPointage || rhCurrent?.status === 'ready';
  const pointagePrint = { source: manualPointage ? 'manual' : 'rh', complete: rhComplete, status: rhCurrent?.status || 'loading', coveredDays: rhCurrent?.coveredDates?.length || 0, missingDays: rhCurrent?.missingDates?.length || 0, reviewCount: rhCurrent?.reviewCount || 0 };
  useEffect(() => {
    const controller = new AbortController();
    setRh({key:periodKey,status:'loading'});
    fetchRhPointage(period.from, period.to, {signal:controller.signal})
      .then(result => { if (!controller.signal.aborted) setRh({...result,key:periodKey}); })
      .catch(() => { if (!controller.signal.aborted) setRh({key:periodKey,status:'error'}); });
    return () => controller.abort();
  }, [periodKey, reload]);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    let active = true;
    setResults({});
    DEPARTMENT_IDS.forEach(id => {
      loadData(id).then(data => {
        if (active) setResults(current => ({ ...current, [id]: { data: { ...data, department: id } } }));
      }).catch(error => {
        if (active) setResults(current => ({ ...current, [id]: { error: error.message } }));
      });
    });
    return () => { active = false; };
  }, [reload]);
  const ready = DEPARTMENT_IDS.every(id => results[id]?.data);
  const failed = DEPARTMENT_IDS.some(id => results[id]?.error);
  const report = productionReport(ORDER.flatMap(id => results[id]?.data ? [results[id].data] : []), period.from, period.to);
  const complete = ready && !report.invalid;
  const dle = complete && report.count && rhComplete ? reportDle(report.hours, pointage) : null;
  const invalidPointage = manualPointage && pointage !== '' && (!Number.isFinite(Number(pointage.replace(',', '.'))) || Number(pointage.replace(',', '.')) <= 0);
  return <dialog ref={dialog} className="production-report" aria-labelledby="production-report-title" onClose={onClose}>
    <header className="pr-header"><div className="pr-title-block"><span className="pr-document-icon"><FileText size={27}/></span><div><span className="pr-eyebrow">QOS · {t('TOUS LES ATELIERS')}</span><h2 id="production-report-title">{t('Rapport de production')}</h2><p>{t('Quantités × TC par pièce · Temps délivré · DLE')}</p></div></div><button className="icon-button" type="button" aria-label={t('Fermer')} onClick={() => dialog.current.close()}><X size={21}/></button></header>
    <div className="pr-controls"><div className="pr-modes" role="group" aria-label={t('Période du rapport')}>{[['day','Jour'],['week','Semaine'],['month','Mois']].map(([value,label]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{t(label)}</button>)}</div><div className="pr-date-control"><label htmlFor="pr-reference">{t(mode === 'month' ? 'Mois du rapport' : 'Date du rapport')}</label><div className="pr-date-navigation"><button type="button" className="pr-date-arrow" aria-label={t(mode === 'month' ? 'Mois précédent' : mode === 'week' ? 'Semaine précédente' : 'Jour précédent')} onClick={() => setReference(value => shiftReportReference(mode, value, -1))}><ChevronLeft size={17}/></button><input id="pr-reference" type={mode === 'month' ? 'month' : 'date'} value={mode === 'month' ? reference.slice(0,7) : reference} onChange={event => { if (event.target.value) setReference(mode === 'month' ? `${event.target.value}-01` : event.target.value); }}/><button type="button" className="pr-date-arrow" aria-label={t(mode === 'month' ? 'Mois suivant' : mode === 'week' ? 'Semaine suivante' : 'Jour suivant')} onClick={() => setReference(value => shiftReportReference(mode, value, 1))}><ChevronRight size={17}/></button></div></div><button type="button" className="btn" aria-label={t('Actualiser le rapport')} onClick={() => setReload(value => value + 1)}><RefreshCw size={16}/>{t('Actualiser')}</button><button type="button" className="btn primary pr-print" disabled={!complete || invalidPointage} onClick={() => printReport(reportPrintHtml({report, period, mode, pointage, pointageInfo: pointagePrint, offline: DEPARTMENT_IDS.some(id => results[id]?.data?.offline)}))}><Printer size={16}/>{t('Imprimer / PDF')}</button></div>
    <div className="pr-period-row"><p className="pr-period">{mode === 'week' && <strong>{calendarWeekLabel(reference)} · </strong>}{dateLabel(period.from)}{period.to !== period.from && <> — {dateLabel(period.to)}</>}</p><span className="pr-record-count">{ready ? `${num(report.count)} ${t('relevés')}` : t('Chargement des données…')}</span></div>
    <section className="pr-summary" aria-label={t('Synthèse du rapport')}>
      <div className="pr-delivered"><span className="pr-card-label"><Timer size={17}/>{t('Temps délivré')}</span><strong data-testid="delivered-time">{complete && report.count ? num(report.hours, 2) : '—'} <small>{t('h')}</small></strong><p>{t('Somme (quantités conformes × TC) ÷ 3 600')}</p></div>
      <div className="pr-pointage"><label className="pr-card-label" htmlFor="report-clocked"><Clock3 size={17}/>{t('Temps de pointage (h)')}</label><input id="report-clocked" inputMode="decimal" type="text" value={manualPointage ? pointage : rhCurrent?.hours != null ? String(Number(rhCurrent.hours.toFixed(4))) : ''} aria-busy={!manualPointage && rhCurrent?.status === 'loading'} placeholder="—" aria-invalid={invalidPointage} aria-describedby="pr-pointage-help" onChange={event => setPointages(current => ({ ...current, [periodKey]: event.target.value }))}/><div id="pr-pointage-help" className="pr-rh-help" aria-live="polite"><p>{t(invalidPointage ? 'Saisissez un nombre d’heures supérieur à zéro.' : manualPointage ? 'Saisie manuelle pour cette période.' : rhCurrent?.status === 'loading' || !rhCurrent ? 'Chargement du pointage RH…' : rhCurrent.status === 'error' ? 'Pointage RH indisponible. Actualisez ou saisissez les heures manuellement.' : rhCurrent.status === 'empty' ? 'Aucun pointage MOD Production disponible pour cette période.' : rhCurrent.status === 'partial' ? 'Pointage RH incomplet : le DLE reste en attente.' : 'Source RH · MOD Production · Heures validées.')}</p>{!manualPointage && rhCurrent?.status === 'partial' && <p>{t('{0} jour(s) couvert(s) · {1} jour(s) manquant(s) · {2} pointage(s) à vérifier.', [num(rhCurrent.coveredDates.length), num(rhCurrent.missingDates.length), num(rhCurrent.reviewCount)])}</p>}{!manualPointage && <a className="pr-rh-restore" href="https://d-rh-hn7b.vercel.app/" target="_blank" rel="noopener noreferrer">{t('Ouvrir le pointage RH')}</a>}{manualPointage && <button type="button" className="pr-rh-restore" onClick={() => setPointages(current => { const next = {...current}; delete next[periodKey]; return next; })}>{t('Reprendre le pointage RH')}</button>}</div></div>
      <div className="pr-dle"><span className="pr-card-label"><Gauge size={17}/>DLE</span><strong data-testid="report-dle">{percent(dle)}</strong><p>{t('Temps délivré ÷ temps de pointage × 100')}</p></div>
    </section>
    {!ready && <p role={failed ? 'alert' : 'status'} className="pr-state">{t(failed ? 'Rapport incomplet : certaines données sont indisponibles.' : 'Chargement des données…')}</p>}
    {DEPARTMENT_IDS.filter(id => results[id]?.error).map(id => <p className="pr-state" role="alert" key={id}>{t(departmentConfig(id).name)} : {t(results[id].error)}</p>)}
    {report.invalid && <p role="alert" className="pr-state">{t('Certains relevés ont une quantité ou un TC invalide. Le total ne peut pas être calculé.')}</p>}
    {DEPARTMENT_IDS.some(id => results[id]?.data?.offline) && <p className="pr-state">{t('Copie hors connexion')}</p>}
    {ready && !report.count && <div className="pr-empty-notice"><FileText size={21}/><div><strong>{t('Aucun relevé pour cette période.')}</strong><p>{t('Choisissez une autre date ou élargissez la période pour consulter la production.')}</p></div></div>}
    <div className="pr-table-scroll"><table><caption>{t('Détail par article et TC historique')}</caption><thead><tr><th scope="col">{t('Opération / article')}</th><th scope="col">{t('Quantité conforme')}</th><th scope="col">{t('TC / pièce (s)')}</th><th scope="col">{t('Quantité × TC (s)')}</th><th scope="col">{t('Temps délivré (h)')}</th></tr></thead><tbody>{ORDER.map(id => {
      if (!results[id]?.data) return null;
      const lines = report.lines.filter(line => line.department === id);
      return <React.Fragment key={id}><tr className="pr-group" data-department={id}><th colSpan={5} scope="rowgroup"><span className="pr-group-name"><i aria-hidden="true"/>{t(departmentConfig(id).name)}</span></th></tr>{lines.map(line => <tr key={line.key} className={!line.count ? 'pr-empty-row' : undefined}><th scope="row">{line.name}<small>{line.code}</small></th><td>{line.count ? num(line.quantity) : '—'}</td><td>{line.invalid || !Number.isFinite(line.cycle) ? '—' : num(line.cycle, 3)}</td><td>{line.invalid || !line.count ? '—' : num(line.seconds, 2)}</td><td>{line.invalid || !line.count ? '—' : num(line.seconds / 3600, 2)}</td></tr>)}</React.Fragment>;
    })}</tbody><tfoot><tr><th scope="row" colSpan={4}>{t('Total du temps délivré')}</th><td>{complete && report.count ? num(report.hours,2) : '—'} {t('h')}</td></tr></tfoot></table></div>
    <footer className="pr-footer"><p>{t('Les quantités conformes et les TC par pièce proviennent des relevés de la période. Un article avec plusieurs TC apparaît sur plusieurs lignes.')}</p><p>{t('Le pointage RH est chargé automatiquement pour la période. Une saisie manuelle peut le remplacer pendant l’ouverture du rapport.')}</p>{ready && !report.count && <p>{t('Aucun relevé pour cette période.')}</p>}</footer>
  </dialog>;
}
