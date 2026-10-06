import { english } from './translations-en.js';

const ui = {
  'Cambiar tamaño del panel': 'Resize panel',
  'Exportar': 'Export',
  'Markdown · detalle': 'Markdown · detail',
  'No se pudo exportar. Inténtalo de nuevo.': 'Export failed. Please try again.',
  'Explorador interactivo de la evolución del OWASP Top 10 para aplicaciones web y sistemas GenAI/LLM.': 'Interactive explorer of OWASP Top 10 evolution for web applications and GenAI/LLM systems.',
  'Saltar al explorador': 'Skip to explorer',
  'OWASP Evolution, inicio': 'OWASP Evolution, home',
  'Familia de riesgos': 'Risk family',
  'Herramientas del explorador': 'Explorer tools',
  'Buscar categoría, identificador o concepto': 'Search category, identifier or concept',
  'Buscar categorías': 'Search categories',
  'Leyenda de relaciones': 'Relationship legend',
  'Continúa / se mueve': 'Continues / moves',
  'Se renombra': 'Renamed',
  'Se fusiona / amplía': 'Merged / expanded',
  'Renombra': 'Renamed',
  'Fusiona': 'Merged',
  'Matriz de evolución de categorías': 'Category evolution matrix',
  'Detalle': 'Detail',
  'Idioma': 'Language',
  'Tema': 'Theme',
  'Sistema': 'System',
  'Oscuro': 'Dark',
  'Claro': 'Light',
  'Ediciones': 'Editions',
  'Mantén al menos una edición visible.': 'Keep at least one edition visible.',
  'Ediciones visibles': 'Visible editions',
  '← Volver': '← Back',
  'Volver a la matriz': 'Back to matrix',
  'Cerrar': 'Close',
  'Cerrar detalle': 'Close details',
  'Prevención prioritaria': 'Priority prevention',
  'Linaje en el tiempo': 'Lineage over time',
  'Sin cambio documentado': 'No documented change',
  'Categoría sin predecesor o sucesor directo en las ediciones incluidas.': 'Category with no direct predecessor or successor in the included editions.',
  'Relaciones': 'Relationships',
  'No hay una relación directa documentada en las ediciones incluidas.': 'No direct relationship is documented in the included editions.',
  'Nueva en': 'New in',
  'Sale en': 'Leaves in',
  'Abrir fuente oficial ↗': 'Open official source ↗',
  'No se encontraron categorías.': 'No categories found.',
  'Continúa': 'Continues',
  'Cambia de posición': 'Moves',
  'Renombrada': 'Renamed',
  'Fusionada': 'Merged',
  'Ampliada': 'Expanded',
  'Consolidada': 'Consolidated',
  'Nueva': 'New',
  'Sale del Top 10': 'Leaves the Top 10',
};

export function translate(text, language) {
  return language === 'en' ? ui[text] ?? english[text] ?? text : text;
}

export function localizeCatalog(catalog, language) {
  const t = (text) => translate(text, language);
  return {
    ...catalog,
    families: Object.fromEntries(Object.entries(catalog.families).map(([id, family]) => [id, {
      ...family, label: t(family.label), shortLabel: t(family.shortLabel), description: t(family.description),
      editions: family.editions.map((edition) => ({ ...edition, status: t(edition.status), items: edition.items.map((risk) => ({
        ...risk, summary: t(risk.summary), prevention: risk.prevention.map(t), change: t(risk.change),
      })) })),
      edges: family.edges.map((edge) => ({ ...edge, note: t(edge.note) })),
    }])),
  };
}

// Capture static copy once, before the application creates dynamic content.
export function staticTranslator(document) {
  const entries = [];
  const reverse = new Map(Object.entries({ ...english, ...ui }).map(([source, translated]) => [translated, source]));
  const walker = document.createTreeWalker(document.body, 4);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('script, #language-select, #prerender, noscript')) continue;
    const original = node.textContent.replace(node.textContent.trim(), reverse.get(node.textContent.trim()) ?? node.textContent.trim());
    if (original.trim()) entries.push((language) => { node.textContent = original.replace(original.trim(), translate(original.trim(), language)); });
  }
  for (const element of document.querySelectorAll('[aria-label], [placeholder], meta[name="description"]')) {
    for (const attribute of ['aria-label', 'placeholder', 'content']) {
      if (!element.hasAttribute(attribute)) continue;
      const value = element.getAttribute(attribute);
      const original = reverse.get(value) ?? value;
      entries.push((language) => element.setAttribute(attribute, translate(original, language)));
    }
  }
  return (language) => { document.documentElement.lang = language; entries.forEach((apply) => apply(language)); };
}
