import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data.js';
import { detectLanguage, spanishCountries, readLanguagePreference, saveLanguagePreference } from '../src/locale.js';
import { localizeCatalog } from '../src/i18n.js';
import { english } from '../src/translations-en.js';
import { searchRisks } from '../src/model.js';

test('language priority is saved preference, country, then weighted browser languages', () => {
  for (const country of spanishCountries) assert.equal(detectLanguage({ country, browserLanguage: 'en-US' }), 'es');
  assert.equal(detectLanguage({ country: 'US', acceptLanguage: 'es-SV' }), 'en');
  assert.equal(detectLanguage({ country: 'SV', savedLanguage: 'en' }), 'en');
  assert.equal(detectLanguage({ country: 'US', savedLanguage: 'es' }), 'es');
  assert.equal(detectLanguage({ acceptLanguage: 'en;q=0.5, es-SV;q=0.9' }), 'es');
  assert.equal(detectLanguage({ acceptLanguage: 'es;q=0, en;q=1' }), 'en');
  assert.equal(detectLanguage({ browserLanguage: 'es-MX' }), 'es');
  assert.equal(detectLanguage({ browserLanguage: 'fr-FR' }), 'en');
  assert.equal(detectLanguage(), 'en');
});

test('manual preference persists and blocked storage does not break language switching', () => {
  const values = new Map();
  const window = { localStorage: { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) } };
  saveLanguagePreference(window, 'es');
  assert.equal(readLanguagePreference(window), 'es');
  const blocked = { get localStorage() { throw new Error('blocked'); } };
  assert.doesNotThrow(() => saveLanguagePreference(blocked, 'es'));
  assert.equal(readLanguagePreference(blocked), null);
});

test('every description, status, change, summary, prevention and relationship has an English translation', () => {
  for (const family of Object.values(catalog.families)) {
    const copy = [family.description, family.shortLabel, ...family.edges.map((e) => e.note)];
    for (const edition of family.editions) {
      copy.push(edition.status);
      for (const risk of edition.items) copy.push(risk.summary, risk.change, ...risk.prevention);
    }
    for (const text of copy.filter(Boolean)) assert.ok(english[text], `Missing: ${text}`);
  }
  const localized = localizeCatalog(catalog, 'en');
  assert.ok(searchRisks(localized, 'untrusted', 'web').length);
  assert.equal(catalog.families.web.shortLabel, 'Aplicaciones web');
  assert.equal(localized.families.web.shortLabel, 'Web applications');
});
