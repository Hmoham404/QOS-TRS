import { t as translate } from "./i18n.js";
import React from "react";
import { clockLabel } from "./analytics";
import { dateLabel } from "./domain";
import { shiftDate } from "./daily";
export default function StopTimeInput({
  record,
  event,
  index,
  kind,
  mode,
  disabled,
  onChange
}) {
  const isStart = kind === "start_min",
    label = isStart ? translate("Début") : translate("Fin");
  const [h, m] = (record.shift_start || "00:00").split(":").map(Number),
    base = h * 60 + m;
  const offset = Number(event[kind]) || 0,
    absolute = base + offset,
    day = Math.floor(absolute / 1440);
  function setClock(value, nextDay = day) {
    if (!value) {
      onChange("");
      return;
    }
    const [hour, minute] = value.split(":").map(Number);
    onChange(hour * 60 + minute + nextDay * 1440 - base);
  }
  const clock = event[kind] === "" ? "" : clockLabel(record.shift_start, offset).slice(0, 5);
  if (mode === "minutes") return <label className="field"><span>{translate(label)}{translate(" (min)")}</span><input aria-label={translate("{0} arrêt {1}", [label, index + 1])} type="number" min="0" max={record.opening_min} step="any" value={event[kind]} disabled={disabled} required onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))} /></label>;
  return <div className="field stop-clock-input"><label><span>{translate(label)}</span><input type="time" required aria-label={translate("Heure de {0} arrêt {1}", [isStart ? "début" : "fin", index + 1])} value={clock} disabled={disabled} onChange={e => setClock(e.target.value)} /></label><select aria-label={translate("Jour de {0} arrêt {1}", [isStart ? "début" : "fin", index + 1])} value={Math.max(0, day)} disabled={disabled} onChange={e => setClock(clock, Number(e.target.value))}><option value="0">{record.date ? dateLabel(record.date) : translate("Jour du poste")}{translate(" · J")}</option><option value="1">{record.date ? dateLabel(shiftDate(record.date, 1)) : translate("Lendemain")}{translate(" · J+1")}</option></select></div>;
}
