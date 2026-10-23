import messages from './locales/messages.js';

export const LANGUAGES = [
  { code: 'fr', short: 'FR', name: 'Français', locale: 'fr-FR' },
  { code: 'ar', short: 'AR', name: 'العربية', locale: 'ar' },
  { code: 'en', short: 'EN', name: 'English', locale: 'en-GB' },
  { code: 'it', short: 'IT', name: 'Italiano', locale: 'it-IT' },
  { code: 'zh', short: 'ZH', name: '中文', locale: 'zh-CN' },
];
let language = 'fr';
try {
  const saved = globalThis.localStorage?.getItem('qos-language');
  if (LANGUAGES.some(item => item.code === saved)) language = saved;
} catch { /* The dashboard remains available without preference storage. */ }
const listeners = new Set();
const originalMessages = new Map();
const messagePatterns = [];
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [key, translations] of Object.entries(messages)) {
  for (const text of Object.values(translations)) if (!originalMessages.has(text)) originalMessages.set(text, key);
  if (!/\{\d+\}/.test(key)) continue;
  for (const text of [key, ...Object.values(translations)]) {
    const slots = [], parts = text.split(/(\{\d+\})/);
    const pattern = parts.map(part => {
      if (!/^\{\d+\}$/.test(part)) return escapePattern(part);
      slots.push(Number(part.slice(1,-1))); return '(.*?)';
    }).join('');
    messagePatterns.push({ key, slots, expression: new RegExp('^' + pattern + '$') });
  }
}
export const getLanguage = () => language;
export const getLocale = () => LANGUAGES.find(item => item.code === language).locale;
export const subscribeLanguage = listener => { listeners.add(listener); return () => listeners.delete(listener); };
function applyDocumentLanguage() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
}
export function setLanguage(next) {
  if (!LANGUAGES.some(item => item.code === next) || next === language) return;
  language = next;
  try { globalThis.localStorage?.setItem('qos-language', next); } catch { /* Session preference still applies. */ }
  applyDocumentLanguage();
  listeners.forEach(listener => listener());
}
export function t(source, values = []) {
  if (typeof source !== 'string') return source;
  let key = source.replace(/\s+/g, ' ').trim();
  if (!key) return source;
  if (!Object.hasOwn(messages, key)) {
    if (originalMessages.has(key)) key = originalMessages.get(key);
    else for (const pattern of messagePatterns) {
      const match = pattern.expression.exec(key);
      if (!match) continue;
      const inferred = [];
      pattern.slots.forEach((slot,index) => { inferred[slot] = match[index + 1]; });
      key = pattern.key; values = inferred; break;
    }
  }
  const translated = language === 'fr' ? key : messages[key]?.[language] ?? key;
  const leading = source.match(/^\s*/)[0];
  const trailing = source.match(/\s*$/)[0];
  return leading + translated.replace(/\{(\d+)\}/g, (_, index) => {
    const value = values[index];
    // Shift values stay stable in storage and are translated only for display.
    return String(['Matin', 'Après-Midi', 'Nuit', 'début', 'fin', 'Début', 'Fin'].includes(value) ? t(value) : value ?? '');
  }) + trailing;
}
applyDocumentLanguage();
