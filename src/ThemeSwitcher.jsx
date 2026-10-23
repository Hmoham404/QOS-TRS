import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getTheme, setTheme, subscribeTheme } from './theme.js';
import { t as translate } from './i18n.js';

export default function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'light');
  return <div className="theme-switcher" role="group" aria-label={translate('Apparence')}>
    {[
      { value: 'light', label: 'Mode jour', short: 'Jour', Icon: Sun },
      { value: 'dark', label: 'Mode nuit', short: 'Nuit', Icon: Moon },
    ].map(({ value, label, short, Icon }) => <button key={value} type="button"
      aria-label={translate(label)} title={translate(label)} aria-pressed={theme === value}
      onClick={() => setTheme(value)}>
      <Icon size={16} aria-hidden="true" /><span>{translate(short)}</span>
    </button>)}
  </div>;
}
