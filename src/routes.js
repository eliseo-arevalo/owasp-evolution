import { parseRoute, getRisk } from './model.js';
export const slug = (item) => `${item.id}-${item.name}`.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
export const languageOf = (path) => path.startsWith('/en/') || path === '/en' ? 'en' : 'es';
export function pathFor(route, data, language = 'es') {
  const prefix = language === 'en' ? '/en' : '';
  if (!route) return `${prefix}/`;
  const item = getRisk(data, route.family, route.year, route.id);
  return item ? `${prefix}/${route.family === 'llm' ? 'genai' : route.family}/${route.year}/${slug(item)}/` : `${prefix}/${route.family === 'llm' ? 'genai' : route.family}/`;
}
export function routeFrom(path, data, hash = '') {
  if (hash.startsWith('#/')) return parseRoute(hash, data);
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'en') parts.shift();
  if (parts[0] === 'genai') parts[0] = 'llm';
  const family = data.families[parts[0]] || data.families[data.defaultFamily];
  const edition = family.editions.find(e => e.year === Number(parts[1])) || family.editions.find(e => e.year === family.defaultYear);
  const item = edition.items.find(i => slug(i) === parts[2]) || edition.items[0];
  return { family: family.id, year: edition.year, id: item.id, detail: Boolean(parts[2]) };
}
