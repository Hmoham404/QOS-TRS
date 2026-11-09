import { IconButton, Empty, Badge } from './ui.jsx';
import { exportColumns } from "./export-columns.js";
import { getLocale, t as translate } from "./i18n.js";
import { departmentConfig, departmentScope, targetStorageKey } from "./departments.js";
import { DepartmentContext, useDepartmentText } from "./DepartmentContext.jsx";
import useLanguage from "./useLanguage.js";
import LanguageSelector from "./LanguageSelector.jsx";
import ThemeSwitcher from "./ThemeSwitcher.jsx";
import DepartmentSwitcher, { DEPARTMENTS, EmptyDepartment, getSavedDepartment } from "./DepartmentSwitcher.jsx";
import ExcelExport from "./ExcelExport.jsx";
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChartNoAxesCombined, LayoutDashboard, ClipboardPenLine, History, Factory, Settings2, ChevronRight, Plus, Monitor, Download, RefreshCw, LogOut, Database, X, AlertCircle, Check, Menu, ArrowUpRight, FileSpreadsheet, SlidersHorizontal } from "lucide-react";
import { configured, configError, loadData, download, dataScope } from "./data";
import PwaControls from "./PwaControls";
import DraftList from "./DraftList";
import { SHIFTS, calculate, percent, formatNumber as num, dateLabel, today } from "./domain";
import DailyReview from "./DailyReview";
import { yesterday } from "./daily";
const Dashboard = lazy(() => import('./Dashboard.jsx'));
const Curves = lazy(() => import('./Curves.jsx'));
const Entry = lazy(() => import('./Entry.jsx'));
const References = lazy(() => import('./References.jsx'));
export function exportCSV(rows, data) {
  const { headers: rawHeaders, extras, primaryBreakdown } = exportColumns(data.department);
  const headers = rawHeaders.map(translate);
  const safe = v => {
    let s = v == null ? "" : String(v);
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return "\"" + s.replaceAll("\"", "\"\"") + "\"";
  };
  const pct = v => v == null ? "" : (v * 100).toFixed(4).replace(".", ",");
  const lines = rows.map(r => {
    const c = calculate(r),
      a = data.articles.find(x => x.id === r.article_id);
    return [r.date, translate(r.shift), data.presses.find(x => x.id === r.press_id)?.name, a?.code, a?.name, r.opening_min, r.planned_min, c.required, r[primaryBreakdown] ?? 0, r.startup_min, r.changeover_min, c.runtime, c.total, r.good_qty, r.startup_rejects, r.production_rejects, r.cycle_seconds, c.availability, c.performance, c.quality, c.trs, r.standard_seconds, r.labor_hours, c.earned, c.dle, r.notes, r.shift_start || "", r.timeline_complete ? translate("Oui") : translate("Non"), JSON.stringify(r.stop_events || []), r.planned_qty ?? null, ...extras.map(field => r[field] ?? 0), ...(data.department && data.department !== "injection" ? [r.standard_operators ?? null, r.trs_target == null ? null : r.trs_target * 100, r.dle_target == null ? null : r.dle_target * 100] : [])].map((v, i) => safe([17, 18, 19, 20, 24].includes(i) ? pct(v) : typeof v === "number" ? String(v).replace(".", ",") : v)).join(";");
  });
  download("QOS-releves.csv", "﻿" + [headers.map(safe).join(";"), ...lines].join("\r\n"), "text/csv;charset=utf-8");
}
export default function App() {
  const [department, setDepartment] = useState(getSavedDepartment);
  function changeDepartment(next) {
    if (!DEPARTMENTS.some(item => item.id === next)) return;
    try { localStorage.setItem("qos-department", next); } catch {}
    setDepartment(next);
  }
  return <DepartmentContext.Provider value={department}><Workshop key={department} department={department} onDepartmentChange={changeDepartment} /></DepartmentContext.Provider>;
}
function Workshop({ department, onDepartmentChange }) {
  const language = useLanguage();
  const translate = useDepartmentText();
  const config = departmentConfig(department);
  const selectedDepartment = DEPARTMENTS.find(item => item.id === department);
  const DepartmentIcon = selectedDepartment.icon;
  const isEnabled = config.enabled;
  useEffect(() => {
    document.title = `QOS · ${translate(selectedDepartment.name)}`;
  }, [language, department]);
  function changeDepartment(next) {
    onDepartmentChange(next);
    setMenu(false);
    setMeeting(false);
    setPage("daily");
    setNotice("");
  }
  const sections = [["daily", translate("Bilan J−1"), History], ["dashboard", translate("Vue d’ensemble"), LayoutDashboard], ["curves", translate("Courbes"), ChartNoAxesCombined], ["entry", translate("Saisie de production"), ClipboardPenLine], ["history", translate("Historique des relevés"), History], ["references", translate("Presses & moules"), Factory], ["settings", translate("Configuration"), Settings2]];
  const titles = {
    daily: [translate("La veille, presse par presse."), translate("Bilan journalier de l’atelier")],
    dashboard: [translate("La performance, en perspective."), translate("Tableau de bord de l’atelier")],
    curves: [translate("Les indicateurs dans le temps."), translate("Courbes de performance")],
    entry: [translate("Chaque poste compte."), translate("Saisie de production")],
    history: [translate("La mémoire de votre atelier."), translate("Historique des relevés")],
    references: [translate("Un atelier bien référencé."), translate("Presses & moules")],
    settings: [translate("Votre espace de travail."), translate("Configuration")]
  };
  const role = "admin";
  const [activeDraft, setActiveDraft] = useState(null);
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState("daily"),
    [editing, setEditing] = useState(null),
    [notice, setNotice] = useState(""),
    [meeting, setMeeting] = useState(false),
    [menu, setMenu] = useState(false);
  const [dailyDate, setDailyDate] = useState(yesterday),
    [entryDefaults, setEntryDefaults] = useState({}),
    [returnPage, setReturnPage] = useState("history");
  useEffect(() => {
    let previous = yesterday();
    const rollover = () => {
      const next = yesterday();
      if (next !== previous) {
        setDailyDate(date => date === previous ? next : date);
        previous = next;
      }
    };
    const timer = setInterval(rollover, 60000);
    window.addEventListener("focus", rollover);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", rollover);
    };
  }, []);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    press: "all",
    shift: "all"
  });
  const [target, setTarget] = useState(() => {
    const n = Number(localStorage.getItem(targetStorageKey(department)) ?? config.trs * 100);
    return Number.isFinite(n) && n > 0 && n <= 100 ? n : config.trs * 100;
  });
  const refreshVersion = useRef(0);
  async function refresh(options = {}) {
    const version = ++refreshVersion.current;
    setBusy(true);
    try {
      const next = await loadData(department, options);
      if (version !== refreshVersion.current) return;
      setData(next);
      setError("");
      let first = '', last = '';
      for (const row of next.records) {
        if (!first || row.date < first) first = row.date;
        if (row.date > last) last = row.date;
      }
      setFilters(f => ({
        ...f,
        from: f.from || first || today(),
        to: f.to || last || today()
      }));
    } catch (e) {
      if (version === refreshVersion.current) setError(e.message);
    } finally {
      if (version === refreshVersion.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (isEnabled) refresh();
  }, [isEnabled]);
  useEffect(() => {
    if (!configured || !isEnabled || page === "entry") return;
    const sync = () => {
      if (navigator.onLine && document.visibilityState === "visible") refresh({maxAge: 30000});
    };
    const timer = setInterval(sync, 60000);
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
    };
  }, [page, isEnabled]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const key = e => {
      if (e.key === "Escape") {
        setMeeting(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  function go(p) {
    setPage(p);
    setMenu(false);
    setMeeting(false);
    if (p === "entry") {
      setActiveDraft(null);
      setEditing(null);
      setEntryDefaults({});
      setReturnPage("history");
    }
  }
  const canWrite = role === "admin" || role === "operator";
  const filtered = useMemo(() => data?.records.filter(r => (!filters.from || r.date >= filters.from) && (!filters.to || r.date <= filters.to) && (filters.press === "all" || r.press_id === filters.press) && (filters.shift === "all" || r.shift === filters.shift)) || [], [data, filters]);
  if (configError) return <div className="config-screen"><AlertCircle /><h1>{translate("Configuration à compléter")}</h1><p>{translate(configError)}</p><PwaControls shared /></div>;

  const edit = r => {
    setActiveDraft(null);
    setEditing(r);
    setReturnPage(page === "daily" ? "daily" : "history");
    setPage("entry");
    setMeeting(false);
  };
  const newDaily = defaults => {
    setActiveDraft(null);
    setEntryDefaults(defaults);
    setEditing(null);
    setReturnPage("daily");
    setPage("entry");
    setMeeting(false);
  };
  const resumeDraft = d => {
    setActiveDraft(d.key);
    setEditing(d.editing);
    setEntryDefaults(d.record);
    setPage("entry");
    setReturnPage("history");
  };
  return <div className={`app ${meeting ? "meeting" : ""}`} data-department={department}>
    {menu && <button className="menu-overlay" aria-label={translate("Fermer le menu")} onClick={() => setMenu(false)} />}
    <aside className={`sidebar ${menu ? "open" : ""}`}><a className="brand" href="#" onClick={e => {
        e.preventDefault();
        go("daily");
      }}><span className="brand-mark"><Activity size={24} /></span><span>QOS<span className="brand-dot">.</span></span></a><DepartmentSwitcher department={department} onChange={changeDepartment} /><p className="nav-label">{translate("PILOTAGE DE L’ATELIER")}</p><nav>{sections.map(([key, label, Icon]) => <button key={key} className={page === key ? "active" : ""} onClick={() => go(key)}><Icon size={19} />{translate(label)}{page === key && <span className="nav-active" />}</button>)}</nav><div className="sidebar-insight"><span className="tiny-symbol">↗</span><strong>{translate("De la mesure")}<br />{translate("à l’amélioration.")}</strong><p>{translate("Chaque relevé éclaire la performance de l’atelier.")}</p><div className="mini-bars">{[25, 42, 35, 58, 49, 70, 85, 100].map((h, i) => <span key={i} style={{
            height: h + "%"
          }} />)}</div></div><div className="sidebar-bottom"><div className="avatar">{configured ? "AT" : "QL"}</div><div><strong>{configured ? translate("Équipe atelier") : translate("Espace local")}</strong><small>{configured ? translate("Accès direct · atelier partagé") : translate("Données sur cet appareil")}</small></div></div></aside>
    <main className="main"><header className="topbar"><div className="breadcrumb"><IconButton label={translate("Ouvrir le menu")} onClick={() => setMenu(true)}><Menu size={19} /></IconButton><span>{translate("Atelier")} {translate(selectedDepartment.name)}</span><ChevronRight size={14} /><strong>{sections.find(s => s[0] === page)?.[1]}</strong></div><div className="top-actions"><LanguageSelector /><ThemeSwitcher /><span className={`connection ${configured ? "cloud" : ""}`}><Database size={14} />{configured ? data?.offline ? translate("Copie hors connexion") : data ? translate("Atelier partagé") : translate("Connexion…") : translate("Mode local")}</span><span className="top-date">{new Date().toLocaleDateString(getLocale(), {
              day: "numeric",
              month: "long",
              year: "numeric"
            })}</span><div className="avatar light">{selectedDepartment.name.slice(0, 2).toUpperCase()}</div></div></header>
      <div className="content"><div className="page-heading"><div><span className="department-identity"><DepartmentIcon size={14} />{translate(selectedDepartment.name)}</span><span className="eyebrow">{isEnabled ? titles[page][0] : translate("Espace de production vide")}</span><h1>{isEnabled ? titles[page][1] : translate(selectedDepartment.name)}<span className="heading-dot">.</span></h1></div><div className="heading-actions">{isEnabled && data && ["dashboard", "curves"].includes(page) && <ExcelExport rows={filtered} data={data} />}{isEnabled && ["daily", "dashboard", "curves"].includes(page) && <button className="btn" onClick={() => setMeeting(!meeting)}>{meeting ? <X size={17} /> : <Monitor size={17} />} {meeting ? translate("Quitter la réunion") : translate("Mode réunion")}</button>}{isEnabled && canWrite && page !== "entry" && <button className="btn primary" onClick={() => page === "daily" ? newDaily({
              date: dailyDate
            }) : go("entry")}><Plus size={18} />{translate("Nouvelle saisie")}</button>}</div></div>
      {isEnabled && !configured && <div className="local-banner"><span><span className="status-dot" />{translate(department === "injection" ? " Données du classeur · sauvegarde dans ce navigateur" : " Paramètres atelier · sauvegarde dans ce navigateur")}</span><button onClick={() => go("settings")}>{translate("Configurer le partage ")}<ChevronRight size={14} /></button></div>}
      {isEnabled && <PwaControls shared={configured} cachedAt={data?.offline ? data.cachedAt : null} />}{isEnabled && page === "entry" && <DraftList scope={departmentScope(dataScope, department)} onResume={resumeDraft} />}
      {isEnabled && error && <div className="error callout" role="alert"><AlertCircle size={19} /><span>{translate(error)}</span><button className="btn" onClick={refresh}>{translate("Réessayer")}</button></div>}
      {!isEnabled ? <EmptyDepartment department={department} onReturn={() => changeDepartment("injection")} /> : !data ? busy ? <div className="loading"><RefreshCw className="pulse" />{translate("Chargement des données…")}</div> : null : <>
      {["dashboard", "history", "curves"].includes(page) && <div className="filterbar"><div className="filter-caption"><SlidersHorizontal size={18} /><strong>{translate("Périmètre")}</strong></div><label className="date-filter"><span>{translate("Du")}</span><input aria-label={translate("Date de début")} type="date" value={filters.from} max={filters.to} onChange={e => setFilters({
                ...filters,
                from: e.target.value
              })} /></label><label className="date-filter"><span>{translate("au")}</span><input aria-label={translate("Date de fin")} type="date" value={filters.to} min={filters.from} onChange={e => setFilters({
                ...filters,
                to: e.target.value
              })} /></label><select aria-label={translate("Filtrer par presse")} value={filters.press} onChange={e => setFilters({
              ...filters,
              press: e.target.value
            })}><option value="all">{translate("Toutes les presses")}</option>{data.presses.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label={translate("Filtrer par poste")} value={filters.shift} onChange={e => setFilters({
              ...filters,
              shift: e.target.value
            })}><option value="all">{translate("Tous les postes")}</option>{SHIFTS.map(s => <option key={s} value={s}>{translate(s)}</option>)}</select><IconButton label={translate("Actualiser les données")} onClick={refresh} disabled={busy}><RefreshCw size={18} className={busy ? "pulse" : ""} /></IconButton></div>}
      <Suspense fallback={<div className="loading" role="status"><RefreshCw className="pulse" />{translate("Chargement des données…")}</div>}>
      {page === "daily" && <DailyReview data={data} date={dailyDate} onDateChange={setDailyDate} onEdit={canWrite ? edit : undefined} onNew={canWrite ? newDaily : undefined} onRefresh={refresh} busy={busy} onExport={rows => exportCSV(rows, data)} />}
      {page === "dashboard" && <Dashboard rows={filtered} data={data} target={target / 100} onNew={() => go("entry")} meeting={meeting} onEdit={canWrite ? edit : undefined} onExport={() => exportCSV(filtered, data)} />}
      {page === "curves" && <Curves rows={filtered} data={data} target={target / 100} press={filters.press} />}
      {page === "entry" && <Entry key={activeDraft || editing?.id || JSON.stringify(entryDefaults)} storageKey={activeDraft} data={data} editing={editing} defaults={entryDefaults} canWrite={canWrite} onSaved={async () => {
            await refresh();
            setNotice(translate("Relevé enregistré avec succès."));
            setEditing(null);
            setPage(returnPage);
            setFilters(f => ({
              ...f,
              from: "",
              to: ""
            }));
          }} />}
      {page === "history" && <HistoryView rows={filtered} data={data} onEdit={edit} canWrite={canWrite} target={target / 100} />}
      {page === "references" && <References data={data} canEdit={role === "admin"} refresh={refresh} notify={setNotice} />}
      {page === "settings" && <Settings data={data} target={target} setTarget={n => {
            setTarget(n);
            localStorage.setItem(targetStorageKey(department), String(n));
          }} />}
      </Suspense>
      </>}
      <footer className="footer"><span>QOS <span>/</span>{" "}{translate("Atelier")} {translate(selectedDepartment.name)}</span><span>{translate("Des données utiles. Des décisions concrètes.")}</span></footer></div>
    </main>{notice && <div className="toast" role="status"><Check size={19} />{translate(notice)}<IconButton label={translate("Fermer la notification")} onClick={() => setNotice("")}><X size={16} /></IconButton></div>}
  </div>;
}
function HistoryView({
  rows,
  data,
  onEdit,
  canWrite,
  target
}) {
  const translate = useDepartmentText();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows.length, search]);
  const matching = rows.filter(r => [data.presses.find(p => p.id === r.press_id)?.name, data.articles.find(a => a.id === r.article_id)?.name, r.notes].join(" ").toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date) || SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift));
  const max = Math.max(1, Math.ceil(matching.length / 15)),
    current = Math.min(page, max);
  return <section className="panel history-panel"><div className="panel-heading"><div><h2>{translate("Tous les relevés ")}<span className="count">{matching.length}</span></h2><p>{translate("Retrouvez et corrigez les saisies de votre atelier.")}</p></div><div className="inline-actions"><input aria-label={translate("Rechercher un relevé")} placeholder={translate("Rechercher une presse, un article…")} value={search} onChange={e => setSearch(e.target.value)} /><ExcelExport rows={matching} data={data} /><button className="btn" onClick={() => exportCSV(matching, data)} disabled={!matching.length}><Download size={17} />{translate("Exporter CSV")}</button></div></div>{!matching.length ? <Empty /> : <><div className="table-scroll"><table><thead><tr><th>{translate("Date / poste")}</th><th>{translate("Presse")}</th><th>{translate("Article")}</th><th>{translate("Planifiées")}</th><th>{translate("Conformes")}</th><th>{translate("Rebuts")}</th><th>{translate("TRS")}</th><th>{translate("DLE")}</th><th>{translate("État")}</th><th><span className="sr-only">{translate("Action")}</span></th></tr></thead><tbody>{matching.slice((current - 1) * 15, current * 15).map(r => {
              const c = calculate(r),
                a = data.articles.find(a => a.id === r.article_id);
              return <tr key={r.id}><td><strong>{dateLabel(r.date)} {r.date.slice(0, 4)}</strong><small>{translate(r.shift)}</small></td><td><span className="press-name"><Factory size={16} />{data.presses.find(p => p.id === r.press_id)?.name}</span></td><td><strong>{a?.name}</strong><small>{a?.code}</small></td><td>{num(r.planned_qty)}</td><td>{num(r.good_qty)}</td><td>{num(c.rejects)}</td><td className="numeric-emphasis">{percent(c.trs)}</td><td>{percent(c.dle)}</td><td><Badge value={c.trs} target={r.trs_target ?? target} /></td><td><button className="text-button" onClick={() => onEdit(r)}>{canWrite ? translate("Modifier") : translate("Consulter")}<ChevronRight size={14} /></button></td></tr>;
            })}</tbody></table></div><div className="pagination"><span>{matching.length}{translate(" relevés · ")}{current} / {max}</span><div><button className="btn" disabled={current === 1} onClick={() => setPage(current - 1)}>{translate("Précédent")}</button><button className="btn" disabled={current === max} onClick={() => setPage(current + 1)}>{translate("Suivant")}</button></div></div></>}</section>;
}
function Settings({
  data,
  target,
  setTarget
}) {
  const translate = useDepartmentText();
  return <div className="settings-grid"><section className="panel settings-export"><div><span className="eyebrow">{translate("Export Excel")}</span><h2>{translate("Exporter toutes les données")}</h2><p>{translate("Téléchargez un classeur Excel contenant la synthèse et tous les relevés de cet atelier.")}</p></div><ExcelExport rows={data.records} data={data} className="btn primary" /></section><section className="panel settings-card"><Database className="section-icon" /><h2>{translate("Sauvegarde & connexion")}</h2><span className="badge success">{configured ? translate("Base Supabase") : translate("Sauvegarde locale")}</span><p>{configured ? translate("Les relevés sont partagés entre les appareils, sans compte. Toute personne disposant du lien peut consulter et modifier l’atelier.") : translate("Les modifications sont conservées uniquement dans ce navigateur. Exportez une sauvegarde avant de changer d’appareil ou de vider les données du navigateur.")}</p><button className="btn primary" onClick={() => download("QOS-" + (data.department || "injection") + "-sauvegarde-" + today() + ".json", JSON.stringify({
        version: 1,
        exported_at: new Date().toISOString(),
        ...data
      }, null, 2))}><Download size={17} />{translate("Sauvegarder toutes les données")}</button><h3>{translate("Connexion à Supabase")}</h3><ol><li>{translate("Exécuter ")}<code>supabase/01_schema.sql</code>.</li><li>{translate("Importer le classeur avec ")}<code>02_import_excel.sql</code>.</li><li>{translate("Ajouter le journal avec ")}<code>03_stop_journal.sql</code>.</li><li>{translate("Renforcer les horaires avec ")}<code>04_daily_review.sql</code>.</li><li>{translate("Activer la quantité planifiée et l’accès direct avec ")}<code>05_planning_public_access.sql</code>.</li><li>{translate("Ajouter les causes de pertes avec ")}<code>06_loss_categories.sql</code>.</li><li>{translate("Activer les départements avec ")}<code>07_departments.sql</code>.</li><li>{translate("Renseigner les deux valeurs du fichier ")}<code>.env</code>{translate(" et relancer l’application.")}</li></ol><small>{translate("Le guide README détaille la mise en ligne. Les nouvelles saisies locales ne sont pas transférées automatiquement vers Supabase.")}</small></section><div><TargetSettings data={data} target={target} setTarget={setTarget} /><section className="panel settings-card formula-card"><FileSpreadsheet className="section-icon" /><h2>{translate("Une méthode transparente")}</h2><p>{translate("Les calculs par relevé reprennent le classeur. La synthèse utilise les temps et quantités cumulés.")}</p><dl><dt>{translate("Disponibilité")}</dt><dd>{translate("Temps machine ÷ temps requis")}</dd><dt>{translate("Performance")}</dt><dd>{translate("Quantité totale × cycle ÷ temps machine en secondes")}</dd><dt>{translate("Qualité")}</dt><dd>{translate("Quantité conforme ÷ quantité totale")}</dd><dt>{translate("TRS atelier")}</dt><dd>{translate("Σ (conformes × cycle) ÷ Σ temps requis en secondes")}</dd><dt>{translate("DLE")}</dt><dd>{translate("Recette en heures ÷ heures dépensées")}</dd></dl><small>{translate("Les périodes sans temps requis sont non calculables. Les ratios dépassant 100 % sont conservés et signalés. Avec des cycles différents, le produit des trois taux agrégés peut différer du TRS global.")}</small></section></div></div>;
}

function TargetSettings({data, target, setTarget}) {
  const translate = useDepartmentText();
  const config = departmentConfig(data.department);
  if (data.department !== 'injection') return <section className="panel settings-card"><Settings2 className="section-icon" /><h2>{translate("Objectifs TRS / DLE")}</h2><p>{translate("Les objectifs se configurent par article dans Équipements & articles. Les relevés conservent leurs objectifs historiques.")}</p><p>{translate("Objectifs initiaux")} : <strong>{percent(config.trs)} / {percent(config.dle)}</strong></p></section>;
  return <section className="panel settings-card"><Settings2 className="section-icon" /><h2>{translate("Objectif TRS")}</h2><p>{translate("Seuil d’analyse pour les graphiques et les états.")}</p><label className="target-input">{translate("Objectif (%)")}<input type="number" min="1" max="100" step="1" value={target} onChange={event => {const value=Number(event.target.value);if(value>=1&&value<=100)setTarget(value);}} /></label></section>;
}
