import { t as translate } from "./i18n.js";
import React, { useState } from "react";
import StopTimeInput from "./StopTimeInput";
import { Plus, Trash2, Timer, Info } from "lucide-react";
import { STOP_TYPES, clockLabel, stopTotals, defaultStart } from "./analytics";
import { formatNumber as num } from "./domain";
export default function StopJournal({
  record,
  onChange,
  disabled
}) {
  const [timeMode, setTimeMode] = useState("clock");
  const enabled = Boolean(record.timeline_complete),
    events = record.stop_events || [];
  function update(next) {
    onChange({
      ...record,
      stop_events: next,
      ...stopTotals(next)
    });
  }
  function toggle(checked) {
    onChange({
      ...record,
      timeline_complete: checked,
      shift_start: record.shift_start || defaultStart(record.shift),
      stop_events: [],
      ...(checked ? stopTotals([]) : {})
    });
  }
  return <section className="panel stop-journal"><div className="panel-heading"><div><span className="eyebrow">{translate("CHRONOLOGIE DU POSTE")}</span><h2>{translate("Journal des arrêts")}</h2></div><Timer size={22} /></div><datalist id="stop-cause-suggestions"><option value={translate("Pause équipe")} /><option value={translate("Maintenance planifiée")} /><option value={translate("Défaut hydraulique")} /><option value={translate("Réglage injection")} /><option value={translate("Changement de moule")} /><option value={translate("Manque matière")} /></datalist><div className="form-body"><label className="journal-toggle"><input type="checkbox" checked={enabled} disabled={disabled} onChange={e => toggle(e.target.checked)} /><span><strong>{translate("Utiliser les arrêts horodatés")}</strong><small>{translate("Remplace les durées globales par la somme des événements saisis.")}</small></span></label>{enabled ? <><div className="journal-context"><label className="field"><span>{translate("Heure de début du relevé")}</span><input type="time" required value={(record.shift_start || "").slice(0, 5)} disabled={disabled} onChange={e => onChange({
              ...record,
              shift_start: e.target.value
            })} /></label><p>{translate("Fin prévue : ")}<strong>{clockLabel(record.shift_start, Number(record.opening_min))}</strong><br />{translate("Vérifiez l’horaire proposé. Pour une fin après minuit, choisissez le jour J+1.")}</p></div><div className="journal-notice"><Info size={17} /><span>{translate("Saisissez ")}<strong>{translate("tous")}</strong>{translate(" les arrêts. Les intervalles restants seront considérés comme du temps de marche déclaré. Pour un ancien relevé, reconstituez tous les arrêts avant d’enregistrer.")}</span></div><div className="journal-time-mode"><span>{translate("Saisir les arrêts en")}</span><button type="button" className={timeMode === "clock" ? "selected" : ""} onClick={() => setTimeMode("clock")}>{translate("Heures & dates")}</button><button type="button" className={timeMode === "minutes" ? "selected" : ""} onClick={() => setTimeMode("minutes")}>{translate("Minutes depuis le début")}</button></div><div className="events-list">{events.map((event, index) => <div className="event-row" key={event.id}><span className="event-number">{String(index + 1).padStart(2, "0")}</span>{["start_min", "end_min"].map(kind => <StopTimeInput key={kind} record={record} event={event} index={index} kind={kind} mode={timeMode} disabled={disabled} onChange={value => update(events.map((x, i) => i === index ? {
              ...x,
              [kind]: value
            } : x))} />)}<label className="field event-category"><span>{translate("Catégorie")}</span><select aria-label={translate("Catégorie arrêt {0}", [index + 1])} value={event.category} disabled={disabled} onChange={e => update(events.map((x, i) => i === index ? {
                ...x,
                category: e.target.value
              } : x))}>{Object.entries(STOP_TYPES).map(([key, t]) => <option key={key} value={key}>{translate(t.label)}</option>)}</select></label><label className="field event-cause"><span>{translate("Cause précise ")}<small>{translate("facultatif")}</small></span><input aria-label={translate("Cause arrêt {0}", [index + 1])} maxLength={120} value={event.cause} disabled={disabled} list="stop-cause-suggestions" placeholder={translate("Ex. défaut hydraulique")} onChange={e => update(events.map((x, i) => i === index ? {
                ...x,
                cause: e.target.value
              } : x))} /></label><button type="button" className="icon-button event-delete" disabled={disabled} aria-label={translate("Retirer arrêt {0}", [index + 1])} onClick={() => update(events.filter((_, i) => i !== index))}><Trash2 size={17} /></button><small className="event-duration">{clockLabel(record.shift_start, Number(event.start_min))} — {clockLabel(record.shift_start, Number(event.end_min))} · {num(Number(event.end_min) - Number(event.start_min), 1)}{translate(" min")}</small></div>)}</div>{!events.length && <p className="journal-empty">{translate("Aucun arrêt saisi. Enregistrer ainsi déclare le relevé entièrement en marche.")}</p>}<button className="btn" type="button" disabled={disabled || events.length >= 100} onClick={() => {
          const start = Math.max(0, ...events.map(e => Number(e.end_min) || 0));
          update([...events, {
            id: crypto.randomUUID(),
            start_min: start,
            end_min: Math.min(start + 10, Number(record.opening_min)),
            category: "breakdown",
            cause: ""
          }]);
        }}><Plus size={16} />{translate("Ajouter un arrêt")}</button></> : <p className="journal-empty">{translate("Les totaux suffisent au Pareto et à la comparaison des postes. Activez le journal pour afficher les arrêts sur la courbe horaire.")}</p>}</div></section>;
}
