import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { t } from './i18n.js';

export default function ComparisonScope({ group, value, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null), trigger = useRef(null);
  const id = useId();
  const options = [{ id: '', name: 'Total du département' }, ...group.activities];
  const selected = options.find(option => option.id === value) || options[0];
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector('[role=option][aria-selected=true]')?.focus();
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const navigate = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    if (event.key === 'Tab') setOpen(false);
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...root.current.querySelectorAll('[role=option]')];
    const current = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  return <div className="comparison-scope-selector" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <h3 aria-label={t(group.name)}><button type="button" ref={trigger} className="comparison-scope-trigger" aria-label={t('Choisir une activité · {0}', [t(group.name)])} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={() => setOpen(current => !current)} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}><span>{t(group.name)}</span><ChevronDown size={19}/></button></h3>
    <span className="comparison-scope-current">{t(selected.name)}</span>
    {open && <div id={id} role="listbox" aria-label={t('Activités · {0}', [t(group.name)])} className="comparison-scope-options" onKeyDown={navigate}>{options.map(option => <button type="button" role="option" key={option.id} aria-selected={value === option.id} onClick={() => { onChange(option.id); setOpen(false); trigger.current?.focus(); }}><span>{t(option.name)}</span>{value === option.id && <Check size={16}/>}</button>)}</div>}
  </div>;
}
