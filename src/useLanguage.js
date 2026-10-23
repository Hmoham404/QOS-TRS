import { useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage } from './i18n.js';
export default function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage, () => 'fr');
}
