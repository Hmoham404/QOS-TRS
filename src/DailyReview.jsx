import ExcelExport from "./ExcelExport.jsx";
import { t as translate } from "./i18n.js";
import React, { useEffect, useId, useRef, useState } from "react";
import { Activity, CalendarDays, ChevronLeft, ChevronRight, Clock3, Factory, FilePenLine, Info, RefreshCw, Pause, Layers3, ArrowDownToLine } from "lucide-react";
import { aggregate, calculate, dateLabel, formatNumber as num, percent, SHIFTS, today } from "./domain";
import { dailyPresses, dailyStops, dailyTimeline, shiftDate, yesterday } from "./daily";
import { clockLabel, STOP_TYPES } from "./analytics";
const duration = minutes => `${num(minutes / 60, 2)} ${translate('h')}`;
const statusText = {
  get worked() {
    return translate("A travaillé");
  },
  get stopped() {
    return translate("Arrêt déclaré");
  },
  get missing() {
    return translate("Non renseignée");
  }
};
function PressTimeline({
  press
}) {
  const uid = useId().replaceAll(":", ""),
    [selected, setSelected] = useState(null),
    scroll = useRef(null);
  const {
    journals,
    gaps,
    end
  } = dailyTimeline(press.records);
  const firstStart = journals[0]?.start;
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const focusKnownHours = () => {
      element.scrollLeft = Math.max(0, (firstStart || 0) / end * element.scrollWidth - 60);
    };
    const observer = new ResizeObserver(focusKnownHours);
    observer.observe(element);
    focusKnownHours();
    return () => observer.disconnect();
  }, [firstStart, end]);
  const left = 70,
    right = 1050,
    x = m => left + m / end * (right - left);
  const ticks = Array.from({
    length: Math.floor(end / 180) + 1
  }, (_, i) => i * 180);
  if (ticks.at(-1) !== end) ticks.push(end);
  if (press.conflicts) return <div className="daily-missing-chart"><Info size={22} /><div><strong>{translate("Horaires qui se chevauchent")}</strong><p>{translate("Corrigez les journaux de cette presse avant de lire sa chronologie. Les totaux restent ceux des relevés.")}</p></div></div>;
  if (!journals.length) return <div className="daily-missing-chart"><Clock3 size={24} /><div><strong>{duration(press.totals.runtime)}{translate(" de marche déclarée · horaires à compléter")}</strong><p>{translate("Les totaux Excel sont disponibles. Renseignez les débuts et fins des pauses pour tracer leurs positions réelles.")}</p></div><span className="daily-mini-wave" aria-hidden="true">──── ┄┄ ────</span></div>;
  return <><div ref={scroll} className="daily-curve-scroll" tabIndex={0} aria-label={translate("Chronologie défilante de la presse")}><svg className="daily-curve" viewBox="0 0 1090 196" role="img" aria-label={translate("Courbe marche et arrêt de {0}", [press.name])}>
    <defs><pattern id={"unknown-" + uid} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="#cbd9e5" strokeWidth="2" /></pattern></defs>
    <text x="0" y="63" fill="#078d79" fontSize="11">{translate("MARCHE")}</text><text x="0" y="134" fill="#a47879" fontSize="11">{translate("ARRÊT")}</text>
    {gaps.map((g, i) => <rect key={i} x={x(g.start)} y="35" width={x(g.end) - x(g.start)} height="105" fill={`url(#unknown-${uid})`} opacity=".45" />)}
    {ticks.map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1="32" y2="147" stroke="#dfe9f0" strokeDasharray="3 5" /><text x={x(t)} y="176" textAnchor={t === 0 ? "start" : t === end ? "end" : "middle"} fontSize="11" fill="#617e93">{clockLabel("00:00", t)}</text></g>)}
    {journals.map(j => {
          const d = j.segments.map((s, i) => `${i ? "L" : "M"} ${x(s.start)} ${s.state ? 58 : 130} L ${x(s.end)} ${s.state ? 58 : 130}`).join(" ");
          return <g key={j.record.id}><text x={x(j.start) + 3} y="21" fontSize="10" fill="#58768e">{translate(j.record.shift)}</text><path d={`${d} L ${x(j.end)} 145 L ${x(j.start)} 145 Z`} fill="#0cb794" opacity=".08" /><path d={d} fill="none" stroke="#069f86" strokeWidth="3" />{j.segments.filter(s => !s.state).map((s, i) => <g key={i} tabIndex={0} role="button" aria-label={`${s.label}, ${num(s.end - s.start, 1)} minutes, ${clockLabel("00:00", s.start)}`} onMouseEnter={() => setSelected(s)} onFocus={() => setSelected(s)} onClick={() => setSelected(s)} onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(s);
              }
            }}><rect x={x(s.start)} y="36" width={Math.max(4, x(s.end) - x(s.start))} height="109" fill={STOP_TYPES[s.category].color} opacity=".18" /><line x1={x(s.start)} x2={x(s.end)} y1="130" y2="130" stroke={STOP_TYPES[s.category].color} strokeWidth="5" /><title>{translate(s.label)} · {num(s.end - s.start, 1)}{translate(" min")}</title></g>)}</g>;
        })}
  </svg></div><div className="daily-curve-legend"><span><i className="run" />{translate("Marche déclarée")}</span><span><i className="stop" />{translate("Arrêt / pause")}</span><span><i className="unknown" />{translate("Horaire non renseigné")}</span><strong aria-live="polite">{selected ? `${selected.label} · ${clockLabel("00:00", selected.start)} → ${clockLabel("00:00", selected.end)} · ${num(selected.end - selected.start, 1)} min` : translate("Sélectionnez un creux pour voir la cause.")}</strong></div></>;
}
function PressCard({
  press,
  data,
  onEdit,
  onNew,
  date,
  shift
}) {
  const [showStops, setShowStops] = useState(false);
  const stops = dailyStops(press.records);
  return <article className="daily-press-card" id={"press-" + press.id} aria-label={translate("Analyse ") + press.name}>
    <div className="daily-press-head"><div className="daily-press-title"><span className="daily-machine-icon"><Factory size={25} /></span><div><span className="eyebrow">{translate("CHRONOLOGIE DE LA PRESSE")}</span><h3>{press.name} <span className={"daily-status " + press.status}>{statusText[press.status]}</span></h3></div></div><div className="daily-press-numbers"><span>{translate("Marche")}<strong>{duration(press.totals.runtime)}</strong></span><span>{translate("Arrêts")}<strong>{num(press.stopped, 1)} <small>{translate("min")}</small></strong></span><span>{translate("Conformes")}<strong>{num(press.totals.good)} <small>{translate("pcs")}</small></strong></span><span>{translate("TRS")}<strong>{percent(press.totals.trs)}</strong></span></div></div>
    <div className="daily-shift-strip">{press.shifts.map(s => <div key={s.name} className={!s.records.length ? "missing" : s.runtime ? "worked" : "stopped"}><span>{translate(s.name)}</span><strong>{s.records.length ? duration(s.runtime) + translate(" de marche") : translate("Aucun relevé")}</strong><small>{s.records.length ? translate("{0} pièces · {1} relevé{2}", [num(s.good), s.records.length, s.records.length > 1 ? "s" : ""]) : translate("Production non déclarée")}</small>{!s.records.length && onNew && <button className="text-button" onClick={() => onNew({
          date,
          shift: s.name,
          press_id: press.id
        })}>{translate("Saisir ce poste ")}<ChevronRight size={13} /></button>}</div>)}</div>
    <PressTimeline press={press} />
    <div className="daily-record-links">{press.records.map(r => <button type="button" key={r.id} className={"daily-record-link " + (r.timeline_complete ? "complete" : "")} disabled={!onEdit} onClick={() => onEdit?.(r)}><FilePenLine size={15} /><span>{translate(r.shift)} · {data.articles.find(a => a.id === r.article_id)?.name || translate("Article")}</span><strong>{r.timeline_complete ? translate("Modifier le journal") : translate("Renseigner les horaires")}</strong><ChevronRight size={14} /></button>)}</div>
    <button type="button" className="daily-stops-toggle" aria-expanded={showStops} onClick={() => setShowStops(v => !v)}><span><Pause size={17} />{translate("Pauses & causes d’arrêt ")}<b>{stops.length}</b></span><span>{showStops ? translate("Masquer") : translate("Voir la liste")}<ChevronRight size={16} style={{
          transform: showStops ? "rotate(90deg)" : undefined
        }} /></span></button>
    {showStops && <div className="daily-stop-list">{!stops.length ? <p>{press.complete.length === press.records.length ? translate("Aucun arrêt déclaré dans les journaux.") : translate("Aucune durée d’arrêt déclarée. Horaires incomplets.")}</p> : stops.map(s => <div className="daily-stop" key={s.key}><span className="daily-stop-dot" style={{
          background: STOP_TYPES[s.category].color
        }} /><div><strong>{translate(s.label)}</strong><small>{translate(s.record.shift)} · {translate(STOP_TYPES[s.category].label)}{!s.timed ? translate(" · total de catégorie") : ""}</small></div><span>{s.timed ? `${clockLabel(s.record.shift_start, s.start_min)} → ${clockLabel(s.record.shift_start, s.end_min)}` : translate("Horaires inconnus")}</span><b>{num(s.minutes, 1)}{translate(" min")}</b>{onEdit && <button type="button" className="text-button" onClick={() => onEdit(s.record)} aria-label={`Modifier ${s.label} ${s.record.shift}`}>{translate("Modifier")}</button>}</div>)}</div>}
  </article>;
}
export default function DailyReview({
  data,
  date,
  onDateChange,
  onEdit,
  onNew,
  onRefresh,
  busy,
  onExport
}) {
  const [press, setPress] = useState("all"),
    [shift, setShift] = useState("all");
  const presses = dailyPresses(data, date, {
    press,
    shift
  });
  const rows = presses.flatMap(p => p.records),
    totals = aggregate(rows);
  const reported = presses.filter(p => p.records.length),
    worked = presses.filter(p => p.status === "worked");
  const workedShifts = SHIFTS.filter(s => rows.some(r => r.shift === s && calculate(r).runtime > 0));
  const detailed = rows.filter(r => r.timeline_complete).length;
  const latest = data.records.map(r => r.date).sort().at(-1);
  return <div className="daily-review">
    <section className="daily-toolbar" aria-label={translate("Filtres du bilan journalier")}><div className="daily-date-control"><CalendarDays size={22} /><button type="button" aria-label={translate("Jour précédent")} className="icon-button" onClick={() => onDateChange(shiftDate(date, -1))}><ChevronLeft size={17} /></button><label><span>{translate("Date analysée")}</span><input type="date" aria-label={translate("Date du bilan journalier")} required value={date} onChange={e => {
            if (e.target.value) onDateChange(e.target.value);
          }} /></label><button type="button" aria-label={translate("Jour suivant")} className="icon-button" onClick={() => onDateChange(shiftDate(date, 1))}><ChevronRight size={17} /></button><button className={"daily-yesterday " + (date === yesterday() ? "selected" : "")} onClick={() => onDateChange(yesterday())}>{translate("J−1")}</button></div><div className="daily-filters"><select aria-label={translate("Presse du bilan journalier")} value={press} onChange={e => setPress(e.target.value)}><option value="all">{translate("Toutes les presses")}</option>{data.presses.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label={translate("Poste du bilan journalier")} value={shift} onChange={e => setShift(e.target.value)}><option value="all">{translate("Tous les postes")}</option>{SHIFTS.map(s => <option key={s} value={s}>{translate(s)}</option>)}</select><button className="icon-button" aria-label={translate("Actualiser le bilan")} disabled={busy} onClick={onRefresh}><RefreshCw size={18} className={busy ? "pulse" : ""} /></button></div></section>
    <section className="daily-hero"><div><span className="eyebrow">{date === yesterday() ? translate("J−1 / LA VEILLE EN UN REGARD") : translate("BILAN JOURNALIER / ATELIER INJECTION")}</span><h2>{dateLabel(date)} <span>{date.slice(0, 4)}</span></h2><p>{worked.length ? translate("{0} presse{1} travaillé. {2} poste{3} avec de la marche déclarée.", [worked.length, worked.length > 1 ? "s ont" : " a", workedShifts.length, workedShifts.length > 1 ? "s" : ""]) : rows.length ? translate("Aucune marche déclarée pour ce périmètre.") : translate("Les relevés de cette journée restent à renseigner.")}</p><div className="daily-hero-posts">{SHIFTS.map(s => <span key={s} className={workedShifts.includes(s) ? "worked" : ""}><i />{translate(s)}</span>)}</div></div><div className="daily-hero-value"><Activity size={24} /><span>{translate("TEMPS MACHINE CUMULÉ")}</span><strong>{rows.length ? num(totals.runtime / 60, 2) : "—"}<small>{translate("h")}</small></strong><p>{reported.length} / {presses.length}{translate(" presses renseignées · ")}{rows.length}{translate(" relevés")}</p></div></section>
    <div className="daily-kpis"><div><Factory /><span>{translate("Presses ayant travaillé")}<strong>{worked.length}<small> / {presses.length}</small></strong></span></div><div><Pause /><span>{translate("Arrêts, pauses incluses")}<strong>{rows.length ? num(totals.planned + totals.unplanned, 1) : "—"}<small>{translate(" min")}</small></strong></span></div><div><Layers3 /><span>{translate("Pièces conformes")}<strong>{rows.length ? num(totals.good) : "—"}<small>{translate(" pcs")}</small></strong></span></div><div><Clock3 /><span>{translate("Journaux horaires")}<strong>{detailed}<small> / {rows.length}</small></strong></span></div></div>
    <div className="daily-date-note"><Info size={16} /><span>{translate("La date est celle du début du poste. Une nuit commencée le ")}{dateLabel(date)}{translate(" reste dans ce bilan après minuit. Les heures sont celles de l’atelier, saisies dans le journal.")}</span></div>
    <section className="panel daily-fleet"><div className="panel-heading"><div><span className="eyebrow">{translate("QUI A TRAVAILLÉ, ET COMBIEN ?")}</span><h2>{translate("Les presses, poste par poste.")}</h2></div><div className="inline-actions"><ExcelExport rows={rows} data={data} /><button className="btn" disabled={!rows.length} onClick={() => onExport(rows)}><ArrowDownToLine size={16} />{translate("Exporter")}</button></div></div><div className="table-scroll"><table><thead><tr><th>{translate("Presse")}</th>{SHIFTS.filter(s => shift === "all" || s === shift).map(s => <th key={s}>{translate(s)}</th>)}<th>{translate("Total marche")}</th><th>{translate("Situation")}</th></tr></thead><tbody>{presses.map(p => <tr key={p.id}><td><strong>{p.records.length ? <a href={"#press-" + p.id}>{p.name}</a> : p.name}</strong>{!p.active && <small>{translate("Archivée")}</small>}</td>{p.shifts.map(s => <td key={s.name}><span className={"daily-cell " + (!s.records.length ? "missing" : s.runtime ? "worked" : "stopped")}>{!s.records.length ? translate("Non renseigné") : duration(s.runtime)}</span></td>)}<td><strong>{p.records.length ? duration(p.totals.runtime) : "—"}</strong></td><td><span className={"daily-status " + p.status}>{statusText[p.status]}</span></td></tr>)}</tbody></table></div></section>
    <div className="section-divider"><div><span className="section-kicker">{translate("LES ARRÊTS DANS LE TEMPS")}</span><h2>{translate("Une presse. Une chronologie.")}</h2></div><span className="table-subtitle">{reported.length}{translate(" presses avec relevés")}</span></div>
    {!reported.length && <div className="panel daily-empty"><CalendarDays size={32} /><h3>{translate("Aucun relevé pour le ")}{dateLabel(date)} {date.slice(0, 4)}</h3><p>{translate("La date sélectionnée reste inchangée, même si la veille n’a pas de données.")}</p><div>{onNew && <button className="btn primary" onClick={() => onNew({
          date,
          ...(press !== "all" ? {
            press_id: press
          } : {}),
          shift: shift === "all" ? "Matin" : shift
        })}>{translate("Saisir cette journée")}</button>}{latest && latest !== date && <button className="btn" onClick={() => onDateChange(latest)}>{translate("Dernière journée renseignée · ")}{dateLabel(latest)}</button>}</div></div>}
    {reported.map(p => <PressCard key={date + ":" + shift + ":" + p.id} press={p} data={data} date={date} shift={shift} onEdit={onEdit} onNew={onNew} />)}
  </div>;
}
