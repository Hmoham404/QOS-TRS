import React from 'react';
import { ClipboardPenLine } from 'lucide-react';
import { t as translate } from './i18n.js';
export function IconButton({
  children,
  label,
  ...props
}) {
  return <button type="button" className="icon-button" aria-label={translate(label)} title={translate(label)} {...props}>{children}</button>;
}
export function Empty({
  title = translate("Aucun relevé sur cette période"),
  text = translate("Modifiez les filtres ou ajoutez une saisie de production."),
  children
}) {
  return <div className="empty"><div className="empty-icon"><ClipboardPenLine size={28} /></div><h3>{translate(title)}</h3><p>{translate(text)}</p>{children}</div>;
}
export function Badge({
  value,
  target = .85
}) {
  return <span className={`badge ${value == null ? "neutral" : value > 1 ? "warning" : value >= target ? "success" : "warning"}`}>{value == null ? translate("Non calculable") : value > 1 ? translate("À vérifier") : value >= target ? translate("Objectif atteint") : translate("Sous objectif")}</span>;
}
