import ChartPointValue from "./ChartPointValue";
import { UNPLANNED_TYPES } from "./losses.js";
import { t as translate } from "./i18n.js";
import React, { useState } from "react";
import { Activity, Clock3, Gauge, ShieldCheck, ArrowUpRight, Factory, Download, AlertTriangle, Target, Layers3, BarChart3, ChevronRight } from "lucide-react";
import { LabelList, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, BarChart, Bar, Cell, Legend } from "recharts";
import { aggregate, calculate, percent, formatNumber as num, dateLabel, SHIFTS } from "./domain";
import { Empty, Badge } from "./App";
import { motion } from "motion/react";
import AnalyticsPanels from "./AnalyticsPanels";
const series = {
  trs: {
    get label() {
      return translate("TRS");
    },
    color: "#0e9b82"
  },
  availability: {
    get label() {
      return translate("Disponibilité");
    },
    color: "#487ac3"
  },
  performance: {
    get label() {
      return translate("Performance");
    },
    color: "#c08b39"
  },
  quality: {
    get label() {
      return translate("Qualité");
    },
    color: "#7163c3"
  },
  dle: {
    get label() {
      return translate("DLE");
    },
    color: "#2b7f91"
  }
};
function Tip({
  active,
  payload,
  label
}) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{translate(label)}</strong>{payload.filter(p => p.value != null).map(p => <div key={p.dataKey}><span style={{
        color: p.color
      }}>● {p.name}</span><b>{num(p.value, 1)} %</b></div>)}</div>;
}
export default function Dashboard({
  rows,
  data,
  target,
  onNew,
  onExport,
  onEdit
}) {
  const [metric, setMetric] = useState("trs");
  const s = aggregate(rows);
  const days = [...new Set(rows.map(r => r.date))].sort().map(date => {
    const a = aggregate(rows.filter(r => r.date === date));
    return {
      date: dateLabel(date),
      ...Object.fromEntries(Object.keys(series).map(k => [k, a[k] == null ? null : a[k] * 100]))
    };
  });
  const presses = data.presses.map(p => ({
    ...p,
    rows: rows.filter(r => r.press_id === p.id)
  })).filter(p => p.rows.length).map(p => ({
    ...p,
    ...aggregate(p.rows)
  })).sort((a, b) => (b.trs ?? -1) - (a.trs ?? -1));
  const shifts = SHIFTS.map(shift => {
    const a = aggregate(rows.filter(r => r.shift === shift));
    return {
      name: translate(shift),
      TRS: a.trs == null ? null : a.trs * 100,
      DLE: a.dle == null ? null : a.dle * 100
    };
  });
  const warnings = rows.filter(r => (calculate(r).performance ?? 0) > 1);
  const downtime = UNPLANNED_TYPES.map(([key, type]) => ({name: type.label, value: s[key], color: type.color})).filter(item => item.value > 0).sort((a,b) => b.value - a.value);
  const totalStops = downtime.reduce((a, b) => a + b.value, 0);
  const cards = [["availability", translate("Disponibilité"), translate("Du temps requis"), Clock3], ["performance", translate("Performance"), translate("À la cadence théorique"), Gauge], ["quality", translate("Qualité"), translate("Pièces conformes"), ShieldCheck]];
  return <>
    <motion.div className="kpi-grid" initial={{opacity:0}} animate={{opacity:1}}><section className="kpi hero-kpi"><div className="kpi-label"><span><Activity size={18} />{translate("TRS GLOBAL")}</span><span className="tiny-chip">{translate("ATELIER")}</span></div><div className="hero-number">{s.trs == null ? "—" : num(s.trs * 100, 1)}<span>{s.trs == null ? "" : "%"}</span></div><div className="hero-bottom"><span><Target size={15} />{translate("Objectif ")}{num(target * 100)} %</span><span>{s.trs == null ? translate("Sans production") : `${s.trs >= target ? "+" : ""}${num((s.trs - target) * 100, 1)} pts`}</span></div><div className="kpi-track"><span style={{
            width: Math.max(0, Math.min((s.trs || 0) * 100, 100)) + "%"
          }} /></div><span className="orb orb-one" /><span className="orb orb-two" /></section>{cards.map(([key, label, sub, Icon]) => <section className={`kpi metric-${key}`} key={key}><div className="kpi-label"><span>{translate(label)}</span><span className="metric-icon"><Icon size={20} /></span></div><div className="kpi-number">{s[key] == null ? "—" : num(s[key] * 100, 1)}<span>{s[key] == null ? "" : "%"}</span></div><div className="kpi-detail"><span className="metric-dot" />{sub}</div><div className="kpi-track"><span style={{
            width: Math.min((s[key] || 0) * 100, 100) + "%"
          }} /></div></section>)}</motion.div>
    <div className="production-strip"><div><span className="strip-icon"><Layers3 size={19} /></span><span>{translate("Pièces conformes")}<strong>{num(s.good)} <small>{translate("pcs")}</small></strong></span></div><div><span>{translate("Rebuts")}<strong>{num(s.rejects)} <small>{translate("pcs")}</small></strong></span></div><div><span>{translate("Temps machine")}<strong>{num(s.runtime / 60, 1)} <small>{translate("h")}</small></strong></span></div><div><span>{translate("Rendement main-d’œuvre")}<strong>{percent(s.dle)} <small>{translate("DLE")}</small></strong></span></div><div className="strip-records"><span>{rows.length}{translate(" relevés")}<span className="strip-sub">{presses.length}{translate(" presses renseignées / ")}{data.presses.length}</span></span></div></div>
    <AnalyticsPanels rows={rows} data={data} onEdit={onEdit} />
    <div className="section-divider historical-divider"><div><span className="section-kicker">{translate("PRENDRE DU RECUL")}</span><h2>{translate("Les tendances de l’atelier.")}</h2></div><span className="table-subtitle">{translate("Synthèse de la période")}</span></div>
    {!rows.length ? <section className="panel"><Empty><button className="btn primary" onClick={onNew}>{translate("Saisir la production")}</button></Empty></section> : <>
    <div className="chart-grid"><section className="panel trend-panel"><div className="panel-heading"><div><span className="eyebrow">{translate("ÉVOLUTION DE L’ATELIER")}</span><h2>{translate("La performance au fil des jours")}</h2></div><select aria-label={translate("Indicateur du graphique")} value={metric} onChange={e => setMetric(e.target.value)}>{Object.entries(series).map(([k, v]) => <option key={k} value={k}>{translate(v.label)}</option>)}</select></div><div className="chart-legend"><span><i style={{
                background: series[metric].color
              }} />{translate(series[metric].label)}</span>{metric === "trs" && <span><i className="dashed" />{translate("Objectif ")}{num(target * 100)} %</span>}<span className="chart-unit">{translate("en %")}</span></div><div className="trend-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={days} margin={{
                top: 34,
                right: 30,
                bottom: 0,
                left: -15
              }}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={series[metric].color} stopOpacity={.2} /><stop offset="100%" stopColor={series[metric].color} stopOpacity={.01} /></linearGradient></defs><CartesianGrid stroke="#edf0f2" vertical={false} strokeDasharray="3 4" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{
                  fill: "#839098",
                  fontSize: 12
                }} dy={10} /><YAxis domain={[0, "auto"]} tickFormatter={v => v + " %"} axisLine={false} tickLine={false} tick={{
                  fill: "#839098",
                  fontSize: 12
                }} /><Tooltip content={<Tip />} />{metric === "trs" && <ReferenceLine y={target * 100} stroke="#b7aa8b" strokeDasharray="5 5" />}<Area isAnimationActive={false} type="monotone" dataKey={metric} name={series[metric].label} stroke={series[metric].color} strokeWidth={3} fill="url(#trendFill)" dot={{
                  r: 4,
                  fill: "white",
                  strokeWidth: 2
                }} activeDot={{
                  r: 6
                }} connectNulls={false}><LabelList dataKey={metric} content={<ChartPointValue count={days.length} color={series[metric].color} />} /></Area></AreaChart></ResponsiveContainer></div><div className="chart-footnote"><span>{translate("Calcul pondéré sur les relevés de la période.")}</span><span>{days.length}{translate(" jours renseignés")}</span></div></section>
    <section className="panel stop-panel"><div className="panel-heading"><div><span className="eyebrow">{translate("LES LEVIERS D’ACTION")}</span><h2>{translate("Répartition des arrêts")}</h2></div><Clock3 size={19} color="#87969d" /></div><div className="stop-total">{num(totalStops)}<span>{translate("min")}</span></div><p className="muted">{translate("d’arrêts hors arrêts planifiés")}</p><div className="stacked-bar">{downtime.map(d => <div key={d.name} style={{
              width: totalStops ? d.value / totalStops * 100 + "%" : "0",
              background: d.color
            }} />)}</div><div className="stop-list">{downtime.map(d => <div key={d.name}><span><i style={{
                  background: d.color
                }} />{d.name}</span><strong>{num(d.value)} <small>{translate("min")}</small></strong></div>)}</div><div className="planned-note"><Clock3 size={15} /><span>{translate("Arrêts planifiés")}</span><strong>{num(s.planned)}{translate(" min")}</strong></div></section></div>
    <div className="bottom-grid"><section className="panel press-panel"><div className="panel-heading"><div><span className="eyebrow">{translate("VUE PAR ÉQUIPEMENT")}</span><h2>{translate("Performance des presses ")}<span className="count">{presses.length}</span></h2></div><button className="text-button" onClick={onExport}><Download size={15} />{translate("Exporter")}</button></div><div className="table-scroll"><table><thead><tr><th>{translate("Presse")}</th><th>{translate("Production conforme")}</th><th>{translate("TRS")}</th><th>{translate("Situation")}</th></tr></thead><tbody>{presses.map(p => <tr key={p.id}><td><span className="press-name"><span className="machine-icon"><Factory size={19} /></span><strong>{p.name}</strong></span></td><td>{num(p.good)} <span className="muted">{translate("pcs")}</span></td><td><div className="trs-cell"><strong>{percent(p.trs)}</strong><div className="row-track"><span style={{
                          width: Math.min((p.trs || 0) * 100, 100) + "%",
                          background: p.trs >= target ? "#159b81" : "#dda14e"
                        }} /></div></div></td><td><Badge value={p.trs} target={target} /></td></tr>)}</tbody></table></div><div className="table-note">{translate("Les presses sans relevé dans le périmètre ne sont pas classées.")}</div></section><section className="panel shift-panel"><div className="panel-heading"><div><span className="eyebrow">{translate("RYTHME DE PRODUCTION")}</span><h2>{translate("Comparaison des postes")}</h2></div><BarChart3 size={19} color="#87969d" /></div><div className="shift-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={shifts} barGap={5} margin={{
                left: -18,
                right: 6,
                top: 10,
                bottom: 0
              }}><CartesianGrid vertical={false} strokeDasharray="3 4" stroke="#edf0f2" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{
                  fontSize: 12,
                  fill: "#7a8b94"
                }} /><YAxis axisLine={false} tickLine={false} tick={{
                  fontSize: 12,
                  fill: "#7a8b94"
                }} tickFormatter={v => v + "%"} /><Tooltip content={<Tip />} /><Bar isAnimationActive={false} dataKey="TRS" fill="#138e7c" radius={[5, 5, 0, 0]} maxBarSize={30} name={translate("TRS")} /><Bar isAnimationActive={false} dataKey="DLE" fill="#a9d9cd" radius={[5, 5, 0, 0]} maxBarSize={30} name={translate("DLE")} /><Legend iconType="circle" iconSize={8} wrapperStyle={{
                  fontSize: 12,
                  paddingTop: 10
                }} /></BarChart></ResponsiveContainer></div></section></div>
    {warnings.length > 0 && <div className="quality-note"><span className="note-icon"><AlertTriangle size={20} /></span><div><strong>{warnings.length}{translate(" relevés à examiner")}</strong><p>{translate("La performance dépasse 100 %. Vérifiez les cycles théoriques et les quantités. Les valeurs originales sont conservées.")}</p></div><span className="note-tag">{translate("QUALITÉ DES DONNÉES")}</span></div>}
    </>}
  </>;
}
