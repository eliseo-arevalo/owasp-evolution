import { detectLanguage, readLanguagePreference, saveLanguagePreference } from './locale.js';
import { localizeCatalog, translate, staticTranslator } from './i18n.js';
import {
  defaultVisibleYears,
  visibleEditions,
  visibleConnections,
  relationKind,
  lineageKinds,
  primaryNeighbor,
  rowCues,
  lineagePath,
  formatLineagePath,
  yearOf,
  idOf,
} from './editions.js';
import { catalog as sourceCatalog } from './data.js';
import { scheduleFocus } from './focus.js';
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
  openDetailButton: document.querySelector('#open-detail'),
  detailTriggerLabel: document.querySelector('#detail-trigger-label'),
  timelineStage: document.querySelector('#timeline-stage'),
  timelineGrid: document.querySelector('#timeline-grid'),
  connectorLayer: document.querySelector('#connector-layer'),
  detailPage: document.querySelector('#detail-page'),
  detailModal: document.querySelector('#detail-modal'),
  matrixPage: document.querySelector('#matrix-page'),
  search: document.querySelector('#risk-search'),
  searchResults: document.querySelector('#search-results'),
};

let currentRoute = resolveRouteState(location.hash, catalog).route;
let activeEdges = [];
let litEdges = new Set();
let drawFrame = 0;
let matrixSignature = '';
let structureSignature = '';
let selectedKey = '';
let hoverKey = null;
let focusKey = null;
let matrixReturnHash = null;
let wasDetail = false;
const resolveDetailReturn = () => elements.timelineStage.querySelector('.is-selected .risk-focus');

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

function openDetail() {
  matrixReturnHash = formatRoute({ ...currentRoute, detail: false });
  history.pushState({ matrixReturnHash }, '', formatRoute({ ...currentRoute, detail: true }));
  render();
}

function returnToMatrix() {
  if (matrixReturnHash && history.state?.matrixReturnHash === matrixReturnHash) {
    history.back();
  } else {
    history.replaceState(null, '', formatRoute({ ...currentRoute, detail: false }));
    render();
  }
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

const edgeKey = (edge) => `${edge.from}>${edge.to}`;
const cardByKey = (key) => elements.timelineGrid.querySelector(`.risk-card[data-key="${CSS.escape(key)}"]`);

function cueDescriptions(cue) {
  const es = language === 'es';
  return [
    cue.isNew && (es ? 'nueva en esta edición' : 'new in this edition'),
    cue.hiddenBefore && (es ? `predecesora en ${cue.hiddenBefore}, edición oculta` : `predecessor in ${cue.hiddenBefore}, hidden edition`),
    cue.hiddenAfter && (es ? `sucesora en ${cue.hiddenAfter}, edición oculta` : `successor in ${cue.hiddenAfter}, hidden edition`),
    cue.leaves && (es ? `sale del Top 10 en ${cue.leaves}` : `leaves the Top 10 in ${cue.leaves}`),
  ].filter(Boolean);
}

function riskCues(cue) {
  const cues = node('span', 'risk-cues');
  cues.setAttribute('aria-hidden', 'true');
  if (cue.isNew) cues.append(node('span', 'risk-cue', t('nueva')));
  if (cue.hiddenBefore) cues.append(node('span', 'risk-cue is-faint', `← ${cue.hiddenBefore}`));
  if (cue.hiddenAfter) cues.append(node('span', 'risk-cue is-faint', `→ ${cue.hiddenAfter}`));
  if (cue.leaves) cues.append(node('span', 'risk-exit'));
  return cues.childElementCount ? cues : null;
}

function renderTimeline(family) {
  const years = yearFilters.get(family.id);
  const editions = visibleEditions(family, years);
  const cues = rowCues(family, years);
  elements.timelineGrid.replaceChildren();
  elements.timelineGrid.style.setProperty('--edition-count', editions.length);
  elements.timelineGrid.dataset.editions = String(editions.length);
  hoverKey = null;
  focusKey = null;

  for (const edition of editions) {
    const column = node('section', 'edition-column');
    column.setAttribute('aria-labelledby', `edition-${family.id}-${edition.year}`);

    const header = node('header', 'edition-header');
    const year = node('h3', 'edition-year', String(edition.year));
    year.id = `edition-${family.id}-${edition.year}`;
    header.append(year);
    if (edition.status === t('Vigente')) header.append(node('span', 'edition-status', edition.status));

    const list = node('div', 'risk-list');
    for (const rawRisk of edition.items) {
      const risk = riskWithContext(family, edition, rawRisk);
      const cue = cues.get(risk.key);
      const card = node('div', 'risk-card');
      const button = node('button', 'risk-focus');
      button.type = 'button';
      button.tabIndex = -1;
      card.dataset.key = risk.key;
      const label = `${risk.id}: ${risk.name}, ${language === 'es' ? 'edición' : 'edition'} ${risk.year}`;
      button.setAttribute('aria-label', [label, ...cueDescriptions(cue)].join(', '));
      button.title = [risk.name, `${risk.id} · ${risk.year}`, risk.change].filter(Boolean).join('\n');

      const rank = node('span', 'risk-rank', String(risk.rank).padStart(2, '0'));
      const copy = node('span', 'risk-copy');
      copy.append(node('span', 'risk-name', risk.name));
      button.append(rank, copy);
      const marks = riskCues(cue);
      if (marks) button.append(marks);
      button.addEventListener('click', () => navigate(
        { family: family.id, year: edition.year, id: risk.id },
      ));
      card.append(button);
      list.append(card);
    }

    column.append(header, list);
    elements.timelineGrid.append(column);
  }

  activeEdges = visibleConnections(family, years);
  scheduleConnections();
}

// Selection only moves classes and the Detail button, so rows and connectors can transition.
function applySelection(key) {
  selectedKey = key;
  for (const card of elements.timelineGrid.querySelectorAll('.risk-card')) {
    const selected = card.dataset.key === key;
    const button = card.querySelector('.risk-focus');
    card.classList.toggle('is-selected', selected);
    button.tabIndex = selected ? 0 : -1;
    if (selected) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
  elements.timelineGrid.querySelector('.risk-detail-wrap')?.remove();
  const card = cardByKey(key);
  if (card) {
    const wrap = node('span', 'risk-detail-wrap');
    const detail = node('button', 'risk-detail', t('Detalle'));
    detail.type = 'button';
    detail.setAttribute('aria-haspopup', 'dialog');
    detail.addEventListener('click', openDetail);
    wrap.append(detail);
    card.append(wrap);
  }
  updateEmphasis();
}

function updateEmphasis() {
  applyEmphasis(hoverKey ?? focusKey ?? selectedKey);
}

// Emphasize one row's lineage: the selection, or a hovered or focused row being previewed.
function applyEmphasis(key) {
  const family = catalog.families[currentRoute.family];
  const years = yearFilters.get(family.id);
  const lineage = getLineage(catalog, family.id, yearOf(key), idOf(key));
  const connections = visibleConnections(family, years, lineage.edges);
  const kinds = lineageKinds(connections, key);
  const related = new Set(lineage.nodes.filter((item) => years.has(item.year) && item.key !== key).map((item) => item.key));
  const linked = related.size > 0;
  litEdges = new Set(connections.filter((edge) => edge.highlighted).map(edgeKey));

  elements.timelineStage.classList.toggle('has-lineage', linked);
  for (const card of elements.timelineGrid.querySelectorAll('.risk-card')) {
    const cardKey = card.dataset.key;
    card.classList.toggle('is-anchor', cardKey === key);
    card.classList.toggle('is-related', related.has(cardKey));
    card.classList.toggle('is-dimmed', linked && cardKey !== key && !related.has(cardKey));
    if (kinds.has(cardKey)) card.style.setProperty('--relation-color', `var(--${kinds.get(cardKey)})`);
    else card.style.removeProperty('--relation-color');
  }
  for (const path of elements.connectorLayer.children) {
    path.classList.toggle('is-highlighted', litEdges.has(path.dataset.edge));
  }
}

function renderLineageSummary(family, lineage) {
  const path = lineagePath(lineage.nodes, yearFilters.get(family.id));
  const { route, hidden } = formatLineagePath(path, language === 'es' ? 'en' : 'in');
  elements.timelineHelp.replaceChildren(node('span', 'path-route', route));
  for (const text of hidden) elements.timelineHelp.append(node('span', 'path-hidden', text));
}

function rowTarget(card, key) {
  if (key === 'ArrowUp') return card.previousElementSibling;
  if (key === 'ArrowDown') return card.nextElementSibling;
  if (key === 'Home') return card.parentElement.firstElementChild;
  if (key === 'End') return card.parentElement.lastElementChild;
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
  const neighbor = primaryNeighbor(activeEdges, card.dataset.key, key === 'ArrowRight' ? 'next' : 'previous');
  if (neighbor) return cardByKey(neighbor);
  // Rows without a visible relation fall back to the same position in the adjacent edition.
  const column = card.closest('.edition-column');
  const adjacent = key === 'ArrowRight' ? column.nextElementSibling : column.previousElementSibling;
  const index = [...card.parentElement.children].indexOf(card);
  return adjacent?.querySelectorAll('.risk-card')[index] ?? null;
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
        navigate({ family: family.id, year: replacement.year, id: replacement.items[0].id });
      } else render();
      scheduleFocus(() => document.querySelector(`#edition-options input[value="${edition.year}"]`));
    });
    input.value = edition.year;
    label.append(input, node('span', '', String(edition.year)));
    options.append(label);
  }
}

function renderDetail(family, risk, lineage) {
  elements.detailPage.replaceChildren();
  const edition = getEdition(catalog, family.id, risk.year);

  const top = node('div', 'detail-top');
  const code = node('div', 'detail-code');
  code.append(node('span', '', `${risk.id} · ${risk.year}`));
  if (edition.status === t('Vigente')) code.append(node('span', 'detail-current', t('Vigente')));
  const close = node('button', 'detail-back', t('← Volver'));
  close.type = 'button';
  close.setAttribute('aria-label', t('Volver a la matriz'));
  close.addEventListener('click', returnToMatrix);
  top.append(close, code);

  const heading = node('h1', '', risk.name);
  heading.id = 'detail-title';
  const summary = node('p', 'detail-summary', risk.summary);

  const prevention = node('section', 'detail-section');
  prevention.append(node('h2', '', t('Prevención prioritaria')));
  const preventionList = node('ul');
  for (const item of risk.prevention) preventionList.append(node('li', '', item));
  prevention.append(preventionList);

  const history = node('section', 'detail-section');
  history.append(node('h2', '', t('Linaje en el tiempo')));
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

  const relations = node('section', 'detail-section');
  relations.append(node('h2', '', t('Relaciones')));
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

  const linkSection = node('section', 'detail-section');
  const source = node('a', 'source-link', t('Abrir fuente oficial ↗'));
  source.href = risk.source;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  linkSection.append(source);

  elements.detailPage.append(top, heading, summary, prevention, history, relations, linkSection);

}

function scheduleConnections() {
  cancelAnimationFrame(drawFrame);
  drawFrame = requestAnimationFrame(drawConnections);
}

function drawConnections() {
  const stage = elements.timelineStage;
  const svg = elements.connectorLayer;
  const stageRect = stage.getBoundingClientRect();
  const width = stage.scrollWidth;
  const height = stage.scrollHeight;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  // Paths are reused across redraws so emphasis changes fade instead of popping.
  const previous = new Map([...svg.children].map((path) => [path.dataset.edge, path]));
  const cards = new Map([...stage.querySelectorAll('.risk-card')].map((card) => [card.dataset.key, card]));
  const ordered = [...activeEdges].sort((a, b) => Number(litEdges.has(edgeKey(a))) - Number(litEdges.has(edgeKey(b))));
  for (const edge of ordered) {
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

    const key = edgeKey(edge);
    const path = previous.get(key) ?? document.createElementNS(SVG_NS, 'path');
    previous.delete(key);
    path.setAttribute('d', `M ${startX} ${startY} C ${startX + distance * .46} ${startY}, ${endX - distance * .46} ${endY}, ${endX} ${endY}`);
    path.setAttribute('class', relationKind(edge.type));
    path.classList.toggle('is-highlighted', litEdges.has(key));
    path.dataset.edge = key;
    svg.append(path);
  }
  for (const stale of previous.values()) stale.remove();
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
      button.append(
        node('span', 'search-result-id', result.id),
        node('span', 'search-result-name', result.name),
        node('span', 'search-result-year', String(result.year)),
      );
      button.addEventListener('click', () => {
        yearFilters.get(result.family).add(result.year);
        navigate(
          { family: result.family, year: result.year, id: result.id },
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
  const routeState = resolveRouteState(location.hash, catalog);
  currentRoute = routeState.route;
  if (routeState.changed) history.replaceState(history.state, '', routeState.canonicalHash);
  const family = catalog.families[currentRoute.family];
  yearFilters.get(family.id).add(currentRoute.year);
  const risk = getRisk(catalog, currentRoute.family, currentRoute.year, currentRoute.id);
  const selected = { ...risk, family: family.id, year: currentRoute.year, key: `${currentRoute.year}:${currentRoute.id}` };
  const lineage = getLineage(catalog, currentRoute.family, currentRoute.year, currentRoute.id);

  applyStaticLanguage(language);
  document.querySelector('#language-select').value = language;
  const detail = Boolean(currentRoute.detail);
  document.body.classList.toggle('detail-open', detail);
  const structure = JSON.stringify([family.id, language, [...yearFilters.get(family.id)]]);
  const signature = JSON.stringify([structure, currentRoute.year, currentRoute.id]);
  renderFamilyNav();
  if (signature !== matrixSignature) {
    matrixSignature = signature;
    if (structure !== structureSignature) {
      structureSignature = structure;
      renderEditionFilter(family);
      elements.familyDescription.textContent = family.description;
      elements.timelineTitle.textContent = family.label;
      renderTimeline(family);
    }
    renderLineageSummary(family, lineage);
    elements.detailTriggerLabel.textContent = `${selected.id} · ${selected.name}`;
    applySelection(selected.key);
  }
  if (detail) {
    renderDetail(family, selected, lineage);
    if (!wasDetail) {
      elements.detailModal.showModal();
      elements.detailModal.scrollTop = 0;
      scheduleFocus(() => elements.detailPage.querySelector('.detail-back'));
    }
  } else if (wasDetail) {
    elements.detailModal.close();
    scheduleFocus(resolveDetailReturn);
    scheduleConnections();
  }
  wasDetail = detail;
  document.title = `${selected.id} ${selected.name} · OWASP Evolution`;
}

elements.detailModal.addEventListener('cancel', (event) => {
  event.preventDefault();
  returnToMatrix();
});
elements.detailModal.addEventListener('click', (event) => {
  const bounds = elements.detailModal.getBoundingClientRect();
  if (event.target === elements.detailModal &&
      (event.clientX < bounds.left || event.clientX > bounds.right ||
       event.clientY < bounds.top || event.clientY > bounds.bottom)) returnToMatrix();
});

elements.search.addEventListener('input', (event) => renderSearchResults(event.target.value));
elements.search.addEventListener('focus', () => renderSearchResults(elements.search.value));
elements.openDetailButton.addEventListener('click', () => openDetail());
document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-wrap')) hideSearchResults();
});
document.addEventListener('keydown', (event) => {
  const tag = document.activeElement?.tagName;
  if (event.key === '/' && !currentRoute.detail && tag !== 'INPUT' && tag !== 'TEXTAREA') {
    event.preventDefault();
    elements.search.focus();
  }
  if (event.key === 'Escape') {
    if (currentRoute.detail) {
      event.preventDefault();
      returnToMatrix();
      return;
    }
    elements.search.value = '';
    hideSearchResults();
    elements.search.blur();
  }
});
elements.timelineGrid.addEventListener('keydown', (event) => {
  const card = event.target.closest('.risk-focus')?.closest('.risk-card');
  if (!card || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const target = rowTarget(card, event.key);
  if (!target) return;
  event.preventDefault();
  target.querySelector('.risk-focus').focus();
});
// Hover and focus preview a row's lineage without touching the selection or the URL.
elements.timelineGrid.addEventListener('pointerover', (event) => {
  if (event.pointerType === 'touch') return;
  const key = event.target.closest('.risk-card')?.dataset.key;
  if (!key || key === hoverKey) return;
  hoverKey = key;
  updateEmphasis();
});
elements.timelineGrid.addEventListener('pointerleave', () => {
  if (hoverKey === null) return;
  hoverKey = null;
  updateEmphasis();
});
elements.timelineGrid.addEventListener('focusin', (event) => {
  const button = event.target.closest('.risk-focus');
  if (!button) return;
  for (const other of elements.timelineGrid.querySelectorAll('.risk-focus')) other.tabIndex = other === button ? 0 : -1;
  focusKey = button.closest('.risk-card').dataset.key;
  updateEmphasis();
});
elements.timelineGrid.addEventListener('focusout', (event) => {
  if (elements.timelineGrid.contains(event.relatedTarget)) return;
  for (const other of elements.timelineGrid.querySelectorAll('.risk-focus')) {
    other.tabIndex = other.closest('.risk-card').dataset.key === selectedKey ? 0 : -1;
  }
  focusKey = null;
  updateEmphasis();
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
