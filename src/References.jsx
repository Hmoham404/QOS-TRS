import { t as translate } from "./i18n.js";
import React, { useState, useRef, useEffect } from "react";
import { Factory, Plus, X, Boxes, Pencil, Search, Save } from "lucide-react";
import { saveReference } from "./data";
import { formatNumber as num } from "./domain";
import { IconButton, Empty } from "./App";
export default function References({
  data,
  canEdit,
  refresh,
  notify
}) {
  const [tab, setTab] = useState("presses"),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  const filtered = data[tab].filter(p => [p.name, p.code].join(" ").toLowerCase().includes(search.toLowerCase()));
  useEffect(() => {
    if (editing) dialog.current?.showModal();else dialog.current?.close();
  }, [editing?.id]);
  function open(item) {
    setError("");
    setEditing(item || (tab === "presses" ? {
      id: crypto.randomUUID(),
      name: "",
      active: true
    } : {
      id: crypto.randomUUID(),
      name: "",
      code: "",
      cavities: 8,
      mold_cycle_seconds: 30,
      standard_seconds: 3.75,
      active: true
    }));
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const item = {
        ...editing,
        name: editing.name.trim()
      };
      if (!item.name) throw new Error("Le nom est obligatoire.");
      if (tab === "articles") {
        item.code = item.code.trim();
        if (!item.code || !Number.isInteger(item.cavities) || item.cavities < 1 || !(item.mold_cycle_seconds > 0) || !(item.standard_seconds > 0)) throw new Error("Vérifiez le code, les empreintes et les temps.");
      }
      await saveReference(tab, item);
      await refresh();
      setEditing(null);
      notify(tab === "presses" ? translate("Presse enregistrée.") : translate("Article enregistré."));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return <><section className="reference-toolbar"><div className="tabs"><button className={tab === "presses" ? "selected" : ""} onClick={() => {
          setTab("presses");
          setSearch("");
        }}><Factory size={17} />{translate("Presses ")}<span>{data.presses.length}</span></button><button className={tab === "articles" ? "selected" : ""} onClick={() => {
          setTab("articles");
          setSearch("");
        }}><Boxes size={17} />{translate("Moules & articles ")}<span>{data.articles.length}</span></button></div><div className="inline-actions"><input aria-label={translate("Rechercher une référence")} placeholder={translate("Rechercher…")} value={search} onChange={e => setSearch(e.target.value)} />{canEdit && <button className="btn primary" onClick={() => open()}><Plus size={17} />{tab === "presses" ? translate("Ajouter une presse") : translate("Ajouter un article")}</button>}</div></section>{!filtered.length ? <section className="panel"><Empty title={translate("Aucune référence trouvée")} text={translate("Ajoutez une référence ou modifiez votre recherche.")} /></section> : <div className={`reference-grid ${tab === "articles" ? "articles-grid" : ""}`}>{filtered.map(item => <section className={`panel reference-card ${!item.active ? "archived" : ""}`} key={item.id}><div className="reference-top"><span className="reference-icon">{tab === "presses" ? <Factory size={25} /> : <Boxes size={25} />}</span><span className={`badge ${item.active ? "success" : "neutral"}`}>{item.active ? translate("Disponible") : translate("Archivée")}</span>{canEdit && <IconButton label={translate("Modifier ") + item.name} onClick={() => open(item)}><Pencil size={16} /></IconButton>}</div><span className="eyebrow">{tab === "presses" ? translate("PRESSE À INJECTER") : item.code}</span><h2>{item.name}</h2>{tab === "articles" ? <div className="reference-specs"><div><span>{translate("Empreintes")}</span><strong>{item.cavities}</strong></div><div><span>{translate("Cycle moule")}</span><strong>{num(item.mold_cycle_seconds, 2)}{translate(" s")}</strong></div><div><span>{translate("Cycle / pièce")}</span><strong>{num(item.mold_cycle_seconds / item.cavities, 3)}{translate(" s")}</strong></div><div><span>{translate("Standard / pièce")}</span><strong>{num(item.standard_seconds, 3)}{translate(" s")}</strong></div></div> : <div className="press-card-bottom"><span>{data.records.filter(r => r.press_id === item.id).length}{translate(" relevés enregistrés")}</span><small>{translate("ATELIER INJECTION")}</small></div>}</section>)}</div>}
 <dialog ref={dialog} className="reference-dialog" onCancel={e => {
      e.preventDefault();
      if (!busy) setEditing(null);
    }}>{editing && <form onSubmit={save}><div className="panel-heading"><h2>{data[tab].some(x => x.id === editing.id) ? translate("Modifier") : translate("Ajouter")} {tab === "presses" ? translate("une presse") : translate("un article")}</h2><IconButton label={translate("Fermer")} disabled={busy} onClick={() => setEditing(null)}><X size={20} /></IconButton></div><div className="dialog-body"><label className="field"><span>{tab === "presses" ? translate("Nom de la presse") : translate("Désignation article")}</span><input autoFocus required maxLength={tab === "presses" ? 80 : 160} value={editing.name} onChange={e => setEditing({
              ...editing,
              name: e.target.value
            })} placeholder={tab === "presses" ? translate("Ex. D320.1") : translate("Ex. Cover KIKO")} /></label>{tab === "articles" && <><label className="field"><span>{translate("Code moule / article")}</span><input required maxLength={80} value={editing.code} onChange={e => setEditing({
                ...editing,
                code: e.target.value
              })} /></label><div className="form-grid two">{[["cavities", translate("Nombre d’empreintes"), "1"], ["mold_cycle_seconds", translate("Cycle moule (s)"), "any"], ["standard_seconds", translate("Temps standard (s / pièce)"), "any"]].map(([key, label, step]) => <label className="field" key={key}><span>{translate(label)}</span><input type="number" min={key === "cavities" ? 1 : .000001} step={step} required value={editing[key]} onChange={e => setEditing({
                  ...editing,
                  [key]: e.target.value === "" ? "" : Number(e.target.value)
                })} /></label>)}<div className="auto-field"><span>{translate("Cycle calculé / pièce")}</span><strong>{editing.cavities ? num(editing.mold_cycle_seconds / editing.cavities, 3) : "—"}{translate(" s")}</strong></div></div><p className="field-help">{translate("Les changements de cycle s’appliquent aux futurs relevés. L’historique conserve ses valeurs.")}</p></>}<label className="checkbox-label"><input type="checkbox" checked={editing.active} onChange={e => setEditing({
              ...editing,
              active: e.target.checked
            })} />{translate("Disponible pour les nouvelles saisies")}</label><small>{translate("Décochez pour archiver cette référence sans supprimer l’historique.")}</small>{error && <p className="error" role="alert">{translate(error)}</p>}</div><div className="dialog-actions"><button type="button" className="btn" onClick={() => setEditing(null)} disabled={busy}>{translate("Annuler")}</button><button type="submit" className="btn primary" disabled={busy}><Save size={16} />{busy ? translate("Enregistrement…") : translate("Enregistrer")}</button></div></form>}</dialog></>;
}
