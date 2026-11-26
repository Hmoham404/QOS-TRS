import React, { useEffect, useRef, useState } from 'react';
import { FileText, Printer, RefreshCw, X } from 'lucide-react';
import { loadData } from './data.js';
import { DEPARTMENT_IDS, departmentConfig } from './departments.js';
import { today, formatNumber as num, percent } from './domain.js';
import { t, getLocale } from './i18n.js';
import { productionReport, reportPeriod, reportDle } from './production-report.js';
import { calendarWeekLabel } from './calendar-week.js';
import { reportPrintHtml, printReport } from './report-print.js';

const ORDER = ['injection', 'welding', 'metallization', 'assembly', 'screen-printing'];
const dateLabel = date => new Date(`${date}T12:00:00Z`).toLocaleDateString(getLocale(), { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function ProductionReport({ onClose }) {
  const dialog = useRef(null);
  const [mode, setMode] = useState('day');
  const [reference, setReference] = useState(today);
  const [results, setResults] = useState({});
  const [reload, setReload] = useState(0);
  const [pointages, setPointages] = useState({});
  const period = reportPeriod(mode, reference);
  const periodKey = `${mode}:${period.from}:${period.to}`;
  const pointage = pointages[periodKey] || '';
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
  const dle = complete && report.count ? reportDle(report.hours, pointage) : null;
  const invalidPointage = pointage !== '' && (!Number.isFinite(Number(pointage.replace(',', '.'))) || Number(pointage.replace(',', '.')) <= 0);
  return <dialog ref={dialog} className="production-report" aria-labelledby="production-report-title" onClose={onClose}>
    <header className="pr-header"><div><span className="pr-eyebrow"><FileText size={15}/>{t('TOUS LES ATELIERS')}</span><h2 id="production-report-title">{t('Rapport de production')}</h2><p>{t('Quantités × TC par pièce · Temps délivré · DLE')}</p></div><button className="icon-button" type="button" aria-label={t('Fermer')} onClick={() => dialog.current.close()}><X size={21}/></button></header>
    <div className="pr-controls"><div className="pr-modes" role="group" aria-label={t('Période du rapport')}>{[['day','Jour'],['week','Semaine'],['month','Mois']].map(([value,label]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{t(label)}</button>)}</div><label>{t(mode === 'month' ? 'Mois du rapport' : 'Date du rapport')}<input type={mode === 'month' ? 'month' : 'date'} value={mode === 'month' ? reference.slice(0,7) : reference} onChange={event => { if (event.target.value) setReference(mode === 'month' ? `${event.target.value}-01` : event.target.value); }}/></label><button type="button" className="btn" aria-label={t('Actualiser le rapport')} onClick={() => setReload(value => value + 1)}><RefreshCw size={16}/>{t('Actualiser')}</button><button type="button" className="btn primary pr-print" disabled={!complete || invalidPointage} onClick={() => printReport(reportPrintHtml({report, period, mode, pointage, offline: DEPARTMENT_IDS.some(id => results[id]?.data?.offline)}))}><Printer size={16}/>{t('Imprimer / PDF')}</button></div>
    <p className="pr-period">{mode === 'week' && <strong>{calendarWeekLabel(reference)} · </strong>}{dateLabel(period.from)}{period.to !== period.from && <> — {dateLabel(period.to)}</>}</p>
    <section className="pr-summary" aria-label={t('Synthèse du rapport')}>
      <div className="pr-delivered"><span>{t('Temps délivré')}</span><strong data-testid="delivered-time">{complete ? num(report.hours, 2) : '—'} <small>{t('h')}</small></strong><p>{t('Somme (quantités conformes × TC) ÷ 3 600')}</p></div>
      <div className="pr-pointage"><label htmlFor="report-clocked">{t('Temps de pointage (h)')}</label><input id="report-clocked" inputMode="decimal" type="text" value={pointage} placeholder="—" aria-invalid={invalidPointage} aria-describedby="pr-pointage-help" onChange={event => setPointages(current => ({ ...current, [periodKey]: event.target.value }))}/><p id="pr-pointage-help">{t(invalidPointage ? 'Saisissez un nombre d’heures supérieur à zéro.' : 'Facultatif · À renseigner pour cette période.')}</p></div>
      <div className="pr-dle"><span>DLE</span><strong data-testid="report-dle">{percent(dle)}</strong><p>{t('Temps délivré ÷ temps de pointage × 100')}</p></div>
    </section>
    {!ready && <p role={failed ? 'alert' : 'status'} className="pr-state">{t(failed ? 'Rapport incomplet : certaines données sont indisponibles.' : 'Chargement des données…')}</p>}
    {DEPARTMENT_IDS.filter(id => results[id]?.error).map(id => <p className="pr-state" role="alert" key={id}>{t(departmentConfig(id).name)} : {t(results[id].error)}</p>)}
    {report.invalid && <p role="alert" className="pr-state">{t('Certains relevés ont une quantité ou un TC invalide. Le total ne peut pas être calculé.')}</p>}
    {DEPARTMENT_IDS.some(id => results[id]?.data?.offline) && <p className="pr-state">{t('Copie hors connexion')}</p>}
    <div className="pr-table-scroll"><table><caption>{t('Détail par article et TC historique')}</caption><thead><tr><th scope="col">{t('Opération / article')}</th><th scope="col">{t('Quantité conforme')}</th><th scope="col">{t('TC / pièce (s)')}</th><th scope="col">{t('Quantité × TC (s)')}</th><th scope="col">{t('Temps délivré (h)')}</th></tr></thead><tbody>{ORDER.map(id => {
      if (!results[id]?.data) return null;
      const lines = report.lines.filter(line => line.department === id);
      return <React.Fragment key={id}><tr className="pr-group"><th colSpan={5} scope="rowgroup">{t(departmentConfig(id).name)}</th></tr>{lines.map(line => <tr key={line.key} className={!line.count ? 'pr-empty-row' : undefined}><th scope="row">{line.name}<small>{line.code}{!line.count && <> · {t('Aucun relevé pour cette période.')}</>}</small></th><td>{line.count ? num(line.quantity) : '—'}</td><td>{line.invalid || !Number.isFinite(line.cycle) ? '—' : num(line.cycle, 3)}</td><td>{line.invalid || !line.count ? '—' : num(line.seconds, 2)}</td><td>{line.invalid || !line.count ? '—' : num(line.seconds / 3600, 2)}</td></tr>)}</React.Fragment>;
    })}</tbody><tfoot><tr><th scope="row" colSpan={4}>{t('Total du temps délivré')}</th><td>{complete ? num(report.hours,2) : '—'} {t('h')}</td></tr></tfoot></table></div>
    <footer className="pr-footer"><p>{t('Les quantités conformes et les TC par pièce proviennent des relevés de la période. Un article avec plusieurs TC apparaît sur plusieurs lignes.')}</p><p>{t('Le pointage reste vide par défaut. Sa saisie est conservée uniquement pendant l’ouverture du rapport, pour chaque période.')}</p>{ready && !report.count && <p>{t('Aucun relevé pour cette période.')}</p>}</footer>
  </dialog>;
}
