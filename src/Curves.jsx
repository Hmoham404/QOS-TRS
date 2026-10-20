import React, { useMemo, useState } from 'react';
import { Activity, Factory, Users, CalendarCheck2, Clock3, Info, ChartNoAxesCombined, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, PieChart, Pie, Cell } from 'recharts';
import { aggregate, percent, formatNumber as num, dateLabel } from './domain';
import { curveSeries, planningRate, trsLosses } from './curves';
import './curves.css';

const machineColors = ['#159b81', '#347bea', '#c08b39', '#8b6bc0', '#ca6379', '#2b7f91', '#7c8738', '#a36940', '#505db4', '#b84949', '#4c8c66', '#866282', '#37638b', '#6d7782', '#b08029', '#416653'];
const fullDate = date => new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const chartPercent = value => value == null ? null : value * 100;
const yDomain = [0, maximum => Math.max(100, Math.ceil(maximum / 20) * 20)];

function CurveTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const values = payload.filter(p => p.value != null);
  if (!values.length) return null;
  return <div className="chart-tooltip"><strong>{fullDate(label)}</strong>{values.map(p => <div key={p.dataKey}><span style={{ color: p.color }}>{p.name}</span><b>{num(p.value, 1)} %</b></div>)}</div>;
}

function Trend({ days, lines, target, mode = 'line' }) {
  const points = days.map(day => ({ ...day, ...Object.fromEntries(lines.map(line => [line.key, chartPercent(day[line.key])])) }));
  const Chart = mode === 'bar' ? BarChart : LineChart;
  return <div className="curves-chart"><ResponsiveContainer width="100%" height="100%">
    <Chart data={points} margin={{ top: 16, right: 24, left: 0, bottom: 12 }} accessibilityLayer>
      <CartesianGrid stroke="#e6edf2" vertical={false} strokeDasharray="3 4" />
      <XAxis dataKey="date" tickFormatter={dateLabel} axisLine={false} tickLine={false} minTickGap={24} tick={{ fill: '#71879a', fontSize: 11 }} dy={10} />
      <YAxis domain={yDomain} tickFormatter={value => `${num(value)} %`} axisLine={false} tickLine={false} width={62} tick={{ fill: '#71879a', fontSize: 11 }} />
      <Tooltip content={<CurveTooltip />} />
      {target != null && <ReferenceLine y={target * 100} stroke="#a68a53" strokeDasharray="5 5" />}
      {lines.map(line => mode === 'bar'
        ? <Bar key={line.key} dataKey={line.key} name={line.name} fill={line.color} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
        : <Line key={line.key} type="linear" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />)}
    </Chart>
  </ResponsiveContainer></div>;
}

function ChartPanel({ title, subtitle, lines, days, target, mode, children, action, className = '' }) {
  return <section className={`panel curves-panel ${className}`} aria-label={title}>
    <div className="panel-heading"><div><span className="eyebrow">{subtitle}</span><h2>{title}</h2></div>{action}</div>
    {days.length ? <>
    <div className="curves-legend">{lines.map(line => <span key={line.key}><i style={{ background: line.color }} />{line.name}</span>)}{target != null && <span><i className="curves-target" />Objectif {num(target * 100)} %</span>}</div>
    <Trend days={days} lines={lines} target={target} mode={mode} />
    </> : <div className="curves-chart-empty"><Factory size={28} /><strong>Aucun relevé pour cette presse</strong><p>Choisissez une autre presse ou modifiez la période et le poste.</p></div>}
    <div className="curves-footnote">{children}</div>
  </section>;
}

function LossTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return <div className="chart-tooltip"><strong>{item.name}</strong><p>{num(item.minutes, 1)} min · {percent(item.share)} des pertes</p></div>;
}

export default function Curves({ rows, data, target, press }) {
  const [chartMode, setChartMode] = useState('line');
  const [machinePress, setMachinePress] = useState('all');
  const totals = useMemo(() => aggregate(rows), [rows]);
  const planning = useMemo(() => planningRate(rows), [rows]);
  const losses = useMemo(() => trsLosses(rows), [rows]);
  const { days, machines } = useMemo(() => curveSeries(rows, data.presses), [rows, data.presses]);
  const scope = press === 'all' ? 'Atelier' : data.presses.find(p => p.id === press)?.name || 'Presse sélectionnée';
  const pressOptions = data.presses.filter(machine => press === 'all' || machine.id === press);
  const selectedMachine = pressOptions.some(machine => machine.id === machinePress) ? machinePress : 'all';
  const machineDays = useMemo(() => selectedMachine === 'all' ? days : curveSeries(rows.filter(row => row.press_id === selectedMachine), data.presses).days, [selectedMachine, days, rows, data.presses]);
  const machineLines = machines.filter(machine => selectedMachine === 'all' || machine.id === selectedMachine).map(machine => ({ key: machine.key, name: machine.name, color: machineColors[data.presses.findIndex(p => p.id === machine.id) % machineColors.length] }));
  const planDays = days.some(day => day.planning != null);

  return <div className="curves-page">
    <div className="curves-display"><span>Affichage des graphiques</span><div className="curves-display-switch" role="group" aria-label="Type de graphique"><button type="button" aria-label="Afficher les courbes" aria-pressed={chartMode === 'line'} onClick={() => setChartMode('line')}><ChartNoAxesCombined size={16} />Courbes</button><button type="button" aria-label="Afficher les histogrammes" aria-pressed={chartMode === 'bar'} onClick={() => setChartMode('bar')}><BarChart3 size={16} />Histogrammes</button></div></div>
    <div className="curves-scope"><div><span className="curves-scope-icon"><Factory size={21} /></span><div><strong>{scope}</strong><p>Évolution par jour de production · {num(rows.length)} relevés · {num(machines.length)} presses renseignées</p></div></div><span className="curves-scope-hint">Les filtres s’appliquent à tous les graphiques.</span></div>
    <div className="curves-kpis">
      {[
        { key: 'trs', label: press === 'all' ? 'TRS global atelier' : 'TRS de la presse', value: percent(totals.trs), detail: 'Pondéré par le temps requis', Icon: Activity },
        { key: 'dle', label: press === 'all' ? 'DLE atelier' : 'DLE de la presse', value: percent(totals.dle), detail: 'Heures acquises / heures dépensées', Icon: Users },
        { key: 'planning', label: 'Respect du planning', value: percent(planning.rate), detail: `${num(planning.actual)} conformes / ${num(planning.planned)} planifiées`, Icon: CalendarCheck2 },
        { key: 'losses', label: 'Pertes du TRS', value: `${num(losses.total, 1)} min`, detail: 'Arrêts, cadence et rebuts', Icon: Clock3 },
      ].map(({ key, label, value, detail, Icon }) => <section className={`curves-kpi curves-kpi-${key}`} key={key} aria-label={label}><div><span>{label}</span><Icon size={19} /></div><strong data-testid={`curves-${key}`}>{value}</strong><small>{detail}</small></section>)}
    </div>
    {!rows.length ? <section className="panel curves-empty"><Activity size={28} /><h2>Aucun relevé sur cette période</h2><p>Modifiez les dates, la presse ou le poste pour afficher les courbes.</p></section> : <>
      <div className="curves-grid">
        <ChartPanel title={press === 'all' ? 'TRS global de l’atelier' : `TRS · ${scope}`} subtitle="RENDEMENT SYNTHÉTIQUE" days={days} lines={[{ key: 'trs', name: 'TRS', color: '#159b81' }]} target={target} mode={chartMode}>
          Temps théorique des pièces conformes / temps requis. Seuls les jours avec une saisie sont affichés, y compris un dimanche travaillé.
        </ChartPanel>
        <ChartPanel title={press === 'all' ? 'DLE de l’atelier' : `DLE · ${scope}`} subtitle="RENDEMENT MAIN-D’ŒUVRE" days={days} lines={[{ key: 'dle', name: 'DLE', color: '#2b7f91' }]} mode={chartMode}>
          Somme des heures acquises / somme des heures dépensées. Sans heures dépensées, le DLE est non calculable.
        </ChartPanel>
        <ChartPanel title="TRS par machine" subtitle="COMPARAISON DES PRESSES" className="curves-machines" days={machineDays} lines={machineLines} target={target} mode={chartMode}
          action={<label className="curves-machine-filter"><span>Presse</span><select aria-label="Presse du graphique TRS par machine" value={selectedMachine} onChange={event => setMachinePress(event.target.value)}><option value="all">Toutes les presses</option>{pressOptions.map(machine => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>}>
          Une série par presse renseignée. Le choix de presse dans ce graphique s’applique uniquement à cette comparaison.
        </ChartPanel>
        <section className="panel curves-panel" aria-label="Taux de respect du planning">
          <div className="panel-heading"><div><span className="eyebrow">PRODUCTION & ENGAGEMENT</span><h2>Taux de respect du planning</h2></div></div>
          {planDays ? <><div className="curves-legend"><span><i style={{ background: '#487ac3' }} />Réalisé / planifié</span><span><i className="curves-target" />Objectif 100 %</span></div><Trend days={days} lines={[{ key: 'planning', name: 'Respect du planning', color: '#487ac3' }]} target={1} mode={chartMode} /></> : <div className="curves-chart-empty"><CalendarCheck2 size={30} /><strong>{planning.count ? 'Quantité planifiée totale nulle' : 'Quantités planifiées non renseignées'}</strong><p>Renseignez une quantité planifiée supérieure à zéro dans la saisie pour calculer ce taux.</p></div>}
          <div className="curves-footnote">Pièces conformes / quantité planifiée × 100. {num(planning.count)} relevés avec planning sur {num(rows.length)} ; les relevés sans planning sont exclus des deux quantités. Un plan nul ne permet pas de calculer un taux.</div>
        </section>
        <section className="panel curves-panel curves-losses" aria-label="Pertes du TRS">
          <div className="panel-heading"><div><span className="eyebrow">COMPRENDRE LES PERTES</span><h2>Pertes du TRS · {scope}</h2></div></div>
          {losses.total > 0 ? <><div className="curves-donut" role="img" aria-label={`Répartition des pertes du TRS : ${num(losses.total, 1)} minutes`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={losses.items.filter(item => item.minutes > 0)} dataKey="minutes" nameKey="name" innerRadius="57%" outerRadius="85%" paddingAngle={2} stroke="none" isAnimationActive={false}>{losses.items.filter(item => item.minutes > 0).map(item => <Cell key={item.key} fill={item.color} />)}</Pie><Tooltip content={<LossTooltip />} /></PieChart></ResponsiveContainer><div className="curves-donut-center"><strong>{num(losses.total / 60, 1)} h</strong><span>de pertes</span></div></div><ul className="curves-loss-list">{losses.items.map(item => <li key={item.key}><span><i style={{ background: item.color }} />{item.name}</span><strong>{num(item.minutes, 1)} <small>min</small></strong><span>{percent(item.share)}</span></li>)}</ul></> : <div className="curves-chart-empty"><Clock3 size={30} /><strong>Aucune perte calculée</strong><p>Aucune durée d’arrêt, perte de cadence ou durée théorique de rebut sur ce périmètre.</p></div>}
          <div className="curves-footnote">Parts des pertes en minutes, hors pauses planifiées. Cadence : temps machine moins temps théorique de toutes les pièces ; rebuts : quantité rebutée × cycle théorique.{losses.speedGain > 0 && <p className="curves-gain"><Info size={15} />Les performances supérieures à 100 % représentent {num(losses.speedGain, 1)} min de gain théorique, affichées séparément et non soustraites du camembert.</p>}</div>
        </section>
      </div>
      <details className="panel curves-values"><summary>Voir les valeurs par jour</summary><div className="table-scroll"><table><caption className="sr-only">Indicateurs quotidiens · {scope}</caption><thead><tr><th>Date</th><th>TRS global</th><th>DLE</th><th>Respect du planning</th>{machines.map(machine => <th key={machine.id}>TRS {machine.name}</th>)}</tr></thead><tbody>{days.map(day => <tr key={day.date}><td>{fullDate(day.date)}</td><td>{percent(day.trs)}</td><td>{percent(day.dle)}</td><td>{percent(day.planning)}</td>{machines.map(machine => <td key={machine.id}>{percent(day[machine.key])}</td>)}</tr>)}</tbody></table></div></details>
    </>}
  </div>;
}
