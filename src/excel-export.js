import { EXTRA_LOSS_FIELDS, STOP_TYPES } from "./losses.js";
import { aggregate, calculate } from './domain.js';
import { getLanguage, t as translate } from './i18n.js';
const HEADERS = ['Date', 'Poste', 'Presse', 'Code moule', 'Article', 'Ouverture (min)', 'Arrêts planifiés (min)', 'Temps requis (min)', 'Panne machine (min)', 'Démarrage/arrêt (min)', 'Changement moule (min)', 'Temps machine (min)', 'Quantité totale', 'Conformes', 'Rebuts démarrage', 'Rebuts production', 'Cycle (s/pièce)', 'Disponibilité (%)', 'Performance (%)', 'Qualité (%)', 'TRS (%)', 'Standard (s)', 'Heures dépensées', 'Recette (h)', 'DLE (%)', 'Commentaire', 'Début du relevé', 'Journal complet', 'Arrêts horodatés (JSON)', 'Quantité planifiée', ...EXTRA_LOSS_FIELDS.map(field => Object.values(STOP_TYPES).find(type => type.field === field).source + ' (min)')];
export async function buildExcelExport(rows, data, {
  department = 'Injection'
} = {}) {
  const {
    default: ExcelJS
  } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QOS';
  workbook.created = new Date();
  const view = {
    rightToLeft: getLanguage() === 'ar'
  };
  const summary = workbook.addWorksheet(translate('Synthèse'), {
    views: [view]
  });
  const details = workbook.addWorksheet(translate('Relevés'), {
    views: [{
      ...view,
      state: 'frozen',
      ySplit: 1
    }]
  });
  const presses = new Map(data.presses.map(item => [item.id, item]));
  const articles = new Map(data.articles.map(item => [item.id, item]));
  details.columns = HEADERS.map((header, index) => ({
    header: translate(header),
    width: [4, 25, 28].includes(index) ? 35 : index === 0 ? 15 : 22
  }));
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));
  for (const row of sorted) {
    const c = calculate(row),
      article = articles.get(row.article_id);
    details.addRow([new Date(row.date + 'T00:00:00Z'), translate(row.shift), presses.get(row.press_id)?.name ?? '', article?.code ?? '', article?.name ?? '', row.opening_min, row.planned_min, c.required, row.breakdown_min, row.startup_min, row.changeover_min, c.runtime, c.total, row.good_qty, row.startup_rejects, row.production_rejects, row.cycle_seconds, c.availability, c.performance, c.quality, c.trs, row.standard_seconds, row.labor_hours, c.earned, c.dle, row.notes ?? '', row.shift_start ?? '', translate(row.timeline_complete ? 'Oui' : 'Non'), JSON.stringify(row.stop_events ?? []), row.planned_qty ?? null, ...EXTRA_LOSS_FIELDS.map(field => row[field] ?? 0)]);
  }
  details.getColumn(1).numFmt = 'yyyy-mm-dd';
  for (const index of [18, 19, 20, 21, 25]) details.getColumn(index).numFmt = '0.0%';
  for (const index of [6, 7, 8, 9, 10, 11, 12, 17, 22, 23, 24, ...EXTRA_LOSS_FIELDS.map((_, index) => 31 + index)]) details.getColumn(index).numFmt = '#,##0.00';
  for (const index of [13, 14, 15, 16, 30]) details.getColumn(index).numFmt = '#,##0';
  details.autoFilter = {
    from: 'A1',
    to: 'AL' + Math.max(1, rows.length + 1)
  };
  details.getRow(1).height = 44;
  details.getRow(1).eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: 'FF173E58'
      }
    };
    cell.font = {
      bold: true,
      color: {
        argb: 'FFFFFFFF'
      },
      size: 11
    };
    cell.alignment = {
      vertical: 'middle',
      wrapText: true
    };
  });
  details.eachRow((row, index) => {
    if (index === 1) return;
    row.height = 22;
    row.eachCell(cell => {
      cell.font = {
        name: 'Calibri',
        size: 11
      };
      if (index % 2 === 0) cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: 'FFF1F7FA'
        }
      };
    });
  });
  const totals = aggregate(rows),
    dates = rows.map(row => row.date).sort();
  summary.columns = [{
    width: 38
  }, {
    width: 36
  }, {
    width: 18
  }, {
    width: 18
  }];
  summary.mergeCells('A1:D1');
  summary.getCell('A1').value = `QOS · ${translate(department)}`;
  summary.getCell('A1').font = {
    name: 'Calibri',
    size: 22,
    bold: true,
    color: {
      argb: 'FF173E58'
    }
  };
  summary.getRow(1).height = 38;
  summary.addRow([translate('Date d’export'), new Date()]);
  summary.getCell('B2').numFmt = 'yyyy-mm-dd hh:mm';
  summary.addRow([translate('Période'), dates.length ? `${dates[0]} — ${dates.at(-1)}` : '—']);
  summary.addRow([translate('Nombre de relevés'), rows.length]);
  summary.addRow([]);
  summary.addRow([translate('Indicateur'), translate('Valeur')]);
  summary.getRow(6).eachCell(cell => {
    cell.font = {
      bold: true,
      color: {
        argb: 'FFFFFFFF'
      }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: 'FF173E58'
      }
    };
  });
  const sheetName = details.name.replaceAll("'", "''"),
    end = Math.max(2, rows.length + 1);
  const sum = column => `SUM('${sheetName}'!${column}2:${column}${end})`;
  for (const [label, value, formula, format] of [['Pièces conformes', totals.good, sum('N'), '#,##0'], ['Rebuts', totals.rejects, `${sum('O')}+${sum('P')}`, '#,##0'], ['Temps machine', totals.runtime / 60, `${sum('L')}/60`, '0.00" h"'], ['Disponibilité', totals.availability, `IF(${sum('H')}=0,"",${sum('L')}/${sum('H')})`, '0.0%'], ['Performance', totals.performance, `IF(${sum('L')}=0,"",SUMPRODUCT('${sheetName}'!M2:M${end},'${sheetName}'!Q2:Q${end})/(${sum('L')}*60))`, '0.0%'], ['Qualité', totals.quality, `IF(${sum('M')}=0,"",${sum('N')}/${sum('M')})`, '0.0%'], ['TRS', totals.trs, `IF(${sum('H')}=0,"",SUMPRODUCT('${sheetName}'!N2:N${end},'${sheetName}'!Q2:Q${end})/(${sum('H')}*60))`, '0.0%'], ['DLE', totals.dle, `IF(${sum('W')}=0,"",${sum('X')}/${sum('W')})`, '0.0%']]) {
    const row = summary.addRow([translate(label), {
      formula,
      result: value ?? ''
    }]);
    row.getCell(2).numFmt = format;
    row.height = 26;
  }
  summary.eachRow(row => row.eachCell(cell => {
    cell.alignment = {
      vertical: 'middle',
      wrapText: true
    };
  }));
  summary.pageSetup = {
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1
  };
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook.xlsx.writeBuffer();
}
