import { validateTimeline } from './analytics.js';
export const SHIFTS = ['Matin', 'Après-Midi', 'Nuit'];
export const numericFields = ['opening_min','planned_min','breakdown_min','startup_min','changeover_min','good_qty','startup_rejects','production_rejects','labor_hours'];
export const ratio = (a,b) => b > 0 ? a / b : null;
export function calculate(r) {
  r={...r,...Object.fromEntries(numericFields.map(k=>[k,Number(r[k])||0]))};
  const required = r.opening_min - r.planned_min;
  const runtime = required - r.breakdown_min - r.startup_min - r.changeover_min;
  const total = r.good_qty + r.startup_rejects + r.production_rejects;
  const earned = r.standard_seconds * r.good_qty / 3600;
  return { required, runtime, total, rejects: total-r.good_qty, availability: ratio(runtime,required), performance: ratio(total*r.cycle_seconds,runtime*60), quality: ratio(r.good_qty,total), trs: ratio(r.good_qty*r.cycle_seconds,required*60), earned, dle: ratio(earned,r.labor_hours) };
}
export function aggregate(rows) {
  const sum = { required:0,runtime:0,total:0,good:0,rejects:0,ideal:0,goodIdeal:0,earned:0,labor:0,breakdown:0,startup:0,changeover:0,planned:0 };
  for (const r of rows) {
    const c=calculate(r);
    sum.required+=c.required; sum.runtime+=c.runtime; sum.total+=c.total; sum.good+=r.good_qty; sum.rejects+=c.rejects;
    sum.ideal+=c.total*r.cycle_seconds; sum.goodIdeal+=r.good_qty*r.cycle_seconds; sum.earned+=c.earned; sum.labor+=r.labor_hours;
    sum.breakdown+=r.breakdown_min; sum.startup+=r.startup_min; sum.changeover+=r.changeover_min; sum.planned+=r.planned_min;
  }
  return {...sum,availability:ratio(sum.runtime,sum.required),performance:ratio(sum.ideal,sum.runtime*60),quality:ratio(sum.good,sum.total),trs:ratio(sum.goodIdeal,sum.required*60),dle:ratio(sum.earned,sum.labor)};
}
export function validateRecord(r) {
  const errors=[];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || Number.isNaN(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10)!==r.date) errors.push('Choisissez une date valide.');
  if (!SHIFTS.includes(r.shift)) errors.push('Choisissez un poste.');
  if (!r.press_id || !r.article_id) errors.push('Choisissez une presse et un article.');
  if (numericFields.some(k=>!Number.isFinite(r[k])||r[k]<0)) errors.push('Les valeurs doivent être des nombres positifs ou nuls.');
  if (['good_qty','startup_rejects','production_rejects'].some(k=>!Number.isInteger(r[k]))) errors.push('Les quantités doivent être entières.');
  if (!(r.opening_min>0 && r.opening_min<=1440)) errors.push('Le temps d’ouverture doit être compris entre 1 et 1 440 minutes.');
  if (r.planned_min+r.breakdown_min+r.startup_min+r.changeover_min>r.opening_min) errors.push('Le total des arrêts dépasse le temps d’ouverture.');
  if (!(r.cycle_seconds>0 && r.standard_seconds>0)) errors.push('Le cycle et le temps standard doivent être supérieurs à zéro.');
  const c=calculate(r);
  if (c.runtime===0 && c.total>0) errors.push('Une production nécessite un temps machine supérieur à zéro.');
  return [...errors,...validateTimeline(r)];
}
export const recordKey = r => [r.date,r.shift,r.press_id,r.article_id].join('|');
export const formatNumber = (n,digits=0) => n==null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(n);
export const percent = n => n==null?'—':`${formatNumber(n*100,1)} %`;
export const dateLabel = date => new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
export const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
