import { useEffect, useRef, useState } from "react";
import { Factory, ChevronDown, Check, Layers3, Flame, Sparkles, Palette } from "lucide-react";
import { t as translate } from "./i18n.js";
export const DEPARTMENTS = [{
  id: "injection",
  name: "Injection",
  icon: Factory
}, {
  id: "assembly",
  name: "Assemblage",
  icon: Layers3
}, {
  id: "welding",
  name: "Soudure",
  icon: Flame
}, {
  id: "metallization",
  name: "Métallisation",
  icon: Sparkles
}, {
  id: "screen-printing",
  name: "Sérigraphie",
  icon: Palette
}];
export function getSavedDepartment() {
  try {
    const saved = localStorage.getItem("qos-department");
    return DEPARTMENTS.some(item => item.id === saved) ? saved : "injection";
  } catch {
    return "injection";
  }
}
export default function DepartmentSwitcher({
  department,
  onChange
}) {
  const [open, setOpen] = useState(false),
    root = useRef(null),
    trigger = useRef(null);
  const selected = DEPARTMENTS.find(item => item.id === department),
    Icon = selected.icon;
  useEffect(() => {
    if (!open) return;
    const outside = event => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const key = event => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return <div className="department-switcher" ref={root}>
    <button className="workspace department-trigger" type="button" ref={trigger} aria-label={translate("Changer de département")} aria-expanded={open} aria-controls="department-options" onClick={() => setOpen(value => !value)}>
      <span className="workspace-icon"><Icon size={22} /></span><span className="department-current"><strong>{translate("Atelier")} {translate(selected.name)}</strong><small>{translate("Espace de production")}</small></span><ChevronDown size={16} />
    </button>
    {open && <div className="department-options" id="department-options" role="group" aria-label={translate("Choisir un département")}>
      <span className="department-caption">{translate("Département")}</span>
      {DEPARTMENTS.map(item => {
        const ItemIcon = item.icon;
        return <button type="button" key={item.id} aria-pressed={department === item.id} onClick={() => {
          onChange(item.id);
          setOpen(false);
          trigger.current?.focus();
        }}><ItemIcon size={18} /><span>{translate(item.name)}</span>{item.id === department && <Check size={16} />}</button>;
      })}
    </div>}
  </div>;
}
export function EmptyDepartment({
  department,
  onReturn
}) {
  const selected = DEPARTMENTS.find(item => item.id === department),
    Icon = selected.icon;
  return <section className="department-empty" aria-labelledby="department-empty-title">
    <div className="department-empty-mark"><Icon size={38} strokeWidth={1.4} /></div>
    <span className="eyebrow">{translate("Département sélectionné")} · {translate(selected.name)}</span>
    <h2 id="department-empty-title">{translate("Aucune donnée dans ce département")}</h2>
    <p>{translate("Cet espace est réservé à ce département. Ses relevés et ses équipements apparaîtront ici une fois configurés.")}</p>
    <button type="button" className="btn" onClick={onReturn}><Factory size={16} />{translate("Retour à Injection")}</button>
    <span className="department-empty-foot">QOS / {translate(selected.name)}</span>
  </section>;
}
