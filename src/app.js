import { sharedTooltip } from './tooltip.js';
import { lineageEditions } from './lineage.js';
import { uiIcon } from './icons.js';
import { shortcutRows, shortcutCommand } from './shortcuts.js';
import { iconSVG, attackSectionHTML } from './visuals.js';
import { pathFor, routeFrom, languageOf } from './routes.js';
import { menuButton } from './menu.js';
import { exportFilename, exportCSV, exportJSON, exportMarkdown, matrixSVG, pngBlob, download } from './export.js';
import { saveLanguagePreference } from './locale.js';
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
  relationshipLabel,
} from './model.js';

const applyStaticLanguage = staticTranslator(document);
let language = languageOf(location.pathname);
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

let currentRoute = routeFrom(location.pathname, catalog, location.hash);
if (/\/\d{4}\//.test(location.pathname) && !location.hash.startsWith('#/')) {
  history.replaceState({ ...history.state, route: currentRoute }, '', location.href);
}
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
let detailSignature = '';
let fullscreen = false;
let fullscreenReturn = null;
let detailMenu = null;
let sectionObserver = null;
let stopSectionTracking = null;
let lineageTitleObserver = null;
let feedbackTimer = null;
const tooltips = sharedTooltip(document);
let pendingReveal = false;
let settling = [];
let layoutFrame = 0;
let layoutEasing = false;
let modalExit = 0;
const shell = document.querySelector('.explorer-shell');
const resizer = document.querySelector('#dock-resizer');
const narrowScreen = matchMedia('(max-width: 640px), (pointer: coarse) and (max-width: 900px)');
const dockPreferences = { desktop: { side: 'left', width: 380, height: 320 }, mobile: { side: 'bottom', height: 0 } };
try {
  const saved = JSON.parse(localStorage.getItem('owasp-dock-layout') || '{}');
  for (const key of ['desktop', 'mobile']) {
    const value = saved[key];
    if (!value) continue;
    if (['left', 'right', 'bottom'].includes(value.side)) dockPreferences[key].side = value.side;
    for (const size of ['width', 'height']) if (Number.isFinite(value[size]) && value[size] > 0) dockPreferences[key][size] = value[size];
  }
  if (!saved.desktop) {
    const legacy = localStorage.getItem('owasp-dock');
    if (['left', 'right', 'bottom'].includes(legacy)) dockPreferences.desktop.side = legacy;
  }
} catch {}
let dockPosition = dockPreferences.desktop.side;
let dragSize = null;
const preference = () => dockPreferences[narrowScreen.matches ? 'mobile' : 'desktop'];
function saveDock() {
  try {
    localStorage.setItem('owasp-dock-layout', JSON.stringify(dockPreferences));
    localStorage.setItem('owasp-dock', dockPreferences.desktop.side);
  } catch {}
}
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
const emphasisKey = () => currentRoute.detail ? selectedKey : hoverKey ?? focusKey ?? selectedKey;
const resolveDetailReturn = () => elements.timelineStage.querySelector('.is-selected .risk-focus');

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function visualNode(markup, className) {
  if (!markup) return null;
  const element = node('div', className);
  element.innerHTML = markup;
  return element;
}

function navigate(route) {
  if (currentRoute.detail && route.detail === undefined) route = { ...route, detail: true };
  history.pushState({ route }, '', pathFor(route, catalog, language));
  render();
}

function openDetail() {
  if (currentRoute.detail) return;
  matrixReturnHash = pathFor({ family: currentRoute.family }, catalog, language);
  history.pushState({ matrixReturnHash }, '', pathFor(currentRoute, catalog, language));
  render();
}

function returnToMatrix() {
  if (matrixReturnHash && history.state?.matrixReturnHash === matrixReturnHash) {
    history.back();
  } else {
    history.replaceState({ route: { ...currentRoute, detail: false } }, '', pathFor({ family: currentRoute.family }, catalog, language));
    render();
  }
}

function renderFamilyNav() {
  elements.familyNav.dataset.segment = currentRoute.family === 'llm' ? '1' : '0';
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
      navigate({ family: family.id, year: edition.year, id: edition.items[0].id, detail: false });
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
  elements.timelineGrid.style.height = '';
  for (const column of elements.timelineGrid.children) {
    column.style.width = '';
    column.style.removeProperty('--risk-row-height');
  }
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
  elements.timelineStage.style.setProperty('--edition-count', editions.length);
  elements.timelineGrid.style.setProperty('--edition-count', editions.length);
  elements.timelineGrid.dataset.editions = String(editions.length);
  elements.timelineStage.dataset.editions = String(editions.length);
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
    const year = node('h2', 'edition-year', String(edition.year));
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
      button.title = [risk.name, `${risk.id} · ${risk.year}`, risk.change, t('Enter: abrir detalle · ↑↓: navegar')].filter(Boolean).join('\n');

      const rank = node('span', 'risk-rank', String(risk.rank).padStart(2, '0'));
      const icon = iconSVG(family.id, edition.year, risk.id, '', 'risk-icon matrix-icon');
      if (icon) button.classList.add('has-icon');
      const copy = node('span', 'risk-copy');
      copy.append(node('span', 'risk-name', risk.name), node('span', 'risk-summary', risk.summary));
      button.append(rank);
      if (icon) button.insertAdjacentHTML('beforeend', icon);
      button.append(copy);
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
// The inert snapshot stays at its painted position while the new matrix eases
// to its centered position. Both remain outside the chrome's layout.
function captureFamily() {
  familyExit?.remove();
  familyAnimations.forEach((animation) => animation.cancel());
  familyAnimations = [];
  if (reducedMotion()) return null;
  stopReveal();
  stopSettle();
  const snapshot = elements.timelineStage.cloneNode(true);
  const scroll = elements.timelineStage.parentElement;
  const box = elements.timelineStage.getBoundingClientRect();
  const area = scroll.getBoundingClientRect();
  Object.assign(snapshot.style, { top: `${box.top - area.top + scroll.scrollTop}px`, bottom: 'auto', height: `${box.height}px`, margin: '0' });
  snapshot.dataset.top = String(box.top);
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
  const offset = Number(snapshot.dataset.top) - elements.timelineStage.getBoundingClientRect().top;
  familyAnimations.push(elements.timelineStage.animate([
    { transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' },
  ], { duration: MOTION.family, easing: EASE }));
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
  // Include the centering offset in FLIP so a change in row count cannot jump.
  const stage = elements.timelineStage.parentElement.getBoundingClientRect();
  return new Map([...elements.timelineGrid.children].map((column) => {
    const box = column.getBoundingClientRect();
    return [Number(column.dataset.year), { x: box.left - stage.left, y: box.top - stage.top, width: box.width, rowHeight: column.querySelector('.risk-card').getBoundingClientRect().height }];
  }));
}

// Invert synchronously before paint. Every frame measures the transformed cards,
// keeping the same SVG paths attached to the moving columns.
function easeColumns(before) {
  const columns = [...elements.timelineGrid.children];
  const after = columnBoxes();
  const deltas = layoutDeltas(before, after);
  // Hold the final stage height so its centering does not drift as rows resize.
  elements.timelineGrid.style.height = `${elements.timelineGrid.getBoundingClientRect().height}px`;
  const paint = remaining => {
    for (const column of columns) {
      const year = Number(column.dataset.year);
      const previous = before.get(year), target = after.get(year), delta = deltas.get(year);
      column.style.transform = delta && remaining ? `translate(${delta.x * remaining}px, ${delta.y * remaining}px)` : '';
      if (previous && remaining) {
        column.style.width = `${target.width + (previous.width - target.width) * remaining}px`;
        column.style.setProperty('--risk-row-height', `${target.rowHeight + (previous.rowHeight - target.rowHeight) * remaining}px`);
      } else {
        column.style.width = '';
        column.style.removeProperty('--risk-row-height');
      }
    }
  };
  paint(1);
  for (const column of columns) if (!before.has(Number(column.dataset.year))) column.animate(
    [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
    { duration: MOTION.layout, easing: EASE });
  layoutEasing = true;
  drawConnections();
  let start;
  const frame = now => {
    start ??= now;
    const progress = Math.min(1, (now - start) / MOTION.layout);
    paint(1 - easeOut(progress));
    if (progress === 1) elements.timelineGrid.style.height = '';
    drawConnections();
    layoutEasing = progress < 1;
    layoutFrame = layoutEasing ? requestAnimationFrame(frame) : 0;
  };
  layoutFrame = requestAnimationFrame(frame);
}

function enterPage() {
  entryPending = false;
  if (reducedMotion()) return;
  stopSettle();
  pendingReveal = false;
  const rise = (element, delay, shift = 12) => {
    const animation = element.animate(
      [{ opacity: 0, transform: `translateY(${shift}px)` }, { opacity: 1, transform: 'none' }],
      { duration: MOTION.entryRise, delay, easing: EASE, fill: 'backwards' });
    if (element.classList.contains('edition-column')) animation.onfinish = drawConnections;
    entryAnimations.push(animation);
  };
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
    const button = node('button', 'edition-toggle', String(edition.year));
    button.type = 'button';
    button.dataset.year = edition.year;
    button.setAttribute('aria-pressed', String(years.has(edition.year)));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...options.children];
      const index = buttons.indexOf(button);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    });
    button.addEventListener('click', () => {
      const feedback = document.querySelector('#edition-feedback');
      if (years.has(edition.year) && years.size === 1) {
        feedback.textContent = t('Mantén al menos una edición visible.');
        return;
      }
      feedback.textContent = '';
      if (years.has(edition.year)) years.delete(edition.year);
      else years.add(edition.year);
      if (!years.has(currentRoute.year)) {
        const replacement = visibleEditions(family, years).at(-1);
        navigate({ family: family.id, year: replacement.year, id: replacement.items[0].id });
      } else render();
      scheduleFocus(() => document.querySelector(`#edition-options button[data-year="${edition.year}"]`));
    });
    options.append(button);
  }
}

function pressFeedback(button) {
  if (!reducedMotion()) button.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 120, easing: EASE });
}

function actionButton(action, icon, label, hint, handler) {
  const button = node('button', 'detail-action');
  button.type = 'button';
  button.dataset.action = action;
  button.setAttribute('aria-label', t(label));
  button.dataset.tooltip = t(label);
  if (hint) button.dataset.hint = hint;
  if (['fullscreen', 'close'].includes(action)) button.setAttribute('aria-keyshortcuts', action === 'fullscreen' ? 'F' : 'Escape');
  button.insertAdjacentHTML('beforeend', uiIcon(icon));
  button.addEventListener('click', () => { pressFeedback(button); handler(); });
  return button;
}

function detailFeedback(message, error = false, copied = false) {
  clearTimeout(feedbackTimer);
  const status = elements.detailPage.querySelector('.detail-feedback');
  const announcement = elements.detailPage.querySelector('.detail-announcement');
  const overflow = elements.detailPage.querySelector('[data-action="overflow"]');
  const copy = elements.detailPage.querySelector('[data-action="copy"]');
  const resetCopy = () => {
    if (!overflow?.isConnected) return;
    overflow.querySelector('svg').outerHTML = uiIcon('dots-three');
    overflow.dataset.tooltip = t('Más acciones');
    overflow.setAttribute('aria-label', t('Más acciones'));
    copy.querySelector('svg').outerHTML = uiIcon('link');
    copy.querySelector('.menu-label').textContent = t('Copiar enlace');
  };
  resetCopy();
  status.textContent = message;
  announcement.textContent = '';
  requestAnimationFrame(() => { if (announcement.isConnected) announcement.textContent = message; });
  status.classList.toggle('is-error', error);
  status.hidden = false;
  if (copied) {
    overflow.querySelector('svg').outerHTML = uiIcon('check');
    overflow.dataset.tooltip = message;
    overflow.setAttribute('aria-label', message);
    copy.querySelector('svg').outerHTML = uiIcon('check');
    copy.querySelector('.menu-label').textContent = message;
  }
  feedbackTimer = setTimeout(() => { status.hidden = true; status.textContent = ''; resetCopy(); }, error ? 4000 : 1500);
}

function detailOverflow(family, risk) {
  const wrap = node('div', 'detail-overflow');
  const button = actionButton('overflow', 'dots-three', 'Más acciones', '', () => {});
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'detail-menu');
  const menu = node('div', 'detail-menu');
  menu.id = 'detail-menu';
  menu.setAttribute('popover', 'manual');
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', t('Acciones del detalle'));
  menu.hidden = true;
  const docks = node('div', 'detail-dock-menu');
  docks.id = 'dock-select';
  docks.setAttribute('role', 'group');
  docks.setAttribute('aria-label', t('Posición del panel'));
  function menuItem(action, icon, label, hint, handler, parent = menu) {
    const item = node('button', 'detail-menu-item');
    item.type = 'button';
    item.dataset.action = action;
    item.setAttribute('role', 'menuitem');
    item.tabIndex = -1;
    item.insertAdjacentHTML('beforeend', uiIcon(icon));
    item.append(node('span', 'menu-label', t(label)));
    if (hint) item.append(node('kbd', '', hint));
    item.addEventListener('click', () => { pressFeedback(item); detailMenu.close(true); handler(); });
    parent.append(item);
    return item;
  }
  for (const [index, [value, label, icon]] of [['left', 'Panel a la izquierda', 'sidebar-simple'], ['right', 'Panel a la derecha', 'sidebar-simple'], ['bottom', 'Panel abajo', 'layout']].entries()) {
    const item = menuItem(`dock-${value}`, icon, label, String(index + 1), () => {
      setDock(value);
      detailFeedback(t(label));
    }, docks);
    item.dataset.dock = value;
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(value === dockPosition));
    item.setAttribute('aria-pressed', String(value === dockPosition));
    item.disabled = narrowScreen.matches;
  }
  docks.hidden = narrowScreen.matches;
  menu.append(docks);
  const separator = node('div', 'detail-menu-separator');
  separator.setAttribute('role', 'separator');
  menu.append(separator);
  menuItem('copy', 'link', 'Copiar enlace', '', async () => {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      if (button.isConnected) detailFeedback(t('Copiado'), false, true);
    } catch { if (button.isConnected) detailFeedback(t('No se pudo copiar el enlace'), true); }
  });
  menuItem('markdown', 'download-simple', 'Exportar Markdown', '', () => {
    try {
      download(new Blob([exportMarkdown(family, risk.year, risk, language)], { type: 'text/markdown;charset=utf-8' }), `owasp-${family.id}-${risk.year}-${risk.id}.md`);
      detailFeedback(t('Descargado'));
    } catch { detailFeedback(t('No se pudo exportar. Inténtalo de nuevo.'), true); }
  });
  menuItem('shortcuts', 'keyboard', 'Atajos de teclado', '?', showShortcuts);
  wrap.append(button, menu);
  detailMenu = menuButton(button, menu);
  return wrap;
}

function moveSelection(key) {
  const card = cardByKey(currentRoute.detail ? selectedKey : focusKey || selectedKey);
  const target = card && rowTarget(card, key);
  if (!target?.classList.contains('risk-card')) return;
  const year = yearOf(target.dataset.key), id = idOf(target.dataset.key);
  navigate({ family: currentRoute.family, year, id });
  if (!currentRoute.detail) target.querySelector('.risk-focus').focus({ preventScroll: true });
}

function setDock(position) {
  if (!currentRoute.detail || narrowScreen.matches) return;
  if (fullscreen) toggleFullscreen();
  dockPosition = position;
  dockPreferences.desktop.side = position;
  saveDock(); updateDock();
}

function toggleFullscreen() {
  if (!currentRoute.detail) return;
  const panel = elements.detailModal;
  if (!fullscreen) {
    fullscreenReturn = document.activeElement;
    panel.close();
    fullscreen = true;
    panel.classList.add('is-fullscreen');
    panel.showModal();
  } else {
    panel.close();
    fullscreen = false;
    panel.classList.remove('is-fullscreen');
    panel.show();
  }
  const button = elements.detailPage.querySelector('[data-action="fullscreen"]');
  button.setAttribute('aria-label', t(fullscreen ? 'Volver al panel' : 'Abrir en pantalla completa'));
  button.dataset.tooltip = button.getAttribute('aria-label');
  button.setAttribute('aria-pressed', String(fullscreen));
  pressFeedback(button);
  button.querySelector('svg').outerHTML = uiIcon(fullscreen ? 'arrows-in' : 'arrows-out');
  scheduleFocus(() => fullscreen ? button : (fullscreenReturn?.isConnected ? fullscreenReturn : button));
}

function sectionNav(hasAttack) {
  const nav = node('nav', 'detail-section-nav');
  nav.setAttribute('aria-label', t('Secciones del detalle'));
  const tabs = node('div', 'detail-tabs');
  nav.append(tabs);
  for (const [id, label] of [['overview', 'Resumen'], ...(hasAttack ? [['attack', 'Ataque'], ['example', 'Ejemplo']] : []), ['prevention', 'Prevención'], ['lineage', 'Linaje'], ['sources', 'Fuentes']]) {
    const link = node('a', '', t(label));
    link.href = `#detail-${id}`;
    link.addEventListener('click', event => {
      event.preventDefault();
      elements.detailPage.querySelector(`#detail-${id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' });
    });
    tabs.append(link);
  }
  return nav;
}

function trackSections(body) {
  const listeners = new AbortController();
  const on = (element, type, handler) => element.addEventListener(type, handler, { passive: true, signal: listeners.signal });
  let requestedSection = null;
  const nav = body.querySelector('.detail-section-nav');
  const tabs = nav.querySelector('.detail-tabs');
  const fadeEdges = () => {
    nav.classList.toggle('has-left-overflow', tabs.scrollLeft > 1);
    nav.classList.toggle('has-right-overflow', tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 1);
  };
  on(tabs, 'scroll', fadeEdges);
  const tabObserver = new ResizeObserver(fadeEdges);
  tabObserver.observe(tabs);
  const links = [...nav.querySelectorAll('a')];
  const sections = links.map(link => body.querySelector(link.getAttribute('href')));
  const update = () => {
    const edge = body.getBoundingClientRect().top + nav.offsetHeight + 20;
    const visible = sections.filter(section => section.getBoundingClientRect().top <= edge && section.getBoundingClientRect().bottom > edge);
    // Nested Example wins within Attack; in two columns prefer the nearest heading.
    const requested = requestedSection?.getBoundingClientRect();
    // A short section in either fullscreen column may be unable to reach the top.
    const active = requested && requested.bottom > edge && requested.top < body.getBoundingClientRect().bottom ? requestedSection
      : visible.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0]
      ?? sections.filter(section => section.getBoundingClientRect().top <= edge).at(-1) ?? sections[0];
    for (const link of links) {
      if (link.hash === `#${active.id}`) {
        const changed = !link.hasAttribute('aria-current');
        link.setAttribute('aria-current', 'location');
        if (changed) {
          const left = link.offsetLeft, right = left + link.offsetWidth;
          if (left < tabs.scrollLeft + 12) tabs.scrollLeft = Math.max(0, left - 12);
          else if (right > tabs.scrollLeft + tabs.clientWidth - 12) tabs.scrollLeft = right - tabs.clientWidth + 12;
          fadeEdges();
        }
      }
      else link.removeAttribute('aria-current');
    }
  };
  sectionObserver = new IntersectionObserver(update, { root: body, threshold: [0, .1, .5, 1] });
  sections.forEach(section => sectionObserver.observe(section));
  // Also sample scroll positions inside a tall section and after viewport changes.
  on(body, 'scroll', () => {
    if (body.scrollTop <= 1) requestedSection = null;
    update();
  });
  on(nav, 'click', event => {
    const link = event.target.closest('a');
    if (link) { requestedSection = body.querySelector(link.hash); update(); }
  });
  const manualScroll = () => { requestedSection = null; update(); };
  on(body, 'wheel', manualScroll);
  on(body, 'touchstart', manualScroll);
  on(body, 'pointerdown', event => { if (!event.target.closest('.detail-section-nav')) manualScroll(); });
  on(body, 'keydown', event => { if (['PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) manualScroll(); });
  stopSectionTracking = () => { listeners.abort(); tabObserver.disconnect(); };
  requestAnimationFrame(update);
}

function renderLineage(family, risk, lineage) {
  const list = node('ol', 'lineage-list');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', t('Linaje en el tiempo'));
  const groups = lineageEditions(family, lineage, risk.key);
  const navigateItem = item => navigate({ family: family.id, year: item.year, id: item.id, detail: true });
  for (const group of groups) {
    const entry = node('li', 'lineage-item');
    entry.dataset.year = group.year;
    if (group.nodes.some(item => item.selected)) entry.classList.add('has-current');
    const year = node('span', 'lineage-year', String(group.year));
    const content = node('div', 'lineage-edition');
    const allNew = group.nodes.length > 0 && group.nodes.every(item => item.isNew);
    if (allNew) content.append(node('span', 'lineage-note lineage-origin', `${t(group.nodes.length > 1 ? 'Nuevas en' : 'Nueva en')} ${group.year}`));
    for (const item of group.nodes) {
      const card = node('div', 'lineage-node');
      if (item.selected) card.classList.add('is-current');
      const link = node('button', 'lineage-link');
      link.type = 'button';
      link.dataset.key = item.key;
      link.setAttribute('aria-label', `${item.year} · ${item.id} · ${item.name}`);
      if (item.selected) link.setAttribute('aria-current', 'true');
      link.append(node('span', 'lineage-id', item.id), node('span', 'lineage-title', item.name));
      link.addEventListener('click', () => navigateItem(item));
      const meta = node('div', 'lineage-meta');
      const rank = node('span', 'lineage-rank');
      rank.dataset.delta = item.delta ?? '';
      rank.dataset.movement = item.delta === null ? 'new' : item.delta > 0 ? 'up' : item.delta < 0 ? 'down' : 'same';
      rank.textContent = item.previous ? `#${item.previous.rank} → #${item.rank} ${item.delta > 0 ? '↑' : item.delta < 0 ? '↓' : '='}${Math.abs(item.delta)}` : `#${item.rank}`;
      rank.setAttribute('aria-label', item.previous ? `${t('Puesto')} ${item.previous.rank} → ${item.rank}; ${t(item.delta > 0 ? 'Sube' : item.delta < 0 ? 'Baja' : 'Sin cambio')} ${Math.abs(item.delta)}` : `${t('Puesto')} ${item.rank}`);
      meta.append(rank);
      for (const type of item.relations) meta.append(node('span', `lineage-chip line-${relationKind(type)}`, t(relationshipLabel(type))));
      if (item.isNew && !allNew) meta.append(node('span', 'lineage-note', `${t('Nueva en')} ${item.year}`));
      if (item.selected) meta.append(node('span', 'lineage-selected', t('Actual')));
      card.append(link, meta);
      if (item.merges.length) {
        const merged = node('div', 'lineage-merge');
        merged.setAttribute('role', 'group');
        merged.setAttribute('aria-label', `${t('Predecesoras fusionadas en')} ${item.year}`);
        // Label source years explicitly, under the edition where the merge occurs.
        const sourceYears = [...new Set(item.merges.map(source => source.year))];
        for (const sourceYear of sourceYears) {
          const sources = item.merges.filter(source => source.year === sourceYear);
          const row = node('div', 'lineage-merge-row');
          row.append(node('span', 'lineage-merge-year', `${sourceYear}:`));
          sources.forEach((source, index) => {
            if (index) row.append(document.createTextNode(' + '));
            const button = node('button', 'lineage-predecessor', source.id);
            button.type = 'button';
            button.dataset.key = source.key;
            button.dataset.tooltip = source.name;
            button.setAttribute('aria-label', `${source.year} · ${source.id} · ${source.name}`);
            button.addEventListener('click', () => navigateItem(source));
            row.append(button);
          });
          row.append(node('span', '', ` → ${t(sources.every(source => source.relationship === 'consolidated') ? 'Consolidada' : 'Fusionada')}`));
          merged.append(row);
        }
        card.append(merged);
      }
      content.append(card);
    }
    for (const item of group.departures) {
      const departure = node('div', 'lineage-departure');
      departure.append(node('span', 'lineage-id', item.id), node('span', 'lineage-note', `${t('Sale del Top 10 en')} ${group.year}`));
      content.append(departure);
    }
    entry.append(year, content);
    list.append(entry);
  }
  return list;
}

function renderDetail(family, risk, lineage) {
  tooltips.hide();
  detailMenu?.destroy();
  sectionObserver?.disconnect();
  lineageTitleObserver?.disconnect();
  stopSectionTracking?.();
  clearTimeout(feedbackTimer);
  elements.detailPage.replaceChildren();
  const edition = getEdition(catalog, family.id, risk.year);

  const top = node('div', 'detail-top');
  const code = node('div', 'detail-code');
  code.append(node('span', '', `${risk.id} · ${risk.year}`));
  code.append(node('span', 'detail-current', edition.status));
  const close = actionButton('close', 'x', 'Cerrar detalle', 'Esc', returnToMatrix);
  close.classList.add('detail-back');
  const toolbar = node('div', 'detail-actions');
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', t('Acciones del detalle'));
  const previous = actionButton('previous', 'caret-left', 'Elemento anterior', 'K / ↑', () => moveSelection('ArrowUp'));
  const next = actionButton('next', 'caret-right', 'Elemento siguiente', 'J / ↓', () => moveSelection('ArrowDown'));
  previous.disabled = risk.rank === 1;
  next.disabled = risk.rank === edition.items.length;
  const full = actionButton('fullscreen', fullscreen ? 'arrows-in' : 'arrows-out', fullscreen ? 'Volver al panel' : 'Abrir en pantalla completa', 'F', toggleFullscreen);
  full.setAttribute('aria-pressed', String(fullscreen));
  toolbar.append(previous, next, full, detailOverflow(family, risk), close);
  top.append(toolbar);

  const heading = node('h1', '', risk.name);
  heading.id = 'detail-title';
  heading.tabIndex = -1;
  heading.dataset.tooltip = risk.name;
  const icon = visualNode(iconSVG(family.id, risk.year, risk.id) || `<span class="risk-icon detail-fallback-icon">${uiIcon(family.id === 'web' ? 'shield-check' : 'robot')}</span>`, 'detail-icon');
  const title = node('div', 'detail-heading');
  const titleBlock = node('div', 'detail-title-block');
  titleBlock.append(heading, code);
  if (icon) title.append(icon);
  title.append(titleBlock);
  const attack = visualNode(attackSectionHTML(family.id, risk.year, risk.id, t), 'detail-attack');

  const prevention = node('section', 'detail-section');
  prevention.id = 'detail-prevention';
  prevention.append(node('h2', '', t('Prevención')));
  const preventionList = node('ul');
  for (const item of risk.prevention) preventionList.append(node('li', '', item));
  prevention.append(preventionList);

  const history = node('section', 'detail-section');
  history.id = 'detail-lineage';
  history.append(node('h2', '', t('Linaje')));
  const historyList = renderLineage(family, risk, lineage);
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
  linkSection.id = 'detail-sources';
  linkSection.append(node('h2', '', t('Fuentes')));
  const source = node('a', 'source-link', t('Abrir fuente oficial ↗'));
  source.href = risk.source;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  const sources = node('ul', 'detail-sources');
  const official = node('li'); official.append(source); sources.append(official);
  const cwes = risk.cwes || risk.cwe || [];
  for (const cwe of Array.isArray(cwes) ? cwes : [cwes]) {
    const number = String(cwe).replace(/^CWE-/, '');
    if (!/^\d+$/.test(number)) continue;
    const link = node('a', '', `CWE-${number}`);
    link.href = `https://cwe.mitre.org/data/definitions/${number}.html`;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    const entry = node('li'); entry.append(link); sources.append(entry);
  }
  linkSection.append(sources);

  const header = node('header', 'detail-header');
  const status = node('div', 'detail-feedback');
  status.setAttribute('aria-hidden', 'true');
  status.hidden = true;
  const announcement = node('span', 'sr-only detail-announcement');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  header.append(top, title, status, announcement);
  const body = node('div', 'detail-body');
  body.append(sectionNav(Boolean(attack)));
  const grid = node('div', 'detail-grid');
  const left = node('div', 'detail-primary');
  const overview = node('section', 'detail-section detail-overview');
  overview.id = 'detail-overview';
  overview.append(node('h2', '', t('Resumen')), node('p', '', risk.summary));
  left.append(overview);
  if (attack) left.append(attack);
  const right = node('div', 'detail-secondary');
  right.append(prevention, history, relations, linkSection);
  grid.append(left, right);
  body.append(grid);
  elements.detailPage.append(header, body);
  trackSections(body);
  lineageTitleObserver = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const link = target.closest('.lineage-link');
      if (target.scrollHeight > target.clientHeight + 1) link.dataset.tooltip = target.textContent;
      else delete link.dataset.tooltip;
    }
  });
  body.querySelectorAll('.lineage-title').forEach(title => lineageTitleObserver.observe(title));

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
        if (currentRoute.detail) return;
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

let dockLayoutFrame = 0;
let dockLayoutUntil = 0;
function followDockLayout() {
  dockLayoutUntil = performance.now() + (reducedMotion() ? 0 : MOTION.modal + 50);
  if (dockLayoutFrame) return;
  const frame = now => {
    drawConnections();
    dockLayoutFrame = now < dockLayoutUntil ? requestAnimationFrame(frame) : 0;
  };
  dockLayoutFrame = requestAnimationFrame(frame);
}
shell.addEventListener('transitionrun', event => {
  if (event.target === shell) followDockLayout();
});

function dockLimits() {
  const bottom = shell.dataset.dock === 'bottom';
  const available = bottom ? shell.clientHeight - 22 : shell.clientWidth;
  return { min: bottom ? Math.max(100, available * .25) : 240,
    max: bottom ? available * .9 : Math.max(240, available * .48), available };
}
function updateDock() {
  const position = narrowScreen.matches ? 'bottom' : dockPosition;
  shell.dataset.dock = position;
  const bottom = position === 'bottom';
  const { min, max, available } = dockLimits();
  const size = Math.max(min, Math.min(max, dragSize ?? (preference()[bottom ? 'height' : 'width'] || available * .5)));
  shell.style.setProperty('--dock-size', `${size}px`);
  resizer.setAttribute('aria-orientation', bottom ? 'horizontal' : 'vertical');
  resizer.setAttribute('aria-valuemin', String(Math.round(min)));
  resizer.setAttribute('aria-valuemax', String(Math.round(max)));
  resizer.setAttribute('aria-valuenow', String(Math.round(size)));
  resizer.setAttribute('aria-label', language === 'es' ? 'Cambiar tamaño del panel' : 'Resize panel');
  const group = document.querySelector('#dock-select');
  if (group) {
    group.hidden = narrowScreen.matches;
    for (const button of group.children) {
      button.disabled = narrowScreen.matches;
      button.setAttribute('aria-pressed', String(button.dataset.dock === position));
      button.setAttribute('aria-checked', String(button.dataset.dock === position));
    }
  }
  scheduleConnections();
}
function commitDock(size) {
  const { min, max } = dockLimits();
  preference()[shell.dataset.dock === 'bottom' ? 'height' : 'width'] = Math.max(min, Math.min(max, size));
  dragSize = null;
  saveDock();
  updateDock();
}
function resizeDock(delta) {
  commitDock(Number(resizer.getAttribute('aria-valuenow')) + delta);
}
resizer.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  resizer.setPointerCapture(event.pointerId);
  shell.classList.add('is-resizing');
  const side = shell.dataset.dock, bottom = side === 'bottom';
  const axis = e => bottom ? e.clientY : e.clientX;
  const start = axis(event), initial = Number(resizer.getAttribute('aria-valuenow'));
  const { min, max, available } = dockLimits();
  let raw = initial, velocity = 0, previous = start, time = event.timeStamp, frame = 0, paintedSize = initial;
  const paint = () => {
    frame = 0;
    dragSize = Math.max(min, Math.min(max, raw));
    updateDock();
    // Reserve matrix space first, then interpolate the growing panel with a
    // transform inside its slot. Shrinking never paints over the matrix.
    const scale = reducedMotion() ? 1 : Math.min(1, paintedSize / dragSize);
    elements.detailModal.style.transformOrigin = bottom ? 'bottom' : side === 'left' ? 'left' : 'right';
    elements.detailModal.style.transform = bottom && raw < min
      ? `translateY(${Math.min(min - raw, min)}px)`
      : `${bottom ? 'scaleY' : 'scaleX'}(${scale})`;
    paintedSize = dragSize;
    drawConnections();
  };
  const move = e => {
    if (e.pointerId !== event.pointerId) return;
    const next = axis(e), sign = side === 'left' ? 1 : -1;
    velocity = (next - previous) * sign / Math.max(1, e.timeStamp - time);
    raw = initial + (next - start) * sign;
    previous = next; time = e.timeStamp;
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const finish = e => {
    if (e.pointerId !== event.pointerId) return;
    cancelAnimationFrame(frame);
    elements.detailModal.style.transform = '';
    elements.detailModal.style.transformOrigin = '';
    shell.classList.remove('is-resizing');
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) resizer.removeEventListener(type, finish);
    resizer.removeEventListener('pointermove', move);
    const cancelled = e.type !== 'pointerup';
    const projected = raw + (performance.now() - time < 120 ? velocity * 160 : 0);
    if (!cancelled && bottom && (raw < min * .65 || projected < min * .45)) {
      dragSize = null; updateDock(); returnToMatrix();
    } else {
      let target = cancelled ? initial : projected;
      if (bottom && narrowScreen.matches && !cancelled) target = [.25, .5, .9].map(n => available * n).reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
      commitDock(target);
    }
    scheduleConnections();
  };
  resizer.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) resizer.addEventListener(type, finish);
});
resizer.addEventListener('keydown', (event) => {
  const sign = shell.dataset.dock === 'left' ? 1 : -1;
  const bottom = shell.dataset.dock === 'bottom';
  const direction = bottom ? { ArrowUp: 1, ArrowDown: -1 } : { ArrowLeft: -sign, ArrowRight: sign };
  if (!direction[event.key]) return;
  event.preventDefault();
  resizeDock(direction[event.key] * (event.shiftKey ? 40 : 10));
});
// Delegation survives detail content updates. Interactive header controls keep their behavior.
elements.detailModal.addEventListener('pointerdown', event => {
  const header = event.target.closest('.detail-header');
  if (!header || fullscreen || narrowScreen.matches || event.button !== 0 || event.target.closest('button, select, a, input')) return;
  event.preventDefault();
  header.setPointerCapture(event.pointerId);
  const x = event.clientX, y = event.clientY;
  let target = null, moved = false, frame = 0;
  const zones = ['left', 'right', 'bottom'].map(side => {
    const zone = node('div', `dock-drop dock-drop-${side}`);
    zone.setAttribute('aria-hidden', 'true'); shell.append(zone); return zone;
  });
  const move = e => {
    if (e.pointerId !== event.pointerId) return;
    moved ||= Math.hypot(e.clientX - x, e.clientY - y) > 8;
    const box = shell.getBoundingClientRect();
    target = e.clientY > box.bottom - box.height * .25 ? 'bottom' : e.clientX < box.left + box.width * .25 ? 'left' : e.clientX > box.right - box.width * .25 ? 'right' : null;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      header.style.transform = moved ? `translate(${(e.clientX - x) * .06}px, ${(e.clientY - y) * .06}px)` : '';
      zones.forEach((zone, i) => zone.classList.toggle('is-target', ['left', 'right', 'bottom'][i] === target));
    });
  };
  const finish = e => {
    if (e.pointerId !== event.pointerId) return;
    cancelAnimationFrame(frame); header.style.transform = ''; zones.forEach(zone => zone.remove());
    header.removeEventListener('pointermove', move);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) header.removeEventListener(type, finish);
    if (e.type === 'pointerup' && moved && target) {
      dockPosition = target; dockPreferences.desktop.side = target; saveDock(); updateDock();
    }
  };
  header.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) header.addEventListener(type, finish);
});

function dismissModal(done) {
  const modal = elements.detailModal;
  const finish = () => {
    keepModal();
    modal.close();
    done();
  };
  shell.classList.remove('has-detail');
  followDockLayout();
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

function updateMetadata(family, selected) {
  const category = /\/\d{4}\//.test(location.pathname);
  const isHome = /^\/(?:en\/|es\/)?$/.test(location.pathname);
  const route = category ? currentRoute : isHome ? null : { family: family.id };
  const origin = new URL(document.querySelector('link[rel="canonical"]').href).origin;
  const title = category ? `${selected.id}: ${selected.name} · ${selected.year} · ${language.toUpperCase()} · OWASP Evolution` : isHome ? `OWASP Evolution · ${language === 'es' ? 'Evolución de riesgos' : 'Risk evolution'}` : `${family.label} · ${language.toUpperCase()} · OWASP Evolution`;
  const description = category ? `${selected.id} (${selected.year}): ${selected.summary}` : isHome ? t('Explorador interactivo de la evolución del OWASP Top 10 para aplicaciones web y sistemas GenAI/LLM.') : family.description;
  document.title = title;
  document.querySelector('link[rel="canonical"]').href = origin + pathFor(route, sourceCatalog, language);
  for (const link of document.querySelectorAll('link[hreflang]')) link.href = origin + pathFor(route, sourceCatalog, link.hreflang === 'es' ? 'es' : 'en');
  for (const [selector, content] of [
    ['meta[name="description"]', description], ['meta[property="og:title"]', title], ['meta[name="twitter:title"]', title],
    ['meta[property="og:description"]', description], ['meta[name="twitter:description"]', description],
    ['meta[property="og:url"]', origin + pathFor(route, sourceCatalog, language)],
    ['meta[property="og:image"]', `${origin}/assets/og-${isHome ? 'web' : family.id}-${language}.png`],
    ['meta[name="twitter:image"]', `${origin}/assets/og-${isHome ? 'web' : family.id}-${language}.png`],
  ]) document.querySelector(selector).content = content;
  const structured = category ? [
    { '@context': 'https://schema.org', '@type': 'DefinedTerm', name: selected.name, termCode: selected.id, description: selected.summary, url: origin + pathFor(route, sourceCatalog, language), inDefinedTermSet: selected.source },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'OWASP Evolution', item: origin + pathFor(null, sourceCatalog, language) },
      { '@type': 'ListItem', position: 2, name: family.label, item: origin + pathFor({ family: family.id }, sourceCatalog, language) },
      { '@type': 'ListItem', position: 3, name: `${selected.id}: ${selected.name} (${selected.year})`, item: origin + pathFor(route, sourceCatalog, language) },
    ] },
  ] : { '@context': 'https://schema.org', '@type': isHome ? 'WebSite' : 'CollectionPage', name: title, url: origin + pathFor(route, sourceCatalog, language), inLanguage: language };
  document.querySelector('script[type="application/ld+json"]').textContent = JSON.stringify(structured);
  document.querySelector('meta[property="og:type"]').content = category ? 'article' : 'website';
  elements.brand.href = pathFor(null, sourceCatalog, language);
}

function render() {
  language = languageOf(location.pathname);
  catalog = localizeCatalog(sourceCatalog, language);
  currentRoute = location.hash.startsWith('#/') ? routeFrom(location.pathname, catalog, location.hash) : history.state?.route || routeFrom(location.pathname, catalog);
  if (location.hash.startsWith('#/')) history.replaceState({ route: currentRoute }, '', pathFor(currentRoute, catalog, language));
  document.querySelector('#prerender')?.remove?.();
  const family = catalog.families[currentRoute.family];
  yearFilters.get(family.id).add(currentRoute.year);
  const risk = getRisk(catalog, currentRoute.family, currentRoute.year, currentRoute.id);
  const selected = { ...risk, family: family.id, year: currentRoute.year, key: `${currentRoute.year}:${currentRoute.id}` };
  const lineage = getLineage(catalog, currentRoute.family, currentRoute.year, currentRoute.id);

  applyStaticLanguage(language);
  document.querySelector('#language-select').dataset.segment = language === 'en' ? '1' : '0';
  for (const button of document.querySelectorAll('[data-language]')) {
    const selected = button.dataset.language === language;
    button.setAttribute('aria-checked', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  syncThemeLabel();
  elements.search.title = `${t('Buscar categorías')} (/ · Ctrl/⌘+K)`;
  elements.search.setAttribute('aria-keyshortcuts', '/ Control+K Meta+K');
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
    const nextDetail = JSON.stringify([family.id, selected.key, language]);
    if (nextDetail !== detailSignature || !wasDetail) {
      const activeInside = elements.detailPage.contains(document.activeElement);
      const activeAction = activeInside ? document.activeElement?.dataset.action : null;
      const snapshot = wasDetail && !reducedMotion() ? elements.detailPage.cloneNode(true) : null;
      renderDetail(family, selected, lineage);
      detailSignature = nextDetail;
      elements.detailPage.querySelector('.detail-body').scrollTop = 0;
      if (snapshot) {
        snapshot.removeAttribute('id');
        snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
        snapshot.classList.add('detail-crossfade');
        snapshot.inert = true; snapshot.setAttribute('aria-hidden', 'true');
        elements.detailModal.append(snapshot);
        snapshot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE }).finished.finally(() => snapshot.remove());
        elements.detailPage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: EASE });
      }
      if (activeInside) scheduleFocus(() => elements.detailPage.querySelector(`[data-action="${activeAction}"]:not(:disabled)`), () => elements.detailPage.querySelector('#detail-title'));
      if (wasDetail) updateDock();
    }
    if (!wasDetail) {
      keepModal();
      if (!elements.detailModal.open) elements.detailModal.show();
      elements.detailModal.inert = false;
      updateDock();
      shell.classList.add('has-detail');
      followDockLayout();
      elements.detailModal.scrollTop = 0;
      scheduleFocus(() => elements.detailPage.querySelector('#detail-title'));
    }
  } else if (wasDetail) {
    if (fullscreen) {
      fullscreen = false;
      elements.detailModal.classList.remove('is-fullscreen');
    }
    dismissModal(() => {
      scheduleFocus(resolveDetailReturn);
      scheduleConnections();
    });
  }
  if (detail !== wasDetail) updateEmphasis();
  wasDetail = detail;
  updateMetadata(family, selected);
}

elements.detailModal.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (fullscreen) toggleFullscreen();
  else returnToMatrix();
});
elements.search.addEventListener('input', (event) => renderSearchResults(event.target.value));
elements.search.addEventListener('focus', () => renderSearchResults(elements.search.value));
document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-wrap')) hideSearchResults();
});
// Native modal dialogs provide background isolation; Tab wrapping is explicit too.
function trapFocus(event, dialog) {
  if (event.key !== 'Tab') return;
  const controls = [...dialog.querySelectorAll('button, a[href], input, [tabindex="0"]')].filter(el => !el.disabled && !el.closest('[hidden], [inert]') && el.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
    event.preventDefault(); last?.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
    event.preventDefault(); first?.focus();
  }
}
const shortcutsDialog = node('dialog', 'shortcuts-dialog');
shortcutsDialog.id = 'shortcuts-dialog';
shortcutsDialog.setAttribute('aria-labelledby', 'shortcuts-title');
document.body.append(shortcutsDialog);
let helpReturn = null;
function showShortcuts() {
  helpReturn = document.activeElement;
  shortcutsDialog.replaceChildren();
  const title = node('h2', '', 'Atajos de teclado / Keyboard shortcuts');
  title.id = 'shortcuts-title';
  const close = actionButton('close-help', 'x', 'Cerrar ayuda', 'Esc', closeShortcuts);
  const top = node('div', 'shortcuts-top'); top.append(title, close);
  const list = node('dl', 'shortcuts-list');
  for (const [keys, es, en] of shortcutRows) {
    const key = node('dt'); key.append(node('kbd', '', keys));
    const description = node('dd');
    const spanish = node('span', '', es); spanish.lang = 'es';
    const english = node('span', '', en); english.lang = 'en';
    description.append(spanish, english);
    list.append(key, description);
  }
  shortcutsDialog.append(top, list, node('p', 'shortcuts-note', 'Los atajos se desactivan al escribir. / Shortcuts pause while typing.'));
  title.tabIndex = -1;
  shortcutsDialog.showModal(); title.focus();
}
function closeShortcuts() {
  shortcutsDialog.close();
  scheduleFocus(() => helpReturn);
}
shortcutsDialog.addEventListener('cancel', event => { event.preventDefault(); closeShortcuts(); });
shortcutsDialog.addEventListener('click', event => { if (event.target === shortcutsDialog) {
  const box = shortcutsDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeShortcuts();
} });
elements.detailModal.addEventListener('click', event => {
  if (!fullscreen || event.target !== elements.detailModal) return;
  const box = elements.detailModal.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) toggleFullscreen();
});
document.addEventListener('keydown', (event) => {
  if (shortcutsDialog.open) { trapFocus(event, shortcutsDialog); return; }
  if (fullscreen) trapFocus(event, elements.detailModal);
  if (event.defaultPrevented || event.isComposing || event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
  const command = shortcutCommand(event);
  if (!command) return;
  if (command === 'search') { event.preventDefault(); if (fullscreen) toggleFullscreen(); elements.search.focus(); scheduleFocus(() => elements.search); return; }
  if (command === 'help') { event.preventDefault(); showShortcuts(); return; }
  if (command === 'escape') {
    event.preventDefault();
    if (fullscreen) toggleFullscreen();
    else if (currentRoute.detail) returnToMatrix();
    else { elements.search.value = ''; hideSearchResults(); elements.search.blur(); }
    return;
  }
  if (command === 'fullscreen') { if (currentRoute.detail) { event.preventDefault(); toggleFullscreen(); } return; }
  if (command.startsWith('dock:')) { if (currentRoute.detail) { event.preventDefault(); setDock(command.split(':')[1]); } return; }
  const card = event.target.closest('.risk-card');
  if (command === 'open') {
    // Other focused buttons retain their native Enter behavior.
    if (!card) return;
    event.preventDefault();
    navigate({ family: currentRoute.family, year: yearOf(card.dataset.key), id: idOf(card.dataset.key), detail: true });
    return;
  }
  if (event.target.closest('button, a, [role="menu"]') && !card && !currentRoute.detail) return;
  if (!command.startsWith('move:')) return;
  event.preventDefault();
  moveSelection(command.split(':')[1]);
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
window.addEventListener('popstate', render);
window.addEventListener('resize', updateDock);
// ResizeObserver runs after layout and before paint, including every grid transition frame.
new ResizeObserver(drawConnections).observe(document.querySelector('.timeline-scroll'));
narrowScreen.addEventListener('change', updateDock);
new ResizeObserver(drawConnections).observe(elements.timelineStage);

render();
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('booting')));
if (entryPending) enterPage();

const languageSelect = document.querySelector('#language-select');
function switchLanguage(nextLanguage) {
  if (nextLanguage === language) return;
  language = nextLanguage;
  saveLanguagePreference(window, language);
  const languageRoute = /^(?:\/(?:en|es))?\/$/.test(location.pathname) ? null : /\/\d{4}\//.test(location.pathname) ? currentRoute : { family: currentRoute.family };
  history.pushState({ route: currentRoute }, '', pathFor(languageRoute, sourceCatalog, language));
  catalog = localizeCatalog(sourceCatalog, language);
  render();
  renderSearchResults(elements.search.value);
  languageSelect.querySelector('[aria-checked="true"]').focus({ preventScroll: true });
}
languageSelect.addEventListener('click', () => switchLanguage(language === 'es' ? 'en' : 'es'));
languageSelect.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  switchLanguage(event.key === 'Home' ? 'es' : event.key === 'End' ? 'en' : language === 'es' ? 'en' : 'es');
});

const themeSelect = document.querySelector('#theme-select');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(preference) {
  document.documentElement.dataset.themePreference = preference;
  const theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#111111' : '#f7f7f7';
  syncThemeLabel();
}
function syncThemeLabel() {
  const preference = document.documentElement.dataset.themePreference;
  document.querySelector('#theme-value').textContent = t({ system: 'Sistema', dark: 'Oscuro', light: 'Claro' }[preference]);
  for (const item of document.querySelectorAll('[data-theme-choice]')) item.setAttribute('aria-checked', String(item.dataset.themeChoice === preference));
}
const themeMenu = menuButton(themeSelect, document.querySelector('#theme-menu'));
document.querySelector('#theme-menu').addEventListener('click', event => {
  const preference = event.target.closest('[data-theme-choice]')?.dataset.themeChoice;
  if (!preference) return;
  try { localStorage.setItem('owasp-theme', preference); } catch {}
  applyTheme(preference); themeMenu.close(true);
});
systemTheme.addEventListener('change', () => applyTheme(document.documentElement.dataset.themePreference));
applyTheme(document.documentElement.dataset.themePreference);

const exportButton = document.querySelector('#export-button');
const exportMenu = document.querySelector('#export-menu');
const { close: closeExport } = menuButton(exportButton, exportMenu);
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
  } catch {
    document.querySelector('#export-status').textContent = t('No se pudo exportar. Inténtalo de nuevo.');
  }
});

elements.brand.addEventListener('click', event => { event.preventDefault(); history.pushState(null, '', pathFor(null, sourceCatalog, language)); render(); });
