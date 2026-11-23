import React from 'react';
import {FileSpreadsheet} from 'lucide-react';
import {useDepartmentText} from './DepartmentContext.jsx';
import {calculate, aggregate, formatNumber as num, percent} from './domain.js';
import {DEFAULT_SHIFT_TIME} from './shift-time.js';
import './method-guide.css';

// One fictional shift, independent of production data and saved preferences.
export const methodExample = {...DEFAULT_SHIFT_TIME, planned_min:15, breakdown_min:45,
  startup_min:0,changeover_min:0,good_qty:4560,startup_rejects:100,production_rejects:140,
  cycle_seconds:5,standard_seconds:6,labor_hours:8};

export default function MethodGuide() {
  const t=useDepartmentText(), r=methodExample, c=calculate(r);
  const n=value=>num(value,0), pct=value=>percent(value);
  const second={...r,opening_min:300,planned_min:0,good_qty:3000,cycle_seconds:4};
  const grouped=aggregate([r,second]);
  const rows=[
    ['Temps d’ouverture', 'Durée du poste en minutes − pause − réunion 5 min − 5S',
      `8 × 60 − 20 − 5 − 5 = ${n(r.opening_min)} min`,
      'La pause, la réunion et le 5S sont déduits avant les arrêts planifiés.'],
    ['Temps requis', 'Temps d’ouverture − arrêts planifiés',
      `450 − 15 = ${n(c.required)} min`,
      'Les arrêts planifiés sont saisis séparément. Ils ne comprennent pas les pauses déjà déduites.'],
    ['Temps machine', 'Temps requis − pertes de disponibilité',
      `435 − 45 = ${n(c.runtime)} min`,
      'Les pertes regroupent les pannes et les autres arrêts non planifiés du relevé.'],
    ['Quantité totale', 'Conformes + rebuts démarrage + rebuts production',
      `4 560 + 100 + 140 = ${n(c.total)}`,
      'La quantité totale comprend toutes les pièces produites, y compris les rebuts.'],
    ['Disponibilité', 'Temps machine ÷ temps requis',
      `390 ÷ 435 × 100 = ${pct(c.availability)}`,
      'Part du temps requis pendant laquelle la machine a fonctionné.'],
    ['Performance', 'Quantité totale × cycle ÷ temps requis en secondes',
      `(4 800 × 5) ÷ (435 × 60) × 100 = ${pct(c.performance)}`,
      'Le cycle vaut ici 5 secondes par pièce. Dans cette application, le dénominateur est le temps requis.'],
    ['Qualité', 'Quantité conforme ÷ quantité totale',
      `4 560 ÷ 4 800 × 100 = ${pct(c.quality)}`,
      'Part des pièces conformes dans la production totale.'],
    ['OEE atelier', 'Σ (conformes × cycle) ÷ Σ temps requis en secondes',
      `(4 560 × 5) ÷ (435 × 60) × 100 = ${pct(c.trs)}`,
      'Le temps théorique des pièces conformes est comparé au temps requis.'],
    ['Recette en heures', 'Quantité conforme × temps standard ÷ 3 600',
      `(4 560 × 6) ÷ 3 600 = ${num(c.earned,1)} h`,
      'La recette est un temps de travail théorique gagné, pas un montant. Le standard vaut ici 6 secondes par pièce.'],
    ['DLE', 'Recette en heures ÷ heures dépensées',
      `${num(c.earned,1)} ÷ 8 × 100 = ${pct(c.dle)}`,
      'Les heures dépensées sont les heures de main-d’œuvre cumulées : 2 personnes pendant 4 heures représentent 8 heures.'],
  ];
  return <section className="panel settings-card formula-card method-guide">
    <FileSpreadsheet className="section-icon"/><h2>{t('Une méthode transparente')}</h2>
    <p>{t('La synthèse utilise les temps et quantités cumulés.')}</p>
    <div className="method-example-context"><strong>{t('Exemple fictif, sans effet sur vos données')}</strong><p>{t('Un poste de 8 h, une pause de 20 min, une réunion de 5 min, 5 min de 5S, 15 min d’arrêts planifiés et 45 min de pertes.')}</p></div>
    <div className="dle-formula"><strong>{t("DLE")}: {percent(c.dle)}</strong><p>{num(r.good_qty)} × {num(r.standard_seconds, 3)} s ÷ ({num(c.labor, 2)} h MOD × 3 600)</p><small>{t("Heures MOD = durée de travail × nombre d’opérateurs.")}</small></div>
    <ol className="method-steps">{rows.map(([title,formula,example,description])=><li key={title}><h3>{t(title)}</h3><p>{t(description)}</p><div className="method-formula">{t(formula)}</div><div className="method-example"><span>{t('Exemple')}</span><strong>{example}</strong></div></li>)}</ol>
    <details className="method-aggregation"><summary>{t('Plusieurs relevés : additionner avant de diviser')}</summary><p>{t('On additionne les temps théoriques et les temps requis, puis on calcule le taux. On ne fait pas la moyenne simple des pourcentages.')}</p><p>{t('Exemple')} OEE : (4 560 × 5 + 3 000 × 4) ÷ ((435 + 300) × 60) × 100 = <strong>{pct(grouped.trs)}</strong>.</p><p>{t('Pour le DLE global, additionner les recettes en heures et diviser par la somme des heures dépensées.')}</p></details>
    <small>{t('Les périodes sans temps requis sont non calculables. Les ratios dépassant 100 % sont conservés et signalés. La performance inclut les pertes de disponibilité ; le produit disponibilité × performance × qualité ne correspond donc pas à l’OEE.')}</small>
    <small className="method-zero-note">{t('Qualité sans production et DLE sans heures dépensées : résultat non calculable, affiché par un tiret.')}</small>
  </section>;
}
