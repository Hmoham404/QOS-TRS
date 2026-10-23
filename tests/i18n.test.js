import test from 'node:test';
import assert from 'node:assert/strict';
import messages from '../src/locales/messages.js';
import { getLanguage, getLocale, setLanguage, t } from '../src/i18n.js';
import { SHIFTS, formatNumber } from '../src/domain.js';

test('Les cinq langues couvrent le catalogue, les variables et les nombres sans modifier les postes stockés', () => {
  assert.ok(Object.keys(messages).length > 600);
  for (const [key, translations] of Object.entries(messages)) {
    for (const language of ['en','ar','it','zh']) {
      assert.equal(typeof translations[language], 'string', `${key}: ${language}`);
      assert.ok(translations[language].trim(), `${key}: ${language}`);
    }
  }
  for (const language of ['fr','en','ar','it','zh']) {
    setLanguage(language);
    assert.equal(getLanguage(), language);
    assert.equal(t('Presse'), language === 'fr' ? 'Presse' : messages.Presse[language]);
    assert.equal(formatNumber(1234.5,1), new Intl.NumberFormat(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(1234.5));
    assert.ok(t('{0} conformes / {1} planifiées', [12,20]).includes('12'));
    assert.deepEqual(SHIFTS, ['Matin','Après-Midi','Nuit']);
  }
  setLanguage('fr');
  assert.equal(t('  Aucune donnée dans ce département  '), '  Aucune donnée dans ce département  ');
  assert.equal(t(null),null);
});
