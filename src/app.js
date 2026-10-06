import { exportFilename, exportCSV, exportJSON, exportMarkdown, matrixSVG, pngBlob, download } from './export.js';
import { detectLanguage, readLanguagePreference, saveLanguagePreference } from './locale.js';
import { localizeCatalog, translate, staticTranslator } from './i18n.js';
import {
  defaultVisibleYears,
  visibleEditions,
  visibleConnections,
  relationKind,
  primaryNeighbor,
  rowCues,
  yearOf,
  idOf,
} from './editions.js';
import { catalog as sourceCatalog } from './data.js';
import { scheduleFocus } from './focus.js';
import { MOTION, EASE, easeOut, prefersReducedMotion, drawPlan, settleDelays, layoutDeltas } from './motion.js';
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
let pendingReveal = false;
let settling = [];
let layoutFrame = 0;
let layoutEasing = false;
let modalExit = 0;
let dockPosition = 'bottom';
try { dockPosition = localStorage.getItem('owasp-dock') || 'bottom'; } catch {}
if (!['bottom', 'left', 'right'].includes(dockPosition)) dockPosition = 'bottom';
const shell = document.querySelector('.explorer-shell');
const resizer = document.querySelector('#dock-resizer');
const narrowScreen = matchMedia('(max-width: 760px)');
let dockHeight = 320;
let dockWidth = 380;
let maskCount = 0;
let entryPending = true;
let entryAnimations = [];
let familyExit = null;
let familyAnimations = [];
const reveals = new Map();
const connectorDefs = document.createElementNS(SVG_NS, 'defs');
elements.connectorLayer.prepend(connectorDefs);
const connectorPaths = () => elements.connectorLayer.querySelectorAll(':scope > path:not(.connector-hit)');
const reducedMotion = () => prefersReducedMotion(window);
const emphasisKey = () => hoverKey ?? focusKey ?? selectedKey;
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
  if (elements.familyNav.childElementCount) {
    [...elements.familyNav.children].forEach((button) => {
      button.textContent = button.dataset.family === 'web' ? 'Web' : 'GenAI/LLM';
      if (button.dataset.family === currentRoute.family) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    return;
  }
  for (const family of Object.values(catalog.families)) {
    const button = node('button', 'family-tab', family.id === 'web' ? 'Web' : 'GenAI/LLM');
    button.type = 'button';
    button.dataset.family = family.id;
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

function renderTimeline(family, ease = false) {
  for (const animation of entryAnimations) animation.cancel();
  entryAnimations = [];
  const years = yearFilters.get(family.id);
  const editions = visibleEditions(family, years);
  const cues = rowCues(family, years);
  const before = ease && !reducedMotion() ? columnBoxes() : null;
  cancelAnimationFrame(layoutFrame);
  layoutEasing = false;
  stopReveal();
  stopSettle();
  const existing = ease ? new Map([...elements.timelineGrid.children].map((column) => [Number(column.dataset.year), column])) : new Map();
  if (!ease) elements.timelineGrid.replaceChildren();
  for (const [year, column] of existing) {
    if (years.has(year)) continue;
    if (reducedMotion()) { column.remove(); continue; }
    const box = column.getBoundingClientRect();
    const stage = elements.timelineStage.getBoundingClientRect();
    column.classList.add('is-leaving');
    Object.assign(column.style, { position: 'absolute', left: `${box.left - stage.left}px`, top: `${box.top - stage.top}px`, width: `${box.width}px`, transform: '', zIndex: '3', pointerEvents: 'none' });
    column.inert = true;
    elements.timelineStage.append(column);
    const exit = column.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: MOTION.layout, easing: EASE, fill: 'forwards' });
    exit.onfinish = () => column.remove();
  }
  elements.timelineGrid.style.setProperty('--edition-count', editions.length);
  elements.timelineGrid.dataset.editions = String(editions.length);
  hoverKey = null;
  focusKey = null;

  for (const edition of editions) {
    const retained = existing.get(edition.year);
    if (retained) {
      retained.style.transform = '';
      for (const card of retained.querySelectorAll('.risk-card')) {
        const cue = cues.get(card.dataset.key);
        const risk = edition.items.find((item) => item.id === idOf(card.dataset.key));
        const label = `${risk.id}: ${risk.name}, ${language === 'es' ? 'edición' : 'edition'} ${edition.year}`;
        card.querySelector('.risk-focus').setAttribute('aria-label', [label, ...cueDescriptions(cue)].join(', '));
      }
      continue;
    }
    const column = node('section', 'edition-column');
    column.dataset.year = String(edition.year);
    column.setAttribute('aria-labelledby', `edition-${family.id}-${edition.year}`);

    const header = node('header', 'edition-header');
    const year = node('h3', 'edition-year', String(edition.year));
    year.id = `edition-${family.id}-${edition.year}`;
    header.append(year);

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
      button.addEventListener('click', (event) => {
        // A double click commits once; keyboard activation has detail === 0.
        if (event.detail > 1) return;
        navigate({ family: family.id, year: edition.year, id: risk.id });
      });
      button.addEventListener('dblclick', openDetail);
      card.append(button);
      list.append(card);
    }

    column.append(header, list);
    elements.timelineGrid.append(column);
  }

  // Insert only new columns in chronological order; retained nodes never detach.
  editions.forEach((edition, index) => {
    const column = elements.timelineGrid.querySelector(`[data-year="${edition.year}"]`);
    const slot = elements.timelineGrid.children[index];
    if (slot !== column) elements.timelineGrid.insertBefore(column, slot ?? null);
  });
  activeEdges = visibleConnections(family, years);
  if (before) easeColumns(before);
  else scheduleConnections();
}

// Keep the previous painted matrix above the new one until the crossfade ends.
// The snapshot is inert and outside flow; neither chrome nor matrix geometry moves.
function captureFamily() {
  familyExit?.remove();
  familyAnimations.forEach((animation) => animation.cancel());
  familyAnimations = [];
  if (reducedMotion()) return null;
  stopReveal();
  stopSettle();
  const snapshot = elements.timelineStage.cloneNode(true);
  snapshot.removeAttribute('id');
  snapshot.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  snapshot.classList.add('family-snapshot');
  snapshot.inert = true;
  snapshot.setAttribute('aria-hidden', 'true');
  elements.timelineStage.parentElement.append(snapshot);
  familyExit = snapshot;
  return snapshot;
}

function crossfadeFamily(snapshot) {
  if (!snapshot) return;
  pendingReveal = false;
  stopSettle();
  drawConnections();
  const exit = snapshot.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: MOTION.family, easing: EASE, fill: 'forwards',
  });
  exit.onfinish = () => { snapshot.remove(); if (familyExit === snapshot) familyExit = null; };
  familyAnimations.push(exit);
  [...elements.timelineGrid.children].forEach((column, index) => {
    familyAnimations.push(column.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: MOTION.family, delay: index * MOTION.familyStep, easing: EASE, fill: 'backwards',
    }));
  });
}

function columnBoxes() {
  const stage = elements.timelineStage.getBoundingClientRect();
  return new Map([...elements.timelineGrid.children].map((column) => {
    const box = column.getBoundingClientRect();
    return [Number(column.dataset.year), { x: box.left - stage.left, y: box.top - stage.top }];
  }));
}

// Invert synchronously before paint. Every frame measures the transformed cards,
// keeping the same SVG paths attached to the moving columns.
function easeColumns(before) {
  const columns = [...elements.timelineGrid.children];
  const deltas = layoutDeltas(before, columnBoxes());
  for (const column of columns) {
    const delta = deltas.get(Number(column.dataset.year));
    column.style.transform = delta ? `translate(${delta.x}px, ${delta.y}px)` : '';
    if (!before.has(Number(column.dataset.year))) column.animate(
      [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: MOTION.layout, easing: EASE });
  }
  layoutEasing = true;
  drawConnections();
  let start;
  const frame = (now) => {
    start ??= now;
    const t = Math.min(1, (now - start) / MOTION.layout);
    const remaining = 1 - easeOut(t);
    for (const column of columns) {
      const delta = deltas.get(Number(column.dataset.year));
      column.style.transform = delta && remaining ? `translate(${delta.x * remaining}px, ${delta.y * remaining}px)` : '';
    }
    drawConnections();
    layoutEasing = t < 1;
    layoutFrame = layoutEasing ? requestAnimationFrame(frame) : 0;
  };
  layoutFrame = requestAnimationFrame(frame);
}

function enterPage() {
  entryPending = false;
  if (reducedMotion()) return;
  stopSettle();
  pendingReveal = false;
  const rise = (element, delay, shift = 12) => entryAnimations.push(element.animate(
    [{ opacity: 0, transform: `translateY(${shift}px)` }, { opacity: 1, transform: 'none' }],
    { duration: MOTION.entryRise, delay, easing: EASE, fill: 'backwards' }));
  document.querySelectorAll('.topbar, .toolbar').forEach((element, index) => rise(element, index * 40, 6));
  [...elements.timelineGrid.children].forEach((column, index) => {
    rise(column, index * MOTION.entryStep);
    column.querySelectorAll('.risk-focus').forEach((cell, row) => rise(cell, index * MOTION.entryStep + row * MOTION.entryCellStep, 6));
  });
  drawConnections();
  revealLineage(true);
}

// Selection only moves classes and the Detail button, so rows and connectors can transition.
function applySelection(key, { motion = true } = {}) {
  const committed = motion && key !== selectedKey;
  selectedKey = key;
  hoverKey = null;
  focusKey = null;
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
  updateEmphasis('commit');
  if (committed) {
    settleLineage();
    pendingReveal = true;
    scheduleConnections();
  }
}

// Previews fade quickly and never draw; only a committed selection replays the draw.
function updateEmphasis(mode = 'preview') {
  applyEmphasis(emphasisKey(), mode);
}

// Emphasize one row's lineage: the selection, or a hovered or focused row being previewed.
function applyEmphasis(key, mode) {
  const family = catalog.families[currentRoute.family];
  const years = yearFilters.get(family.id);
  const lineage = getLineage(catalog, family.id, yearOf(key), idOf(key));
  const connections = visibleConnections(family, years, lineage.edges);
  const related = new Set(lineage.nodes.filter((item) => years.has(item.year) && item.key !== key).map((item) => item.key));
  const linked = related.size > 0;
  litEdges = new Set(connections.filter((edge) => edge.highlighted).map(edgeKey));

  if (key !== selectedKey) stopReveal();
  elements.timelineStage.classList.toggle('is-previewing', mode === 'preview');
  elements.timelineStage.classList.toggle('has-lineage', linked);
  for (const card of elements.timelineGrid.querySelectorAll('.risk-card')) {
    const cardKey = card.dataset.key;
    card.classList.toggle('is-anchor', cardKey === key);
    card.classList.toggle('is-related', related.has(cardKey));
    card.classList.toggle('is-dimmed', linked && cardKey !== key && !related.has(cardKey));
  }
  for (const path of connectorPaths()) {
    path.classList.toggle('is-highlighted', litEdges.has(path.dataset.edge));
  }
}

// Lineage rows settle outward from the selection: a short fade and a 3px rise, 40ms apart.
function settleLineage() {
  stopSettle();
  if (reducedMotion() || emphasisKey() !== selectedKey) return;
  const rows = [...elements.timelineGrid.querySelectorAll('.risk-card.is-anchor, .risk-card.is-related')];
  const delays = settleDelays(rows.map((row) => row.dataset.key), selectedKey, yearFilters.get(currentRoute.family));
  settling = rows.map((row) => row.querySelector('.risk-focus').animate(
    [{ opacity: .4, transform: `translateY(${MOTION.settleShift}px)` }, { opacity: 1, transform: 'none' }],
    { duration: MOTION.settle, delay: delays.get(row.dataset.key), easing: EASE, fill: 'backwards' },
  ));
}

function stopSettle() {
  for (const animation of settling) animation.cancel();
  settling = [];
}

// A committed lineage draws outward from the selected year; unrelated connectors only fade.
// Dashed strokes keep their pattern because the draw runs on a solid mask, not the stroke.
function revealLineage(entry = false) {
  stopReveal();
  if (reducedMotion() || layoutEasing || emphasisKey() !== selectedKey) return;
  const lit = entry ? activeEdges : activeEdges.filter((edge) => litEdges.has(edgeKey(edge)));
  const plan = drawPlan(lit, yearFilters.get(currentRoute.family), yearOf(selectedKey));
  for (const path of connectorPaths()) {
    const key = path.dataset.edge;
    const step = entry ? { delay: MOTION.entryConnectors + [...yearFilters.get(currentRoute.family)].sort((a, b) => a - b).indexOf(yearOf(key.split('>')[0])) * MOTION.entryStep, reverse: false } : plan.get(key);
    if (!step) continue;
    const mask = document.createElementNS(SVG_NS, 'mask');
    const stroke = document.createElementNS(SVG_NS, 'path');
    mask.id = `connector-draw-${++maskCount}`;
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    for (const [name, value] of [['x', '0'], ['y', '0'], ['width', '100%'], ['height', '100%']]) mask.setAttribute(name, value);
    stroke.setAttribute('class', 'connector-draw');
    stroke.setAttribute('pathLength', '1');
    stroke.setAttribute('d', path.getAttribute('d'));
    mask.append(stroke);
    connectorDefs.append(mask);
    path.setAttribute('mask', `url(#${mask.id})`);
    path.classList.add('is-drawing');
    const animation = stroke.animate(
      [{ strokeDashoffset: step.reverse ? -1 : 1 }, { strokeDashoffset: 0 }],
      { duration: MOTION.draw, delay: step.delay, easing: EASE, fill: 'backwards' },
    );
    animation.onfinish = () => stopReveal(key);
    reveals.set(key, { path, mask, stroke, animation });
  }
}

function stopReveal(only) {
  for (const [key, reveal] of reveals) {
    if (only && key !== only) continue;
    reveal.animation.cancel();
    reveal.mask.remove();
    reveal.path.removeAttribute('mask');
    reveal.path.classList.remove('is-drawing');
    reveals.delete(key);
  }
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
  code.append(node('span', 'detail-current', edition.status));
  const close = node('button', 'detail-back', t('← Volver'));
  close.type = 'button';
  close.setAttribute('aria-label', t('Volver a la matriz'));
  close.addEventListener('click', returnToMatrix);
  top.append(code, dockControl(), close);

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
  const visibleYears = yearFilters.get(family.id);
  const cues = rowCues(family, new Set(family.editions.map((item) => item.year)));
  for (const item of lineage.nodes) {
    const entry = node('li', 'lineage-item');
    if (!visibleYears.has(item.year)) entry.classList.add('is-hidden-year');
    const year = node('span', 'lineage-year', String(item.year));
    const copy = node('div', 'lineage-copy');
    const title = node('strong', 'lineage-title');
    title.append(node('span', 'lineage-id', item.id), document.createTextNode(` · ${item.name}`));
    copy.append(title);
    const incoming = lineage.edges.filter((edge) => edge.to === item.key);
    for (const edge of incoming) {
      const relation = node('div', 'lineage-relation');
      const stroke = node('span', `legend-line line-${relationKind(edge.type)}`);
      stroke.setAttribute('aria-hidden', 'true');
      relation.append(stroke, node('span', '', t(relationshipLabel(edge.type))));
      copy.append(relation);
    }
    if (!incoming.length) {
      copy.append(node('p', 'lineage-note', `${t('Nueva en')} ${item.year}`));
    }
    const leaves = cues.get(item.key)?.leaves;
    if (leaves) copy.append(node('p', 'lineage-note', `${t('Sale en')} ${leaves}`));
    const newNote = `${t('Nueva en')} ${item.year}`;
    if (item.change && (incoming.length || item.change !== newNote)) {
      copy.append(node('p', 'lineage-note', item.change));
    }
    entry.append(year, copy);
    historyList.append(entry);
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

  const header = node('header', 'detail-header');
  header.append(top, heading, summary);
  const body = node('div', 'detail-body');
  body.append(prevention, history, relations, linkSection);
  elements.detailPage.append(header, body);

}

function scheduleConnections() {
  cancelAnimationFrame(drawFrame);
  drawFrame = requestAnimationFrame(drawConnections);
}

function drawConnections() {
  cancelAnimationFrame(drawFrame);
  const stage = elements.timelineStage;
  const svg = elements.connectorLayer;
  const stageRect = stage.getBoundingClientRect();
  const width = stage.scrollWidth;
  const height = stage.scrollHeight;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  // Paths are reused and only moved when their order changes, so running fades are kept.
  const previous = new Map([...connectorPaths()].filter((path) => path.dataset.edge).map((path) => [path.dataset.edge, path]));
  const cards = new Map([...elements.timelineGrid.querySelectorAll('.risk-card')].map((card) => [card.dataset.key, card]));
  const ordered = [...activeEdges]
    .filter((edge) => cards.has(edge.from) && cards.has(edge.to))
    .sort((a, b) => Number(litEdges.has(edgeKey(a))) - Number(litEdges.has(edgeKey(b))));
  const kept = new Set(ordered.map(edgeKey));
  for (const [key, stale] of previous) {
    if (kept.has(key)) continue;
    stopReveal(key);
    stale.hitArea.remove();
    if (layoutEasing && !reducedMotion()) {
      stale.removeAttribute('data-edge');
      const fade = stale.animate([{ opacity: getComputedStyle(stale).opacity }, { opacity: 0 }], { duration: MOTION.layout, fill: 'forwards' });
      fade.onfinish = () => stale.remove();
    } else stale.remove();
  }

  let cursor = connectorDefs.nextSibling;
  for (const edge of ordered) {
    // Bounding boxes include column transforms, so connectors follow columns while they ease.
    const sourceRect = cards.get(edge.from).getBoundingClientRect();
    const targetRect = cards.get(edge.to).getBoundingClientRect();
    const startX = sourceRect.right - stageRect.left;
    const startY = sourceRect.top - stageRect.top + sourceRect.height / 2;
    const endX = targetRect.left - stageRect.left;
    const endY = targetRect.top - stageRect.top + targetRect.height / 2;
    const distance = endX - startX;
    const d = `M ${startX} ${startY} C ${startX + distance * .46} ${startY}, ${endX - distance * .46} ${endY}, ${endX} ${endY}`;

    const key = edgeKey(edge);
    let path = previous.get(key);
    const created = !path;
    if (created) {
      path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', relationKind(edge.type));
      path.dataset.edge = key;
      const hit = document.createElementNS(SVG_NS, 'path');
      hit.setAttribute('class', 'connector-hit');
      hit.setAttribute('aria-hidden', 'true');
      hit.dataset.key = edge.to;
      path.hitArea = hit;
      hit.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch') return;
        hoverKey = edge.to;
        updateEmphasis();
      });
      hit.addEventListener('pointerleave', () => {
        hoverKey = null;
        updateEmphasis();
      });
      hit.addEventListener('click', (event) => {
        if (event.detail > 1) return;
        navigate({ family: currentRoute.family, year: yearOf(edge.to), id: idOf(edge.to) });
      });
      hit.addEventListener('dblclick', () => {
        // Resolve the clicked endpoint even if hashchange has not rendered yet.
        currentRoute = { family: currentRoute.family, year: yearOf(edge.to), id: idOf(edge.to) };
        openDetail();
      });
    }
    path.setAttribute('d', d);
    path.hitArea.setAttribute('d', d);
    reveals.get(key)?.stroke.setAttribute('d', d);
    path.classList.toggle('is-highlighted', litEdges.has(key));
    if (path === cursor) cursor = cursor.nextSibling;
    else svg.insertBefore(path, cursor);
    svg.append(path.hitArea);
    if (created && layoutEasing && !reducedMotion()) path.animate([{ opacity: 0 }], { duration: MOTION.layout, easing: EASE });
  }
  if (pendingReveal) {
    pendingReveal = false;
    revealLineage();
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

function dockControl() {
  const label = node('label', 'dock-control');
  const caption = node('span', 'sr-only', language === 'es' ? 'Posición del panel' : 'Panel position');
  const select = node('select');
  select.id = 'dock-select';
  for (const [value, es, en] of [['bottom', 'Abajo', 'Bottom'], ['right', 'Derecha', 'Right'], ['left', 'Izquierda', 'Left']]) {
    const option = node('option', '', language === 'es' ? es : en);
    option.value = value;
    select.append(option);
  }
  select.value = narrowScreen.matches ? 'bottom' : dockPosition;
  select.disabled = narrowScreen.matches;
  select.addEventListener('change', () => {
    dockPosition = select.value;
    try { localStorage.setItem('owasp-dock', dockPosition); } catch {}
    updateDock();
  });
  label.append(caption, select);
  return label;
}

function updateDock() {
  const position = narrowScreen.matches ? 'bottom' : dockPosition;
  shell.dataset.dock = position;
  const bottom = position === 'bottom';
  const max = bottom ? Math.max(200, Math.floor(innerHeight * .65)) : Math.max(240, Math.floor(shell.clientWidth * .48));
  const size = Math.min(max, bottom ? dockHeight : dockWidth);
  shell.style.setProperty('--dock-size', `${size}px`);
  resizer.setAttribute('aria-orientation', bottom ? 'horizontal' : 'vertical');
  resizer.setAttribute('aria-valuemin', bottom ? '200' : '240');
  resizer.setAttribute('aria-valuemax', String(max));
  resizer.setAttribute('aria-valuenow', String(size));
  resizer.setAttribute('aria-label', language === 'es' ? 'Cambiar tamaño del panel' : 'Resize panel');
  const select = document.querySelector('#dock-select');
  if (select) { select.disabled = narrowScreen.matches; select.value = position; }
  scheduleConnections();
}

function resizeDock(delta) {
  const bottom = shell.dataset.dock === 'bottom';
  const min = bottom ? 200 : 240;
  const max = Number(resizer.getAttribute('aria-valuemax'));
  const size = Math.max(min, Math.min(max, Number(resizer.getAttribute('aria-valuenow')) + delta));
  if (bottom) dockHeight = size; else dockWidth = size;
  updateDock();
}
resizer.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  resizer.setPointerCapture(event.pointerId);
  shell.classList.add('is-resizing');
  let previous = shell.dataset.dock === 'bottom' ? event.clientY : event.clientX;
  const move = (event) => {
    const bottom = shell.dataset.dock === 'bottom';
    const next = bottom ? event.clientY : event.clientX;
    resizeDock((next - previous) * (shell.dataset.dock === 'left' ? 1 : -1));
    previous = next;
  };
  const finish = () => {
    shell.classList.remove('is-resizing');
    resizer.removeEventListener('pointermove', move);
    resizer.removeEventListener('lostpointercapture', finish);
    scheduleConnections();
  };
  resizer.addEventListener('pointermove', move);
  resizer.addEventListener('lostpointercapture', finish);
});
resizer.addEventListener('keydown', (event) => {
  const sign = shell.dataset.dock === 'left' ? 1 : -1;
  const bottom = shell.dataset.dock === 'bottom';
  const direction = bottom ? { ArrowUp: 1, ArrowDown: -1 } : { ArrowLeft: -sign, ArrowRight: sign };
  if (!direction[event.key]) return;
  event.preventDefault();
  resizeDock(direction[event.key] * (event.shiftKey ? 40 : 10));
});

function dismissModal(done) {
  const modal = elements.detailModal;
  const finish = () => {
    keepModal();
    modal.close();
    done();
  };
  shell.classList.remove('has-detail');
  modal.inert = true;
  if (reducedMotion()) { finish(); return; }
  modal.classList.add('is-closing');
  modalExit = setTimeout(finish, MOTION.modal);
}

function keepModal() {
  clearTimeout(modalExit);
  modalExit = 0;
  elements.detailModal.classList.remove('is-closing');
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
  const previous = structureSignature ? JSON.parse(structureSignature) : null;
  const yearsChanged = structure !== structureSignature && previous?.[0] === family.id && previous?.[1] === language;
  const signature = JSON.stringify([structure, currentRoute.year, currentRoute.id]);
  const familyChanged = previous && previous[0] !== family.id;
  const snapshot = familyChanged ? captureFamily() : null;
  renderFamilyNav();
  if (signature !== matrixSignature) {
    matrixSignature = signature;
    if (structure !== structureSignature) {
      structureSignature = structure;
      renderEditionFilter(family);
      renderTimeline(family, yearsChanged);
    }
    applySelection(selected.key, { motion: !yearsChanged && !familyChanged });
    crossfadeFamily(snapshot);
  }
  if (detail) {
    renderDetail(family, selected, lineage);
    if (!wasDetail) {
      keepModal();
      if (!elements.detailModal.open) elements.detailModal.show();
      elements.detailModal.inert = false;
      updateDock();
      shell.classList.add('has-detail');
      elements.detailModal.scrollTop = 0;
      scheduleFocus(() => elements.detailPage.querySelector('.detail-back'));
    }
  } else if (wasDetail) {
    dismissModal(() => {
      scheduleFocus(resolveDetailReturn);
      scheduleConnections();
    });
  }
  wasDetail = detail;
  document.title = `${selected.id} ${selected.name} · OWASP Evolution`;
}

elements.detailModal.addEventListener('cancel', (event) => {
  event.preventDefault();
  returnToMatrix();
});
elements.search.addEventListener('input', (event) => renderSearchResults(event.target.value));
elements.search.addEventListener('focus', () => renderSearchResults(elements.search.value));
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
// Leaving a row, even into a gap or header, returns to the committed selection.
elements.timelineGrid.addEventListener('pointerover', (event) => {
  if (event.pointerType === 'touch') return;
  const key = event.target.closest('.risk-card')?.dataset.key ?? null;
  if (key === hoverKey) return;
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
window.addEventListener('resize', updateDock);
// ResizeObserver runs after layout and before paint, including every grid transition frame.
new ResizeObserver(drawConnections).observe(document.querySelector('.timeline-scroll'));
narrowScreen.addEventListener('change', updateDock);
new ResizeObserver(drawConnections).observe(elements.timelineStage);

render();
if (entryPending) enterPage();

document.querySelector('#language-select').addEventListener('change', (event) => {
  language = event.target.value;
  saveLanguagePreference(window, language);
  catalog = localizeCatalog(sourceCatalog, language);
  render();
  renderSearchResults(elements.search.value);
});

const themeSelect = document.querySelector('#theme-select');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(preference) {
  document.documentElement.dataset.themePreference = preference;
  const theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#111111' : '#f7f7f7';
  themeSelect.value = preference;
}
themeSelect.addEventListener('change', () => {
  try { localStorage.setItem('owasp-theme', themeSelect.value); } catch {}
  applyTheme(themeSelect.value);
});
systemTheme.addEventListener('change', () => applyTheme(document.documentElement.dataset.themePreference));
applyTheme(document.documentElement.dataset.themePreference);

const exportButton = document.querySelector('#export-button');
const exportMenu = document.querySelector('#export-menu');
function closeExport(restore = false) {
  exportMenu.hidden = true;
  exportButton.setAttribute('aria-expanded', 'false');
  if (restore) exportButton.focus();
}
function openExport(last = false) {
  exportMenu.querySelector('[data-export="md"]').disabled = !getRisk(catalog, currentRoute.family, currentRoute.year, currentRoute.id);
  exportMenu.hidden = false;
  exportButton.setAttribute('aria-expanded', 'true');
  const items = [...exportMenu.querySelectorAll('button:not(:disabled)')];
  (last ? items.at(-1) : items[0]).focus();
}
exportButton.addEventListener('click', () => exportMenu.hidden ? openExport() : closeExport(true));
exportButton.addEventListener('keydown', (event) => {
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openExport(event.key === 'ArrowUp'); }
});
exportMenu.addEventListener('keydown', (event) => {
  const items = [...exportMenu.querySelectorAll('button:not(:disabled)')];
  const index = items.indexOf(document.activeElement);
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Tab'].includes(event.key)) {
    if (event.key === 'Tab') { closeExport(); return; }
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { closeExport(true); return; }
    items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  }
});
document.addEventListener('click', (event) => { if (!event.target.closest('.export-control')) closeExport(); });
exportMenu.addEventListener('focusout', (event) => { if (!event.relatedTarget?.closest('.export-control')) closeExport(); });
exportMenu.addEventListener('click', async (event) => {
  const format = event.target.dataset.export;
  if (!format || event.target.disabled) return;
  closeExport(true);
  const family = catalog.families[currentRoute.family];
  const years = [...yearFilters.get(family.id)];
  const item = getRisk(catalog, family.id, currentRoute.year, currentRoute.id);
  try {
    let blob;
    if (format === 'png' || format === 'svg') {
      await document.fonts.ready;
      drawConnections();
      const image = matrixSVG(elements.timelineStage, language);
      blob = format === 'png' ? await pngBlob(image) : new Blob([image.svg], { type: 'image/svg+xml;charset=utf-8' });
    } else {
      const content = format === 'csv' ? exportCSV(family, years) : format === 'json' ? exportJSON(family, years) : exportMarkdown(family, currentRoute.year, item, language);
      blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8' });
    }
    download(blob, exportFilename(family.id, years, format));
  } catch (error) {
    document.querySelector('#export-status').textContent = t('No se pudo exportar. Inténtalo de nuevo.');
    console.error(error);
  }
});
