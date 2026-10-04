import { detectLanguage, readLanguagePreference, saveLanguagePreference } from './locale.js';
import { localizeCatalog, translate, staticTranslator } from './i18n.js';
import { defaultVisibleYears, visibleEditions, visibleConnections } from './editions.js';
import { catalog as sourceCatalog } from './data.js';
import { resetScrollPosition, scheduleFocus, shouldRefocusWithin } from './focus.js';
import {
  searchRisks,
  getRisk,
  getEdition,
  getLineage,
  formatRoute,
  resolveRouteState,
  relationshipLabel,
} from './model.js';

const applyStaticLanguage = staticTranslator(document);
const serverLanguage = document.querySelector('meta[name="owasp-language"]')?.content;
let language = detectLanguage({
  savedLanguage: readLanguagePreference(window),
  browserLanguage: ['en', 'es'].includes(serverLanguage) ? serverLanguage : navigator.language,
});
let catalog = localizeCatalog(sourceCatalog, language);
const t = (text) => translate(text, language);
const yearFilters = new Map(Object.values(catalog.families).map((family) => [family.id, new Set(defaultVisibleYears(family))]));

const SVG_NS = 'http://www.w3.org/2000/svg';
const elements = {
  brand: document.querySelector('.brand'),
  familyNav: document.querySelector('#family-nav'),
  familyDescription: document.querySelector('#family-description'),
  timelineTitle: document.querySelector('#timeline-title'),
  timelineHelp: document.querySelector('#timeline-help'),
  openInspector: document.querySelector('#open-inspector'),
  detailTriggerLabel: document.querySelector('#detail-trigger-label'),
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
let inspectorOpen = false;
let focusInspectorAfterRender = false;
let resolveInspectorReturn = () => elements.openInspector;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function syncInspectorVisibility({ focus = false } = {}) {
  elements.inspector.classList.toggle('is-open', inspectorOpen);
  elements.inspector.setAttribute('aria-hidden', String(!inspectorOpen));
  elements.openInspector.setAttribute('aria-expanded', String(inspectorOpen));
  elements.inspector.inert = !inspectorOpen;
  if (focus && inspectorOpen) {
    resetScrollPosition(elements.inspector);
    scheduleFocus(
      () => elements.inspector.querySelector('.inspector-close'),
      () => elements.inspector,
    );
  }
}

function setInspectorOpen(open, {
  focus = false,
  restoreFocus = true,
  returnFocus,
} = {}) {
  inspectorOpen = open;
  if (open && returnFocus) resolveInspectorReturn = returnFocus;
  syncInspectorVisibility({ focus });
  if (!open && restoreFocus) {
    scheduleFocus(resolveInspectorReturn, () => elements.openInspector);
  }
}

function navigate(route, {
  openInspector = inspectorOpen,
  returnFocus,
} = {}) {
  inspectorOpen = openInspector;
  focusInspectorAfterRender = openInspector;
  if (openInspector && returnFocus) resolveInspectorReturn = returnFocus;
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
      const editions = visibleEditions(family, yearFilters.get(family.id));
      const edition = editions.find((item) => item.year === family.defaultYear) ?? editions.at(-1);
      navigate({ family: family.id, year: edition.year, id: edition.items[0].id }, { openInspector: false });
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
  const years = yearFilters.get(family.id);
  const editions = visibleEditions(family, years);
  elements.timelineGrid.replaceChildren();
  elements.timelineGrid.style.setProperty('--edition-count', editions.length);
  elements.timelineGrid.dataset.editions = String(editions.length);
  const relatedKeys = new Set(lineage.nodes.map((item) => item.key));
  const selectedKey = `${currentRoute.year}:${currentRoute.id}`;

  for (const edition of editions) {
    const column = node('section', 'edition-column');
    column.setAttribute('aria-labelledby', `edition-${family.id}-${edition.year}`);

    const header = node('header', 'edition-header');
    const meta = node('div', 'edition-meta');
    meta.append(node('span', '', `${edition.items.length} ${language === 'es' ? 'categorías' : 'categories'}`));
    const status = node('span', `edition-status${edition.status === t('Vigente') ? ' current' : ''}`, edition.status);
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
      button.setAttribute('aria-label', `${risk.id}: ${risk.name}, ${language === 'es' ? 'edición' : 'edition'} ${risk.year}`);
      button.setAttribute('aria-controls', 'inspector');
      button.setAttribute('aria-haspopup', 'dialog');
      button.title = risk.change || `${risk.id} · ${risk.name}`;

      if (risk.key === selectedKey) button.classList.add('is-selected');
      else if (relatedKeys.has(risk.key)) button.classList.add('is-related');
      else if (lineage.nodes.length > 1) button.classList.add('is-dimmed');

      const rank = node('span', 'risk-rank', String(risk.rank).padStart(2, '0'));
      const copy = node('span', 'risk-copy');
      copy.append(node('span', 'risk-name', risk.name));
      if (risk.change) copy.append(node('span', 'risk-change', risk.change));
      button.append(rank, copy);
      button.addEventListener('click', () => navigate(
        { family: family.id, year: edition.year, id: risk.id },
        {
          openInspector: true,
          returnFocus: () => elements.timelineStage.querySelector(`[data-key="${risk.key}"]`),
        },
      ));
      list.append(button);
    }

    column.append(header, list);
    elements.timelineGrid.append(column);
  }

  activeEdges = visibleConnections(family, years, lineage.edges);
  scheduleConnections();
}

function renderEditionFilter(family) {
  const options = document.querySelector('#edition-options');
  options.replaceChildren();
  const years = yearFilters.get(family.id);
  for (const edition of family.editions) {
    const label = node('label');
    const input = node('input');
    input.type = 'checkbox';
    input.checked = years.has(edition.year);
    input.disabled = input.checked && years.size === 1;
    input.addEventListener('change', () => {
      if (input.checked) years.add(edition.year);
      else years.delete(edition.year);
      if (!years.has(currentRoute.year)) {
        const replacement = visibleEditions(family, years).at(-1);
        navigate({ family: family.id, year: replacement.year, id: replacement.items[0].id }, { openInspector: false });
      } else render();
      scheduleFocus(() => document.querySelector(`#edition-options input[value="${edition.year}"]`));
    });
    input.value = edition.year;
    label.append(input, node('span', '', String(edition.year)));
    options.append(label);
  }
}

function renderInspector(family, risk, lineage) {
  elements.inspector.replaceChildren();
  const edition = getEdition(catalog, family.id, risk.year);

  const top = node('div', 'inspector-top');
  const code = node('div', 'inspector-code');
  code.append(node('span', '', `${risk.id} · ${risk.year}`));
  if (edition.status === t('Vigente')) code.append(node('span', 'inspector-current', t('Vigente')));
  const close = node('button', 'inspector-close', t('Cerrar'));
  close.type = 'button';
  close.setAttribute('aria-label', t('Cerrar detalle'));
  close.addEventListener('click', () => setInspectorOpen(false));
  top.append(code, close);

  const heading = node('h2', '', risk.name);
  heading.id = 'inspector-title';
  const summary = node('p', 'inspector-summary', risk.summary);

  const prevention = node('section', 'inspector-section');
  prevention.append(node('h3', '', t('Prevención prioritaria')));
  const preventionList = node('ul');
  for (const item of risk.prevention) preventionList.append(node('li', '', item));
  prevention.append(preventionList);

  const history = node('section', 'inspector-section');
  history.append(node('h3', '', t('Linaje en el tiempo')));
  const historyList = node('ol', 'lineage-list');
  for (const item of lineage.nodes) {
    const entry = node('li', 'lineage-item');
    const year = node('span', 'lineage-year', String(item.year));
    const copy = node('span');
    copy.append(node('strong', '', `${item.id} · ${item.name}`));
    copy.append(node('span', '', item.change || t('Sin cambio documentado')));
    entry.append(year, copy);
    historyList.append(entry);
  }
  if (lineage.nodes.length === 1) {
    const entry = node('li', 'lineage-item');
    entry.append(node('span', 'lineage-year', String(risk.year)), node('span', '', risk.change || t('Categoría sin predecesor o sucesor directo en las ediciones incluidas.')));
    historyList.replaceChildren(entry);
  }
  history.append(historyList);

  const relations = node('section', 'inspector-section');
  relations.append(node('h3', '', t('Relaciones')));
  const relationList = node('ul');
  const relevantEdges = family.edges.filter((edge) => edge.from === risk.key || edge.to === risk.key);
  if (relevantEdges.length) {
    for (const edge of relevantEdges) {
      relationList.append(node('li', '', `${t(relationshipLabel(edge.type))}: ${edge.note}`));
    }
  } else {
    relationList.append(node('li', '', risk.change || t('No hay una relación directa documentada en las ediciones incluidas.')));
  }
  relations.append(relationList);

  const linkSection = node('section', 'inspector-section');
  const source = node('a', 'source-link', t('Abrir fuente oficial ↗'));
  source.href = risk.source;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  linkSection.append(source);

  elements.inspector.append(top, heading, summary, prevention, history, relations, linkSection);
  syncInspectorVisibility({ focus: focusInspectorAfterRender });
  focusInspectorAfterRender = false;
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
    if (edge.highlighted) path.classList.add('is-highlighted');
    path.dataset.from = edge.from;
    path.dataset.to = edge.to;
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
    elements.searchResults.append(node('p', 'search-empty', t('No se encontraron categorías.')));
  } else {
    for (const result of results) {
      const button = node('button', 'search-result');
      button.type = 'button';
      button.setAttribute('aria-controls', 'inspector');
      button.setAttribute('aria-haspopup', 'dialog');
      button.append(
        node('span', 'search-result-id', result.id),
        node('span', 'search-result-name', result.name),
        node('span', 'search-result-year', String(result.year)),
      );
      button.addEventListener('click', () => {
        yearFilters.get(result.family).add(result.year);
        navigate(
          { family: result.family, year: result.year, id: result.id },
          { openInspector: true, returnFocus: () => elements.search },
        );
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
  if (shouldRefocusWithin(elements.inspector, document.activeElement, inspectorOpen)) {
    focusInspectorAfterRender = true;
  }
  const routeState = resolveRouteState(location.hash, catalog);
  currentRoute = routeState.route;
  if (routeState.changed) history.replaceState(null, '', routeState.canonicalHash);
  const family = catalog.families[currentRoute.family];
  yearFilters.get(family.id).add(currentRoute.year);
  const risk = getRisk(catalog, currentRoute.family, currentRoute.year, currentRoute.id);
  const selected = { ...risk, family: family.id, year: currentRoute.year, key: `${currentRoute.year}:${currentRoute.id}` };
  const lineage = getLineage(catalog, currentRoute.family, currentRoute.year, currentRoute.id);

  applyStaticLanguage(language);
  document.querySelector('#language-select').value = language;
  renderFamilyNav();
  renderEditionFilter(family);
  elements.familyDescription.textContent = family.description;
  elements.timelineTitle.textContent = family.label;
  elements.timelineHelp.textContent = `${visibleEditions(family, yearFilters.get(family.id)).length} ${language === 'es' ? 'ediciones' : 'editions'} · ${lineage.nodes.length} ${language === 'es' ? 'nodos en el linaje' : 'lineage nodes'}`;
  elements.detailTriggerLabel.textContent = `${selected.id} · ${selected.name}`;
  renderTimeline(family, lineage);
  renderInspector(family, selected, lineage);
  document.title = `${selected.id} ${selected.name} · OWASP Evolution`;
}

elements.search.addEventListener('input', (event) => renderSearchResults(event.target.value));
elements.search.addEventListener('focus', () => renderSearchResults(elements.search.value));
elements.brand.addEventListener('click', () => setInspectorOpen(false, { restoreFocus: false }));
elements.openInspector.addEventListener('click', () => setInspectorOpen(true, {
  focus: true,
  returnFocus: () => elements.openInspector,
}));
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
    if (inspectorOpen) {
      setInspectorOpen(false);
      return;
    }
    elements.search.value = '';
    hideSearchResults();
    elements.search.blur();
  }
});
window.addEventListener('hashchange', render);
window.addEventListener('resize', scheduleConnections);
new ResizeObserver(scheduleConnections).observe(elements.timelineStage);

render();

document.querySelector('#language-select').addEventListener('change', (event) => {
  language = event.target.value;
  saveLanguagePreference(window, language);
  catalog = localizeCatalog(sourceCatalog, language);
  render();
  renderSearchResults(elements.search.value);
});
