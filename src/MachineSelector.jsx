import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { formatNumber as num } from './domain.js';
import { t } from './i18n.js';

export default function MachineSelector({ presses, rows, records = rows, value, onChange, department }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null), trigger = useRef(null);
  const id = useId();
  const counts = new Map();
  for (const row of rows) counts.set(row.press_id, (counts.get(row.press_id) || 0) + 1);
  const recorded = new Set(records.map(row => row.press_id));
  const options = [{ id: '', name: t('Total · toutes les machines'), count: rows.length, recorded: records.length > 0 }, ...presses.map(press => ({ ...press, count: counts.get(press.id) || 0, recorded: recorded.has(press.id) }))];
  const selected = options.find(option => option.id === value) || options[0];
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector('[role="option"][aria-selected="true"]')?.focus();
    const close = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const choose = machine => { onChange(machine); setOpen(false); trigger.current?.focus(); };
  const navigate = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return; }
    if (event.key === 'Tab') { setOpen(false); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...root.current.querySelectorAll('[role="option"]')];
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  return <div ref={root} className="comparison-machine-selector" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className={`comparison-machine-trigger ${value && !selected.recorded ? 'without-records' : ''}`} aria-label={`${t('Machines')} · ${t(department)}`} aria-haspopup="listbox" aria-controls={id} aria-expanded={open} onClick={() => setOpen(current => !current)} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}><span>{selected.name}</span><ChevronDown size={16}/></button>
    {open && <div className="comparison-machine-menu"><div id={id} role="listbox" aria-label={`${t('Machines')} · ${t(department)}`} className="comparison-machine-options" onKeyDown={navigate}>{options.map(option => <button type="button" key={option.id} role="option" aria-selected={value === option.id} data-machine-id={option.id} data-has-records={option.recorded} className={option.id ? 'comparison-machine-option' : 'comparison-machine-option total'} onClick={() => choose(option.id)}><span>{option.name}<small>{num(option.count)} {t('relevés')}</small></span>{value === option.id && <Check size={15}/>}</button>)}</div><p>{t('En gras : machines avec une saisie enregistrée.')}</p></div>}
  </div>;
}
