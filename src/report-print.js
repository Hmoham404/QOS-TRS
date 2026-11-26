import { t, getLocale, getLanguage } from './i18n.js';
import { formatNumber as num, percent } from './domain.js';
import { departmentConfig } from './departments.js';
import { reportDle } from './production-report.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const label = text => escape(t(text));
const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(getLocale(), {day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});

export function reportPrintHtml({ report, period, mode, pointage, offline = false }) {
  const dle = report.count ? reportDle(report.hours, pointage) : null;
  const title = `${t('Rapport de production')} - ${mode === 'month' ? period.from.slice(0,7) : `${period.from}_${period.to}`}`;
  let department;
  const rows = report.lines.map(line => {
    const group = department !== line.department;
    department = line.department;
    return `${group ? `<tr class="group"><th colspan="5">${label(departmentConfig(department).name)}</th></tr>` : ''}<tr><th scope="row">${escape(line.name)}<small>${escape(line.code)}${!line.count ? ` · ${label('Aucun relevé pour cette période.')}` : ''}</small></th><td>${line.count ? escape(num(line.quantity)) : '—'}</td><td>${escape(num(line.cycle,3))}</td><td>${line.count ? escape(num(line.seconds,2)) : '—'}</td><td>${line.count ? escape(num(line.seconds/3600,2)) : '—'}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="${getLanguage()}" dir="${getLanguage() === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escape(title)}</title><style>
    @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#18374b;font:9pt Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}header{border-bottom:2px solid #087f70;padding-bottom:4mm;margin-bottom:4mm}header small{text-transform:uppercase;letter-spacing:1.4px;color:#087f70;font-size:8pt}h1{font-size:21pt;line-height:1.2;margin:2mm 0}header p{margin:2mm 0 0;font-size:10pt}.summary{display:flex;border:1px solid #cbd8df;margin:4mm 0 5mm;break-inside:avoid}.summary>div{flex:1;padding:3mm}.summary>div+div{border-inline-start:1px solid #cbd8df}.summary span{display:block;font-size:8pt}.summary strong{display:block;font-size:19pt;margin:2mm 0}.summary small{font-size:7pt;color:#536f81}.summary>div:first-child{background:#eaf6f1}table{width:100%;border-collapse:collapse;table-layout:fixed}caption{text-align:start;font-size:10pt;font-weight:bold;padding-bottom:2mm}th,td{padding:2mm;border-bottom:1px solid #dfe7ed;text-align:end;font-size:8pt;vertical-align:top;overflow-wrap:anywhere}th:first-child{text-align:start;width:36%}thead{display:table-header-group}thead th{background:#eef3f6;font-size:7pt}tr{break-inside:avoid}tbody th{font-weight:600}tbody small{display:block;color:#617887;font-size:6.5pt;font-weight:normal;margin-top:.8mm}.group th{background:#f1f6f6;color:#087f70;font-size:7pt;letter-spacing:.6px;text-transform:uppercase;padding-top:2mm;padding-bottom:1.5mm;break-after:avoid}tfoot{display:table-row-group}tfoot th,tfoot td{font-weight:bold;background:#eaf6f1;padding:3mm 2mm}footer{margin-top:4mm;break-inside:avoid;font-size:7pt;color:#536f81;line-height:1.5}footer p{margin:1mm 0}.status{font-size:8pt;color:#536f81}
    </style></head><body><header><small>OEE / DLE · ${label('TOUS LES ATELIERS')}</small><h1>${label('Rapport de production')}</h1><p>${label(mode === 'month' ? 'Mois' : mode === 'week' ? 'Semaine' : 'Jour')} · ${escape(date(period.from))}${period.to !== period.from ? ` - ${escape(date(period.to))}` : ''}</p></header>
    ${offline ? `<p class="status">${label('Copie hors connexion')}</p>` : ''}
    <section class="summary"><div><span>${label('Temps délivré')}</span><strong>${escape(num(report.hours,2))} ${label('h')}</strong><small>${label('Somme (quantités conformes × TC) ÷ 3 600')}</small></div><div><span>${label('Temps de pointage (h)')}</span><strong>${pointage.trim() ? escape(num(Number(pointage.replace(',','.')),2)) : '—'}</strong></div><div><span>DLE</span><strong>${escape(percent(dle))}</strong><small>${label('Temps délivré ÷ temps de pointage × 100')}</small></div></section>
    <table><caption>${label('Détail par article et TC historique')}</caption><colgroup><col style="width:36%"><col style="width:16%"><col style="width:14%"><col style="width:17%"><col style="width:17%"></colgroup><thead><tr><th>${label('Opération / article')}</th><th>${label('Quantité conforme')}</th><th>${label('TC / pièce (s)')}</th><th>${label('Quantité × TC (s)')}</th><th>${label('Temps délivré (h)')}</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="4">${label('Total du temps délivré')}</th><td>${escape(num(report.hours,2))} ${label('h')}</td></tr></tfoot></table>
    <footer><p>${label('Les quantités conformes et les TC par pièce proviennent des relevés de la période. Un article avec plusieurs TC apparaît sur plusieurs lignes.')}</p>${!report.count ? `<p>${label('Aucun relevé pour cette période.')}</p>` : ''}</footer></body></html>`;
}

// A separate document avoids clipping long native dialogs and prints all rows.
export function printReport(html) {
  const frame = document.createElement('iframe');
  frame.title = t('Imprimer le rapport');
  frame.setAttribute('aria-hidden','true');
  Object.assign(frame.style, {position:'fixed',width:'1px',height:'1px',left:'-10000px',border:'0'});
  frame.onload = async () => {
    await frame.contentDocument.fonts.ready;
    frame.contentWindow.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 1000), {once:true});
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
