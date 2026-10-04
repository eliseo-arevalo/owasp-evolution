// ISO country codes where Spanish is an official national language (plus Puerto Rico).
export const spanishCountries = new Set('AR BO CL CO CR CU DO EC ES GQ GT HN MX NI PA PE PR PY SV UY VE'.split(' '));

export function detectLanguage({ country, acceptLanguage = '', browserLanguage = 'en', savedLanguage } = {}) {
  if (savedLanguage === 'es' || savedLanguage === 'en') return savedLanguage;
  if (country?.trim()) return spanishCountries.has(country.trim().toUpperCase()) ? 'es' : 'en';
  const preferences = (acceptLanguage || browserLanguage).split(',').map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(';');
    const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
    return { tag: tag.toLowerCase(), quality: quality ? Number(quality.trim().slice(2)) : 1, index };
  }).filter((entry) => entry.quality > 0).sort((a, b) => b.quality - a.quality || a.index - b.index);
  return preferences[0]?.tag.split('-')[0] === 'es' ? 'es' : 'en';
}

export function readLanguagePreference(storage) {
  try { return storage.localStorage.getItem('owasp-language'); } catch { return null; }
}

export function saveLanguagePreference(storage, language) {
  try { storage.localStorage.setItem('owasp-language', language); } catch { /* Private browsing may disable storage. */ }
}
