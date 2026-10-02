import { catalog } from './data.js';
import {
  flattenCatalog,
  searchRisks,
  getRisk,
  getEdition,
  getLineage,
  formatRoute,
  resolveRouteState,
  relationshipLabel,
} from './model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const elements = {
  familyNav: document.querySelector('#family-nav'),
  familyDescription: document.querySelector('#family-description'),
  timelineTitle: document.querySelector('#timeline-title'),
  timelineHelp: document.querySelector('#timeline-help'),
  timelineStage: document.querySelector('#timeline-stage'),
  timelineGrid: document.querySelector('#timeline-grid'),
  connectorLayer: document.querySelector('#connector-layer'),
  inspector: document.querySelector('#inspector'),
  search: document.querySelector('#risk-search'),
  searchResults: document.querySelector('#search-results'),
};

let currentRoute = resolveRouteState(location.hash, catalog).route;
let activeEdges = [];
let drawFrame = 0;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function navigate(route) {
  const nextHash = formatRoute(route);
  if (location.hash === nextHash) render();
  else location.hash = nextHash;
}

function renderFamilyNav() {
  elements.familyNav.replaceChildren();
  for (const family of Object.values(catalog.families)) {
    const button = node('button', 'family-tab', family.shortLabel);
    button.type = 'button';
    if (family.id === currentRoute.family) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => {
      const edition = family.editions.find((item) => item.year === family.defaultYear) ?? family.editions.at(-1);
      navigate({ family: family.id, year: edition.year, id: edition.items[0].id });
      elements.search.value = '';
      hideSearchResults();
    });
    elements.familyNav.append(button);
  }
}

function riskWithContext(family, edition, risk) {
  return {
    ...risk,
    family: family.id,
    year: edition.year,
    key: `${edition.year}:${risk.id}`,
  };
}

function renderTimeline(family, lineage) {
  elements.timelineGrid.replaceChildren();
  elements.timelineGrid.style.setProperty('--edition-count', family.editions.length);
  const relatedKeys = new Set(lineage.nodes.map((item) => item.key));
  const selectedKey = `${currentRoute.year}:${currentRoute.id}`;

  for (const edition of family.editions) {
    const column = node('section', 'edition-column');
    column.setAttribute('aria-labelledby', `edition-${family.id}-${edition.year}`);

    const header = node('header', 'edition-header');
    const meta = node('div', 'edition-meta');
    meta.append(node('span', '', `${edition.items.length} categorías`));
    const status = node('span', `edition-status${edition.status === 'Vigente' ? ' current' : ''}`, edition.status);
    meta.append(status);
    const year = node('h3', 'edition-year', String(edition.year));
    year.id = `edition-${family.id}-${edition.year}`;
    header.append(meta, year);

    const list = node('div', 'risk-list');
    for (const rawRisk of edition.items) {
      const risk = riskWithContext(family, edition, rawRisk);
      const button = node('button', 'risk-card');
      button.type = 'button';
      button.dataset.key = risk.key;
      button.setAttribute('aria-label', `${risk.id}: ${risk.name}, edición ${risk.year}`);

      if (risk.key === selectedKey) button.classList.add('is-selected');
      else if (relatedKeys.has(risk.key)) button.classList.add('is-related');
      else if (lineage.nodes.length > 1) button.classList.add('is-dimmed');

      const rank = node('span', 'risk-rank', String(risk.rank).padStart(2, '0'));
      const copy = node('span', 'risk-copy');
      copy.append(node('span', 'risk-name', risk.name));
      if (risk.change) copy.append(node('span', 'risk-change', risk.change));
      button.append(rank, copy);
      button.addEventListener('click', () => navigate({ family: family.id, year: edition.year, id: risk.id }));
      list.append(button);
    }

    column.append(header, list);
    elements.timelineGrid.append(column);
  }

  activeEdges = lineage.edges;
  scheduleConnections();
}

function renderInspector(family, risk, lineage) {
  elements.inspector.replaceChildren();
  const edition = getEdition(catalog, family.id, risk.year);

  const code = node('div', 'inspector-code');
  code.append(node('span', '', `${risk.id} · ${risk.year}`));
  if (edition.status === 'Vigente') code.append(node('span', 'inspector-current', 'Vigente'));

  const heading = node('h2', '', risk.name);
  const summary = node('p', 'inspector-summary', risk.summary);

  const prevention = node('section', 'inspector-section');
  prevention.append(node('h3', '', 'Prevención prioritaria'));
  const preventionList = node('ul');
  for (const item of risk.prevention) preventionList.append(node('li', '', item));
  prevention.append(preventionList);

  const history = node('section', 'inspector-section');
  history.append(node('h3', '', 'Linaje en el tiempo'));
  const historyList = node('ol', 'lineage-list');
  for (const item of lineage.nodes) {
    const entry = node('li', 'lineage-item');
    const year = node('span', 'lineage-year', String(item.year));
    const copy = node('span');
    copy.append(node('strong', '', `${item.id} · ${item.name}`));
    copy.append(node('span', '', item.change || 'Sin cambio documentado'));
    entry.append(year, copy);
    historyList.append(entry);
  }
  if (lineage.nodes.length === 1) {
    const entry = node('li', 'lineage-item');
    entry.append(node('span', 'lineage-year', String(risk.year)), node('span', '', risk.change || 'Categoría sin predecesor o sucesor directo en las ediciones incluidas.'));
    historyList.replaceChildren(entry);
  }
  history.append(historyList);

  const relations = node('section', 'inspector-section');
  relations.append(node('h3', '', 'Relaciones'));
  const relationList = node('ul');
  const relevantEdges = family.edges.filter((edge) => edge.from === risk.key || edge.to === risk.key);
  if (relevantEdges.length) {
    for (const edge of relevantEdges) {
      relationList.append(node('li', '', `${relationshipLabel(edge.type)}: ${edge.note}`));
    }
  } else {
    relationList.append(node('li', '', risk.change || 'No hay una relación directa documentada en las ediciones incluidas.'));
  }
  relations.append(relationList);

  const linkSection = node('section', 'inspector-section');
  const source = node('a', 'source-link', 'Abrir fuente oficial ↗');
  source.href = risk.source;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  linkSection.append(source);

  elements.inspector.append(code, heading, summary, prevention, history, relations, linkSection);
}

function scheduleConnections() {
  cancelAnimationFrame(drawFrame);
  drawFrame = requestAnimationFrame(drawConnections);
}

function drawConnections() {
  const stage = elements.timelineStage;
  const svg = elements.connectorLayer;
  svg.replaceChildren();
  const stageRect = stage.getBoundingClientRect();
  const width = stage.scrollWidth;
  const height = stage.scrollHeight;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  const cards = new Map([...stage.querySelectorAll('.risk-card')].map((card) => [card.dataset.key, card]));
  for (const edge of activeEdges) {
    const source = cards.get(edge.from);
    const target = cards.get(edge.to);
    if (!source || !target) continue;

    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const startX = sourceRect.right - stageRect.left;
    const startY = sourceRect.top - stageRect.top + sourceRect.height / 2;
    const endX = targetRect.left - stageRect.left;
    const endY = targetRect.top - stageRect.top + targetRect.height / 2;
    const distance = endX - startX;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M ${startX} ${startY} C ${startX + distance * .46} ${startY}, ${endX - distance * .46} ${endY}, ${endX} ${endY}`);
    path.classList.add(edge.type);
    svg.append(path);
  }
}

function renderSearchResults(query) {
  const familyId = currentRoute.family;
  const results = searchRisks(catalog, query, familyId).slice(0, 12);
  elements.searchResults.replaceChildren();

  if (!query.trim()) {
    hideSearchResults();
    return;
  }

  if (!results.length) {
    elements.searchResults.append(node('p', 'search-empty', 'No se encontraron categorías.'));
  } else {
    for (const result of results) {
      const button = node('button', 'search-result');
      button.type = 'button';
      button.append(
        node('span', 'search-result-id', result.id),
        node('span', 'search-result-name', result.name),
        node('span', 'search-result-year', String(result.year)),
      );
      button.addEventListener('click', () => {
        navigate({ family: result.family, year: result.year, id: result.id });
        elements.search.value = '';
        hideSearchResults();
      });
      elements.searchResults.append(button);
    }
  }
  elements.searchResults.hidden = false;
}

function hideSearchResults() {
  elements.searchResults.hidden = true;
}

function render() {
  const routeState = resolveRouteState(location.hash, catalog);
  currentRoute = routeState.route;
  if (routeState.changed) history.replaceState(null, '', routeState.canonicalHash);
  const family = catalog.families[currentRoute.family];
  const risk = getRisk(catalog, currentRoute.family, currentRoute.year, currentRoute.id);
  const selected = { ...risk, family: family.id, year: currentRoute.year, key: `${currentRoute.year}:${currentRoute.id}` };
  const lineage = getLineage(catalog, currentRoute.family, currentRoute.year, currentRoute.id);

  renderFamilyNav();
  elements.familyDescription.textContent = family.description;
  elements.timelineTitle.textContent = family.label;
  elements.timelineHelp.textContent = `${lineage.nodes.length} categoría${lineage.nodes.length === 1 ? '' : 's'} conectada${lineage.nodes.length === 1 ? '' : 's'} en ${family.editions.length} ediciones.`;
  renderTimeline(family, lineage);
  renderInspector(family, selected, lineage);
  document.title = `${selected.id} ${selected.name} · OWASP Evolution`;
}

elements.search.addEventListener('input', (event) => renderSearchResults(event.target.value));
elements.search.addEventListener('focus', () => renderSearchResults(elements.search.value));
document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-wrap')) hideSearchResults();
});
document.addEventListener('keydown', (event) => {
  const tag = document.activeElement?.tagName;
  if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
    event.preventDefault();
    elements.search.focus();
  }
  if (event.key === 'Escape') {
    elements.search.value = '';
    hideSearchResults();
    elements.search.blur();
  }
});
window.addEventListener('hashchange', render);
window.addEventListener('resize', scheduleConnections);
new ResizeObserver(scheduleConnections).observe(elements.timelineStage);

render();
