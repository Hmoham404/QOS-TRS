import { extraLossDefaults, UNPLANNED_TYPES, unplannedMinutes } from "./losses.js";
import { t as translate } from "./i18n.js";
import React, { useEffect, useState } from "react";
import { Factory, Clock3, Boxes, Users, LockKeyhole, Save, Check, AlertTriangle, Info, ClipboardPenLine } from "lucide-react";
import { SHIFTS, calculate, percent, formatNumber as num, today, numericFields, validateRecord, recordKey } from "./domain";
import { saveRecord, dataScope } from "./data";
import { draftKey, readDraft, writeDraft, removeDraft } from "./drafts";
import StopJournal from "./StopJournal";
import { defaultStart } from "./analytics";
import { overlapError } from "./daily";
const defaultRecord = data => ({
  id: crypto.randomUUID(),
  date: today(),
  shift: "Matin",
  press_id: data.presses.find(p => p.active)?.id || "",
  article_id: data.articles.find(a => a.active)?.id || "",
  ...extraLossDefaults(),
  opening_min: 480,
  planned_min: 0,
  breakdown_min: 0,
  startup_min: 0,
  changeover_min: 0,
  good_qty: 0,
  planned_qty: "",
  startup_rejects: 0,
  production_rejects: 0,
  labor_hours: 8,
  notes: "",
  source: "web",
  source_row: null,
  shift_start: "06:00",
  timeline_complete: false,
  stop_events: []
});
function Field({
  label,
  name,
  value,
  onChange,
  unit,
  integer = false,
  disabled = false,
  required = true
}) {
  return <label className="field"><span>{translate(label)}</span><div className="input-unit"><input name={name} aria-label={translate(label)} type="number" min="0" step={integer ? "1" : "any"} required={required} disabled={disabled} value={value} onChange={e => onChange(name, e.target.value === "" ? "" : Number(e.target.value))} /><span>{unit}</span></div></label>;
}
function Auto({
  label,
  value,
  unit
}) {
  return <div className="auto-field"><span>{translate(label)}<LockKeyhole size={12} /></span><strong>{value}<small>{unit}</small></strong></div>;
}
export default function Entry({
  data,
  editing,
  defaults = {},
  storageKey,
  canWrite,
  onSaved
}) {
  const key = storageKey || draftKey(dataScope, editing, defaults);
  const [restored] = useState(() => readDraft(key));
  const [r, setR] = useState(() => restored?.record ? {...extraLossDefaults(), ...restored.record} : (editing ? {
    ...extraLossDefaults(),
    timeline_complete: false,
    stop_events: [],
    ...editing,
    planned_qty: editing.planned_qty ?? "",
    shift_start: editing.shift_start || defaultStart(editing.shift)
  } : {
    ...defaultRecord(data),
    ...defaults,
    shift_start: defaults.shift_start || defaultStart(defaults.shift || "Matin")
  }));
  const [busy, setBusy] = useState(false),
    [errors, setErrors] = useState([]),
    [dirty, setDirty] = useState(Boolean(restored)),
    [draftError, setDraftError] = useState("");
  const [draftSaved, setDraftSaved] = useState(Boolean(restored));
  function update(next) {
    setR(next);
    setDirty(true);
    try {
      writeDraft(key, next, editing);
      setDraftSaved(true);
      setDraftError("");
    } catch {
      setDraftSaved(false);
      setDraftError(translate("Le stockage de cet appareil est indisponible ou plein. Gardez cette page ouverte et enregistrez votre saisie."));
    }
  }
  const article = data.articles.find(a => a.id === r.article_id);
  const sameArticle = editing?.article_id === r.article_id;
  const cycle = sameArticle ? editing.cycle_seconds : article ? article.mold_cycle_seconds / article.cavities : 0;
  const standard = sameArticle ? editing.standard_seconds : article?.standard_seconds || 0;
  const record = {
    ...r,
    planned_qty: r.planned_qty === "" ? null : r.planned_qty,
    cycle_seconds: cycle,
    standard_seconds: standard
  };
  const c = calculate(record);
  const duplicate = data.records.some(x => x.id !== r.id && recordKey(x) === recordKey(r));
  useEffect(() => {
    const fn = e => {
      if (dirty && !draftSaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty, draftSaved]);
  useEffect(() => {
    const guard = e => {
      if (dirty && !draftSaved) {
        e.preventDefault();
        setDraftError(translate("Enregistrez le relevé avant la mise à jour : le brouillon n’a pas pu être conservé."));
      }
    };
    window.addEventListener("qos-before-update", guard);
    return () => window.removeEventListener("qos-before-update", guard);
  }, [dirty, draftSaved]);
  const change = (name, value) => update({
    ...r,
    [name]: value,
    ...(name === "shift" && !r.timeline_complete ? {
      shift_start: defaultStart(value)
    } : {})
  });
  async function submit(e) {
    e.preventDefault();
    const eList = validateRecord(record);
    const conflict = overlapError(record, data.records);
    if (conflict) eList.push(conflict);
    if (duplicate) eList.push(translate("Ce relevé existe déjà. Ouvrez-le dans l’historique pour le modifier."));
    if (eList.length) {
      setErrors(eList);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      await saveRecord(record);
      try {
        removeDraft(key);
      } catch {}
      setDirty(false);
      await onSaved();
    } catch (err) {
      setErrors([err.message]);
    } finally {
      setBusy(false);
    }
  }
  return <form className="entry-layout" onSubmit={submit}><div className="entry-main"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">{translate("01 / CONTEXTE")}</span><h2>{editing ? translate("Relevé du ") + editing.date : translate("Un nouveau relevé")}</h2></div><span className="badge neutral"><ClipboardPenLine size={13} />{editing ? translate("Modification") : translate("Saisie manuelle")}</span></div><div className="form-body"><div className="form-grid context-grid"><label className="field"><span>{translate("Date de production")}</span><input type="date" required value={r.date} disabled={!canWrite} onChange={e => change("date", e.target.value)} /></label><label className="field"><span>{translate("Poste")}</span><select value={r.shift} disabled={!canWrite} onChange={e => change("shift", e.target.value)}>{SHIFTS.map(s => <option key={s} value={s}>{translate(s)}</option>)}</select></label><label className="field"><span>{translate("Presse")}</span><select required value={r.press_id} disabled={!canWrite} onChange={e => change("press_id", e.target.value)}><option value="" disabled>{translate("Choisir une presse")}</option>{data.presses.filter(p => p.active || p.id === r.press_id).map(p => <option key={p.id} value={p.id}>{p.name}{!p.active ? translate(" · archivée") : ""}</option>)}</select></label><label className="field wide"><span>{translate("Code moule / article")}</span><select required value={r.article_id} disabled={!canWrite} onChange={e => change("article_id", e.target.value)}><option value="" disabled>{translate("Choisir un article")}</option>{data.articles.filter(a => a.active || a.id === r.article_id).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}{!a.active ? translate(" · archivé") : ""}</option>)}</select></label><Auto label={translate("Désignation article")} value={article?.name || "—"} /></div><p className="field-help"><Info size={14} />{translate("Date du début du poste : une nuit qui finit le lendemain reste rattachée à cette date. Vérifiez l’heure de début du journal.")}</p><div className="article-detail"><Factory size={16} />{article ? translate("{0} empreintes · {1} s / cycle moule", [article.cavities, num(article.mold_cycle_seconds, 2)]) : translate("Ajoutez d’abord un article dans Presses & moules.")}<span>{translate("Cycle retenu : ")}{num(cycle, 3)}{translate(" s / pièce")}</span></div>{duplicate && <p className="error" role="alert">{translate("Un relevé existe déjà pour cette combinaison date, poste, presse et article.")}</p>}</div></section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">{translate("02 / TEMPS DE PRODUCTION")}</span><h2>{translate("Le temps de votre poste")}</h2></div><Clock3 size={21} className="muted" /></div><div className="form-body"><div className="form-grid"><Field label={translate("Temps d’ouverture")} name="opening_min" value={r.opening_min} onChange={change} unit={translate("min")} disabled={!canWrite} /><Field label={translate("Arrêts planifiés")} name="planned_min" value={r.planned_min} onChange={change} unit={translate("min")} disabled={!canWrite || r.timeline_complete} /><Auto label={translate("Temps requis")} value={num(c.required, 1)} unit={translate("min")} /></div><div className="loss-heading"><div><span className="eyebrow">{translate("PERTES DE DISPONIBILITÉ")}</span><h3>{translate("Où part le temps ?")}</h3></div><span className="loss-subtotal">{num(unplannedMinutes(r), 1)} <small>{translate("min de pertes")}</small></span></div><p className="loss-help">{translate("Renseignez chaque durée une seule fois. Le journal détaillé remplit ces champs automatiquement.")}</p><div className="loss-grid">{UNPLANNED_TYPES.map(([key, type]) => <div className="loss-field" key={key} style={{"--loss-color":type.color}}><Field label={type.label} name={type.field} value={r[type.field] ?? 0} onChange={change} unit={translate("min")} disabled={!canWrite || r.timeline_complete} /></div>)}</div><div className="time-balance" aria-hidden="true">{[["planned", r.planned_min],["loss",unplannedMinutes(r)],["run",c.runtime]].map(([key,value]) => <span key={key} className={key} style={{width: `${r.opening_min > 0 ? Math.max(0, Math.min(100, value / r.opening_min * 100)) : 0}%`}} />)}</div><div className="machine-time"><span><Clock3 size={17} />{translate("Temps machine calculé")}</span><strong>{num(c.runtime, 1)} <small>{translate("min")}</small></strong></div></div></section>
 <StopJournal record={r} onChange={update} disabled={!canWrite} />
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">{translate("03 / QUANTITÉS & MAIN-D’ŒUVRE")}</span><h2>{translate("La production réalisée")}</h2></div><Boxes size={21} className="muted" /></div><div className="form-body"><div className="form-grid"><Field label={translate("Quantité planifiée")} name="planned_qty" value={r.planned_qty ?? ""} onChange={change} unit={translate("pcs")} integer required={false} disabled={!canWrite} /><Field label={translate("Quantité conforme")} name="good_qty" value={r.good_qty} onChange={change} unit={translate("pcs")} integer disabled={!canWrite} /><Field label={translate("Rebuts démarrage / réglage")} name="startup_rejects" value={r.startup_rejects} onChange={change} unit={translate("pcs")} integer disabled={!canWrite} /><Field label={translate("Rebuts production")} name="production_rejects" value={r.production_rejects} onChange={change} unit={translate("pcs")} integer disabled={!canWrite} /><Auto label={translate("Quantité totale")} value={num(c.total)} unit={translate("pcs")} /><Auto label={translate("Temps standard")} value={num(standard, 3)} unit={translate("s / pièce")} /><Field label={translate("Heures dépensées")} name="labor_hours" value={r.labor_hours} onChange={change} unit={translate("h")} disabled={!canWrite} /></div><p className="field-help"><Info size={14} />{translate("Les heures dépensées correspondent au temps de main-d’œuvre total affecté à ce relevé.")}</p><label className="field"><span>{translate("Commentaire du poste ")}<small>{translate("facultatif")}</small></span><textarea value={r.notes} maxLength={4000} disabled={!canWrite} onChange={e => change("notes", e.target.value)} placeholder={translate("Incident, réglage particulier, point à partager en réunion…")} rows={3} /></label></div></section></div>
 <aside className="entry-summary"><section className="panel"><div className="summary-top"><span className="eyebrow">{translate("CALCUL EN DIRECT")}</span><h2>{translate("Votre poste en un regard")}</h2><span className="summary-trs">{percent(c.trs)}</span><p>{translate("Taux de rendement synthétique")}</p></div><div className="summary-ratios">{[[translate("Disponibilité"), c.availability], [translate("Performance"), c.performance], [translate("Qualité"), c.quality], [translate("DLE"), c.dle]].map(([label, v]) => <div key={label}><span>{translate(label)}</span><strong>{percent(v)}</strong></div>)}<div><span>{translate("Quantité planifiée")}</span><strong>{num(record.planned_qty)}{translate(" pcs")}</strong></div><div><span>{translate("Réalisation du plan")}</span><strong>{percent(record.planned_qty > 0 ? r.good_qty / record.planned_qty : null)}</strong></div><div><span>{translate("Recette")}</span><strong>{num(c.earned, 2)}{translate(" h")}</strong></div></div><div className="summary-help"><LockKeyhole size={17} /><p>{translate("Les champs gris se calculent automatiquement à chaque modification.")}</p></div>{c.performance > 1 && <div className="entry-warning"><AlertTriangle size={18} /><p>{translate("Performance supérieure à 100 %. Vérifiez la quantité et le cycle théorique.")}</p></div>}{c.required === 0 && <div className="entry-warning"><Info size={18} /><p>{translate("Poste sans temps requis : le TRS est non calculable.")}</p></div>}<div className="save-area">{draftError && <p className="error" role="alert">{translate(draftError)}</p>}{dirty && draftSaved && <p className="draft-status">{translate("Brouillon conservé sur cet appareil. Il reste à enregistrer le relevé.")}</p>}{errors.length > 0 && <div className="error" role="alert">{errors.map((e, i) => <p key={i}>{translate(e)}</p>)}</div>}<button className="btn primary save-button" type="submit" disabled={busy || !canWrite}><Save size={18} />{busy ? translate("Enregistrement…") : editing ? translate("Enregistrer les modifications") : translate("Enregistrer le relevé")}</button><small>{canWrite ? dirty ? translate("Modifications non enregistrées") : translate("Prêt pour votre saisie") : translate("Accès en consultation uniquement")}</small></div></section><div className="input-legend"><span><i />{translate("Saisie manuelle")}</span><span><i className="gray" />{translate("Calcul automatique")}</span></div></aside></form>;
}
