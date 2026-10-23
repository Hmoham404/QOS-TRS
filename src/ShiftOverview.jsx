import { t as translate } from "./i18n.js";
import React, { useId, useState } from "react";
import { Activity, Timer, ArrowUpRight, ChartNoAxesCombined, Clock3, CalendarClock, ChevronRight } from "lucide-react";
import { calculate, formatNumber as num } from "./domain";
import { STOP_TYPES } from "./analytics";
export default function ShiftOverview({
  record,
  onEdit
}) {
  const id = useId().replaceAll(":", ""),
    [active, setActive] = useState(null);
  if (!record) return <div className="overview-no-data"><ChartNoAxesCombined size={32} /><h3>{translate("Aucun relevé sur cette période")}</h3><p>{translate("Choisissez une autre période pour afficher votre production.")}</p></div>;
  const c = calculate(record),
    opening = Number(record.opening_min),
    share = opening > 0 ? c.runtime / opening * 100 : 0;
  const breakdown = [{
    key: "running",
    label: translate("Temps de marche"),
    minutes: c.runtime,
    color: "#0dbb93"
  }, ...Object.entries(STOP_TYPES).map(([key, t]) => ({
    key,
    label: t.label,
    minutes: Number(record[t.field]) || 0,
    color: t.color
  }))];
  let cumulative = 0;
  const slices = breakdown.filter(d => d.minutes > 0).map(d => {
    const start = cumulative;
    cumulative += d.minutes;
    return {
      ...d,
      start,
      end: cumulative
    };
  });
  const selected = breakdown.find(d => d.key === active);
  const radius = 65,
    length = 2 * Math.PI * radius;
  return <div className="shift-overview" data-testid="shift-overview"><div className="overview-grid">
  <div className="overview-ring-panel"><span className="overview-eyebrow"><Activity size={14} />{translate("BILAN DU RELEVÉ")}</span><div className="overview-ring"><svg viewBox="0 0 170 170" role="img" aria-label={translate("{0} pour cent du temps d’ouverture en marche", [num(share, 1)])}><defs><linearGradient id={"ring-" + id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#2c86ff" /><stop offset="100%" stopColor="#13d59c" /></linearGradient></defs><circle cx="85" cy="85" r={radius} fill="none" stroke="#174762" strokeWidth="10" /><circle cx="85" cy="85" r={radius} fill="none" stroke={`url(#ring-${id})`} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${length * share / 100} ${length}`} transform="rotate(-90 85 85)" /></svg><div><strong>{num(share, 1)}<small>%</small></strong><span>{translate("du temps d’ouverture")}</span></div></div><div className="overview-ring-caption"><span className="ring-status-dot" />{translate("Temps machine en marche")}</div><div className="overview-duration"><Clock3 size={15} /><span>{translate("Durée du relevé")}</span><strong>{num(opening / 60, 1)}{translate(" h")}</strong></div></div>
  <div className="overview-detail"><div className="overview-detail-head"><div><span className="overview-eyebrow">{translate("UNE VUE DISPONIBLE IMMÉDIATEMENT")}</span><h3>{translate("Chaque minute a sa place.")}</h3></div><span className="overview-data-chip"><ChartNoAxesCombined size={14} />{translate("Données du relevé")}</span></div>
  <div className="overview-numbers"><div className="overview-stat useful"><span><Activity size={17} />{translate("Marche")}</span><strong>{num(c.runtime, 1)}<small>{translate("min")}</small></strong><span className="overview-stat-note">{translate("Temps utile déclaré")}</span></div><div className="overview-stat stops"><span><Timer size={17} />{translate("Arrêts cumulés")}</span><strong>{num(opening - c.runtime, 1)}<small>{translate("min")}</small></strong><span className="overview-stat-note">{translate("Toutes catégories incluses")}</span></div><div className="overview-stat production"><span><ChartNoAxesCombined size={17} />{translate("Production")}</span><strong>{num(record.good_qty)}<small>{translate("pcs")}</small></strong><span className="overview-stat-note">{translate("Pièces conformes")}</span></div></div>
  <div className="overview-bar-title"><strong>{translate("Répartition du temps d’ouverture")}</strong><span>{num(opening)}{translate(" min")}</span></div><div className="overview-stacked-bar" role="group" aria-label={translate("Répartition des durées, sans ordre chronologique")}>{slices.map(s => <button key={s.key} type="button" style={{
            width: s.minutes / opening * 100 + "%",
            background: s.key === "running" ? "linear-gradient(90deg,#2477e6,#0eb68e)" : s.color
          }} onMouseEnter={() => setActive(s.key)} onFocus={() => setActive(s.key)} onClick={() => setActive(s.key)} aria-label={`${s.label} : ${num(s.minutes, 1)} minutes`}>{s.minutes / opening > .15 && <span>{num(s.minutes)}{translate(" min")}</span>}</button>)}</div><div className="overview-bar-scale"><span>{translate("0 min")}</span><span>{translate("Durées cumulées · aucun horaire déduit")}</span><span>{num(opening)}{translate(" min")}</span></div>
  <div className="overview-breakdown">{breakdown.filter(d => d.minutes > 0).map(d => <button type="button" key={d.key} className={active === d.key ? "selected" : ""} onClick={() => setActive(d.key)}><i style={{
              background: d.color
            }} /><span>{translate(d.label)}</span><strong>{num(d.minutes, 1)}{translate(" min")}</strong></button>)}</div><div className="overview-selection" aria-live="polite">{selected ? <><span style={{
              background: selected.color
            }} /><strong>{translate(selected.label)}</strong> : {num(selected.minutes, 1)}{translate(" min · ")}{num(selected.minutes / opening * 100, 1)}{translate(" % du relevé")}</> : <>{translate("Sélectionnez une catégorie pour voir sa part du temps total.")}</>}</div>
  </div></div><div className="overview-action"><div className="overview-action-icon"><CalendarClock size={22} /></div><div><strong>{translate("Envie de voir les arrêts sur une courbe horaire ?")}</strong><p>{translate("Renseignez leurs débuts et fins. La chronologie détaillée remplacera automatiquement ce bilan.")}</p></div>{onEdit && <button type="button" className="vision-cta" onClick={() => onEdit(record)}>{translate("Renseigner les horaires")}<ChevronRight size={17} /></button>}</div></div>;
}
