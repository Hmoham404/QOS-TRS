import { t as translate } from "./i18n.js";
import React from "react";
import { listDrafts } from "./drafts";
import { dataScope } from "./data";
export default function DraftList({
  onResume
}) {
  const drafts = listDrafts(dataScope);
  if (!drafts.length) return null;
  return <details className="draft-list"><summary>{translate("Brouillons sur cet appareil (")}{drafts.length})</summary><p>{translate("Ces saisies ne sont pas encore enregistrées dans l’atelier.")}</p>{drafts.map(d => <button className="btn" key={d.key} type="button" onClick={() => onResume(d)}>{translate("Reprendre · ")}{d.record.date} · {translate(d.record.shift)}{d.editing ? translate(" · modification") : ""}</button>)}</details>;
}
