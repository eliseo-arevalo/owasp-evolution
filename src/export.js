import { diagramSVG, getVisual } from './visuals.js';
import { translate } from './i18n.js';
import { slug } from './routes.js';
import { getLineage, relationshipLabel } from './model.js';
// Pure data generators also work in Node, without browser APIs.
export function exportFilename(family, years, format) {
  return `owasp-evolution-${String(family).replace(/[^a-z0-9-]/gi, '-')}-${[...years].map(Number).sort((a, b) => a - b).join('-')}.${format}`;
}

export function exportRows(family, years, language = 'es') {
  const visible = new Set([...years].map(Number));
  return family.editions.filter((edition) => visible.has(edition.year)).flatMap((edition) => edition.items.map((item) => {
    const key = `${edition.year}:${item.id}`;
    const links = family.edges.filter((edge) => (edge.from === key || edge.to === key) && visible.has(Number(edge.from.split(':')[0])) && visible.has(Number(edge.to.split(':')[0])));
    // IDs, JSON keys and relationship enums are stable machine-readable schema values.
    return { family: family.id, year: edition.year, code: item.id, name: translate(item.name, language), position: item.rank,
      lineage_type: [...new Set(links.map((edge) => edge.type))].join(';'),
      linked_to: [...new Set(links.map((edge) => edge.from === key ? edge.to : edge.from))].join(';') };
  }));
}
const columns = ['family', 'year', 'code', 'name', 'position', 'lineage_type', 'linked_to'];
const columnLabels = ['Familia', 'Año', 'Código', 'Nombre', 'Puesto', 'Tipo de linaje', 'Relacionado con'];
export function exportCSV(family, years, language = 'es') {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  return [columnLabels.map(label => translate(label, language)).join(','), ...exportRows(family, years, language).map((row) => columns.map((column) => quote(row[column])).join(','))].join('\r\n') + '\r\n';
}
export const exportJSON = (family, years, language = 'es') => JSON.stringify(exportRows(family, years, language), null, 2) + '\n';
const markdown = (value = '') => String(value).replace(/[\\`*_[\]<>#|]/g, '\\$&').replace(/\r?\n/g, ' ');
const base64 = value => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const permalink = (family, year, item, language, origin) => `${origin.replace(/\/$/, '')}${language === 'es' ? '/es' : ''}/${family.id === 'llm' ? 'genai' : family.id}/${year}/${slug(item)}/`;
const fence = (code, language) => {
  const ticks = '`'.repeat(Math.max(3, ...[...code.matchAll(/`+/g)].map(match => match[0].length + 1)));
  return `${ticks}${language}\n${code}\n${ticks}`;
};
const codeLanguage = code => /^(Task|Prompt|Answer):/m.test(code) ? 'text' : /^\s*[\w-]+:\s*\n/.test(code) ? 'yaml' : /^(GET|POST|PUT|DELETE) /m.test(code) ? 'http' : /npm |pip |curl |docker /m.test(code) ? 'bash' : /innerHTML|textContent|const |let |JSON\./.test(code) ? 'javascript' : 'python';

export function exportMarkdown(family, year, item, language = 'es', { years = family.editions.map(e => e.year), origin = 'https://owasp-evolution.vercel.app' } = {}) {
  const t = text => translate(text, language);
  if (!item) {
    const headings = ['Familia', 'Año', 'Código', 'Nombre', 'Puesto', 'Enlaces'].map(t);
    const rows = exportRows(family, years, language).map(row => {
      const risk = family.editions.find(e => e.year === row.year).items.find(i => i.id === row.code);
      return `| ${[t(family.label), row.year, row.code, row.name, row.position].map(markdown).join(' | ')} | [${t('Detalle')}](${permalink(family, row.year, risk, language, origin)})${row.linked_to ? ` · ${markdown(row.linked_to)}` : ''} |`;
    });
    return `# ${t('OWASP Evolution')} · ${markdown(t(family.label))}\n\n| ${headings.join(' | ')} |\n| ${headings.map(() => '---').join(' | ')} |\n${rows.join('\n')}\n`;
  }
  const edition = family.editions.find(e => e.year === Number(year));
  const key = `${year}:${item.id}`;
  const links = family.edges.filter(edge => edge.from === key || edge.to === key);
  const lineage = getLineage({ families: { [family.id]: family } }, family.id, year, item.id);
  const chronology = lineage.nodes.map(risk => `- [${markdown(risk.key)} · ${markdown(t(risk.name))}](${permalink(family, risk.year, risk, language, origin)}) · ${t('Puesto')} ${risk.rank}`).join('\n');
  const visual = getVisual(family.id, year, item.id);
  let attack = '';
  if (visual) {
    // Preserve the live diagram's geometry and labels, with styles baked in for Markdown readers.
    const diagram = diagramSVG(family.id, year, item.id, t).replace(/(<svg[^>]*>)/, '$1<style>text{font:11px Arial,sans-serif;fill:#eeeeee}.attack-box{fill:#222;stroke:#777}.attack-hot{stroke:#e49b79}.attack-path{fill:none;stroke:#e49b79;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.attack-muted{stroke:#999}.attack-accent{fill:#e49b79}.icon-secondary{opacity:.22}svg{color:#eeeeee}rect{stroke-width:1}</style><rect width="320" height="196" fill="#111"/>');
    const example = t(visual.example).replace(/\[\[([^]*?)\]\]/g, '$1');
    attack = `\n\n## ${t('Cómo funciona el ataque')}\n\n${markdown(t(visual.description))}\n\n![${markdown(t('Cómo funciona el ataque'))}](data:image/svg+xml;base64,${base64(diagram)})\n\n## ${t('Ejemplo')} · ${t('Vulnerable')} · ${t('Pseudocódigo')}\n\n${fence(example, visual.language || codeLanguage(example))}\n\n## ${t('Corrección:').replace(/:$/, '')}\n\n${fence(t(visual.fix), 'text')}${visual.advisory ? `\n\n[${t('Aviso de seguridad')}: CVE-2017-5638](${visual.advisory})` : ''}`;
  }
  const related = links.map(edge => {
    const target = edge.from === key ? edge.to : edge.from;
    const [targetYear, id] = target.split(':');
    const risk = family.editions.find(e => e.year === Number(targetYear))?.items.find(i => i.id === id);
    const label = risk ? `[${markdown(target)} · ${markdown(t(risk.name))}](${permalink(family, targetYear, risk, language, origin)})` : markdown(target);
    return `- ${markdown(edge.from)} → ${markdown(edge.to)} · ${label} (${markdown(t(relationshipLabel(edge.type)))}): ${markdown(t(edge.note))}`;
  }).join('\n');
  const cwes = item.cwes || item.cwe || [];
  const sources = (Array.isArray(cwes) ? cwes : [cwes]).map(cwe => String(cwe).replace(/^CWE-/, '')).filter(n => /^\d+$/.test(n)).map(n => `- [CWE-${n}](https://cwe.mitre.org/data/definitions/${n}.html)`);
  return `# ${markdown(item.id)} · ${markdown(t(item.name))}\n\n${markdown(t(family.label))} · ${year} · ${markdown(t(edition?.status || ''))} · ${t('Puesto')} ${item.rank}\n\n## ${t('Resumen')}\n\n${markdown(t(item.summary))}${attack}\n\n## ${t('Cambio')}\n\n${markdown(t(item.change))}\n\n## ${t('Prevención prioritaria')}\n\n${item.prevention.map(text => `- ${markdown(t(text))}`).join('\n')}\n\n## ${t('Linaje')}\n\n${chronology}\n\n## ${t('Relaciones')}\n\n${related || t('No hay una relación directa documentada en las ediciones incluidas.')}\n\n## ${t('Fuentes')}\n\n- [${t('Fuente oficial')}](${item.source})\n${sources.join('\n')}\n\n${t('Enlace a este elemento')}: <${permalink(family, year, item, language, origin)}>\n`;
}
const xml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Serialize the measured matrix into native SVG primitives, with no external assets.
export function matrixSVG(stage, language) {
  const bounds = stage.getBoundingClientRect();
  const width = Math.ceil(bounds.width) + 32;
  const height = Math.ceil(bounds.height) + 60;
  const rootStyle = getComputedStyle(document.documentElement);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`, `<rect width="100%" height="100%" fill="${xml(rootStyle.getPropertyValue('--page').trim())}"/>`, '<g transform="translate(16 16)">'];
  const rect = (element, fill, radius = 0) => {
    const box = element.getBoundingClientRect();
    parts.push(`<rect x="${box.x - bounds.x}" y="${box.y - bounds.y}" width="${box.width}" height="${box.height}" rx="${radius}" fill="${xml(fill)}"/>`);
  };
  for (const path of stage.querySelectorAll('#connector-layer > path:not(.connector-hit)')) {
    const style = getComputedStyle(path);
    parts.push(`<path d="${xml(path.getAttribute('d'))}" fill="none" stroke="${xml(style.stroke)}" stroke-width="${style.strokeWidth}" stroke-dasharray="${style.strokeDasharray}" stroke-linecap="${style.strokeLinecap}" opacity="${style.opacity}"/>`);
  }
  for (const column of stage.querySelectorAll('#timeline-grid > .edition-column')) {
    rect(column, getComputedStyle(column).backgroundColor, 8);
    for (const card of column.querySelectorAll('.risk-card')) {
      const style = getComputedStyle(card);
      rect(card, style.backgroundColor);
      const box = card.getBoundingClientRect();
      if (card.classList.contains('is-selected')) parts.push(`<rect x="${box.x - bounds.x}" y="${box.y - bounds.y}" width="2" height="${box.height}" fill="${xml(style.color)}"/>`);
      if (parseFloat(style.borderBottomWidth)) parts.push(`<path d="M${box.x - bounds.x} ${box.bottom - bounds.y}h${box.width}" stroke="${xml(style.borderBottomColor)}"/>`);
    }
    for (const icon of column.querySelectorAll('.matrix-icon')) {
      const box = icon.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      // Resolve CSS fills so downloaded SVG/PNG retains the vendored 256-unit geometry
      // and both duotone layers without depending on the application's stylesheet.
      const copy = icon.cloneNode(true);
      const layers = icon.querySelectorAll('.icon-tile, .icon-secondary');
      copy.querySelectorAll('.icon-tile, .icon-secondary').forEach((layer, index) => {
        layer.setAttribute('fill', getComputedStyle(layers[index]).fill);
      });
      parts.push(`<svg x="${box.x - bounds.x}" y="${box.y - bounds.y}" width="${box.width}" height="${box.height}" viewBox="${xml(icon.getAttribute('viewBox'))}" fill="${xml(getComputedStyle(icon).color)}">${copy.innerHTML}</svg>`);
    }
    for (const element of column.querySelectorAll('.edition-year, .risk-rank, .risk-name')) {
      const style = getComputedStyle(element);
      const textNode = element.firstChild;
      if (!textNode) continue;
      // Range geometry preserves browser wrapping, including clipped two-line labels.
      const range = document.createRange();
      const lines = [];
      for (let i = 0; i < textNode.length; i++) {
        range.setStart(textNode, i); range.setEnd(textNode, i + 1);
        const box = range.getBoundingClientRect();
        let line = lines.at(-1);
        if (!line || Math.abs(line.y - box.y) > 1) { line = { x: box.x, y: box.y, height: box.height, text: '' }; lines.push(line); }
        line.text += textNode.textContent[i];
      }
      const clip = element.closest('.risk-copy')?.getBoundingClientRect();
      for (const line of lines) {
        if (clip && line.y + line.height > clip.bottom + 1) continue;
        parts.push(`<text x="${line.x - bounds.x}" y="${line.y - bounds.y + line.height * .8}" fill="${xml(style.color)}" font-family="${xml(style.fontFamily)}" font-size="${style.fontSize}" font-weight="${style.fontWeight}" letter-spacing="${style.letterSpacing}">${xml(line.text)}</text>`);
      }
    }
  }
  parts.push('</g>', `<text x="16" y="${height - 14}" fill="${xml(rootStyle.getPropertyValue('--muted').trim())}" font-family="Arial, Helvetica, sans-serif" font-size="11">${xml(translate('OWASP Evolution · OWASP Top 10', language))}</text>`, '</svg>');
  return { svg: parts.join(''), width, height };
}

let fonts;
async function embeddedFonts() {
  fonts ||= Promise.all([
    ['Geist', 'Regular', 400], ['Geist', 'Medium', 500], ['Geist', 'SemiBold', 600],
    ['GeistMono', 'Regular', 400], ['GeistMono', 'Medium', 500],
  ].map(async ([family, weight, number]) => {
    const response = await fetch(`/assets/fonts/${family}-${weight}.woff2`);
    if (!response.ok) throw new Error('Font export failed');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `@font-face{font-family:'${family === 'GeistMono' ? 'Geist Mono' : family}';font-weight:${number};src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2')}`;
  })).then(rules => `<style>${rules.join('')}</style>`);
  return fonts;
}
const captureChrome = '.detail-top, .detail-section-nav, .detail-support, .detail-feedback, .sr-only, [role="menu"], .detail-crossfade';
const svgStyleProperties = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'color', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor'];
function resolvedSVG(element) {
  const copy = element.cloneNode(true);
  const originals = [element, ...element.querySelectorAll('*')];
  [copy, ...copy.querySelectorAll('*')].forEach((target, index) => {
    const style = getComputedStyle(originals[index]);
    target.removeAttribute('style');
    target.removeAttribute('class');
    for (const property of svgStyleProperties) target.style.setProperty(property, style.getPropertyValue(property));
  });
  return copy;
}

// Native SVG text and shapes keep PNG rasterization free of foreignObject and external assets.
function detailDrawing(page, bounds) {
  const parts = [];
  let clip = 0;
  function visit(element) {
    if (element.matches(captureChrome)) return;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const x = box.x - bounds.x, y = box.y - bounds.y;
    if (element instanceof SVGElement) {
      const copy = resolvedSVG(element);
      copy.setAttribute('x', x); copy.setAttribute('y', y);
      copy.setAttribute('width', box.width); copy.setAttribute('height', box.height);
      parts.push(new XMLSerializer().serializeToString(copy));
      return;
    }
    if (style.backgroundColor !== 'rgba(0, 0, 0, 0)') parts.push(`<rect x="${x}" y="${y}" width="${box.width}" height="${box.height}" rx="${parseFloat(style.borderRadius) || 0}" fill="${xml(style.backgroundColor)}"/>`);
    for (const [side, coordinates] of [['Top', [x, y, x + box.width, y]], ['Bottom', [x, y + box.height, x + box.width, y + box.height]], ['Left', [x, y, x, y + box.height]], ['Right', [x + box.width, y, x + box.width, y + box.height]]]) {
      if (parseFloat(style[`border${side}Width`])) parts.push(`<path d="M${coordinates[0]} ${coordinates[1]}L${coordinates[2]} ${coordinates[3]}" stroke="${xml(style[`border${side}Color`])}" stroke-width="${style[`border${side}Width`]}"/>`);
    }
    if (element.tagName === 'LI' && style.listStyleType !== 'none') parts.push(`<circle cx="${x - 9}" cy="${y + parseFloat(style.fontSize) * .8}" r="1.5" fill="${xml(style.color)}"/>`);
    const clipped = /hidden|auto|scroll/.test(`${style.overflowX} ${style.overflowY}`);
    if (clipped) {
      const id = `detail-overflow-${clip++}`;
      parts.push(`<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${box.width}" height="${box.height}"/></clipPath></defs><g clip-path="url(#${id})">`);
    }
    for (const child of element.childNodes) {
      if (child.nodeType === 1) { visit(child); continue; }
      if (child.nodeType !== 3 || !child.textContent.trim()) continue;
      const range = document.createRange(), lines = [];
      for (let index = 0; index < child.length; index++) {
        range.setStart(child, index); range.setEnd(child, index + 1);
        const rect = range.getBoundingClientRect();
        if (!rect.height || !rect.width) continue;
        let line = lines.at(-1);
        if (!line || Math.abs(line.y - rect.y) > 1) { line = { x: rect.x, y: rect.y, height: rect.height, text: '' }; lines.push(line); }
        line.text += child.textContent[index];
      }
      for (const line of lines) {
        const text = style.textTransform === 'uppercase' ? line.text.toLocaleUpperCase(document.documentElement.lang) : line.text;
        parts.push(`<text xml:space="preserve" x="${line.x - bounds.x}" y="${line.y - bounds.y + line.height * .8}" fill="${xml(style.color)}" font-family="${xml(style.fontFamily)}" font-size="${style.fontSize}" font-weight="${style.fontWeight}" letter-spacing="${style.letterSpacing}">${xml(text)}</text>`);
      }
    }
    if (clipped) parts.push('</g>');
  }
  visit(page);
  return parts.join('');
}

export async function detailSVG(page, { full = true } = {}) {
  await document.fonts.ready;
  const fontStyle = await embeddedFonts();
  let clone;
  try {
    let source = page;
    if (full) {
      clone = page.cloneNode(true);
      const originals = [page, ...page.querySelectorAll('*')];
      [clone, ...clone.querySelectorAll('*')].forEach((target, index) => {
        const style = getComputedStyle(originals[index]);
        if (!(target instanceof SVGElement)) for (const property of style) target.style.setProperty(property, style.getPropertyValue(property));
        target.removeAttribute('id');
      });
      clone.querySelectorAll(captureChrome).forEach(element => element.remove());
      clone.style.cssText += `;position:fixed;left:-20000px;top:0;width:${page.getBoundingClientRect().width}px;height:auto;max-height:none;overflow:visible;transform:none;pointer-events:none;`;
      clone.setAttribute('aria-hidden', 'true');
      clone.inert = true;
      for (const element of clone.querySelectorAll('.detail-header, .detail-body, .detail-grid, .detail-primary, .detail-secondary, .attack-explainer, .lineage-title, pre')) {
        element.style.height = 'auto'; element.style.maxHeight = 'none';
        element.style.overflow = 'visible'; element.style.flex = 'none';
        element.style.setProperty('-webkit-line-clamp', 'unset');
      }
      document.body.append(clone);
      source = clone;
    }
    const bounds = source.getBoundingClientRect();
    const width = Math.ceil(bounds.width), height = Math.ceil(bounds.height);
    const background = getComputedStyle(page).backgroundColor;
    return { width, height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${fontStyle}<defs><clipPath id="detail-clip"><rect width="${width}" height="${height}"/></clipPath></defs><rect width="100%" height="100%" fill="${xml(background)}"/><g clip-path="url(#detail-clip)">${detailDrawing(source, bounds)}</g></svg>` };
  } finally { clone?.remove(); }
}

export async function canvasSVG(stage, page, language) {
  await document.fonts.ready;
  const matrix = matrixSVG(stage, language);
  const fontStyle = await embeddedFonts();
  const panel = page?.closest('dialog');
  const shell = stage.closest('.explorer-shell');
  if (!panel?.open || panel.matches(':modal') || !['left', 'right'].includes(shell.dataset.dock)) {
    return { ...matrix, svg: matrix.svg.replace(/(<svg[^>]*>)/, `$1${fontStyle}`) };
  }
  const detail = await detailSVG(page);
  const matrixBox = stage.getBoundingClientRect(), detailBox = page.getBoundingClientRect(), panelBox = panel.getBoundingClientRect();
  const viewport = stage.closest('.timeline-panel').getBoundingClientRect();
  const left = Math.min(viewport.left, panelBox.left), top = Math.min(matrixBox.top, panelBox.top);
  // Retain the docked width and offsets, but grow the panel around the full card.
  const panelHeight = detailBox.top - panelBox.top + detail.height + panelBox.bottom - detailBox.bottom;
  const right = Math.max(viewport.right, panelBox.right), bottom = Math.max(matrixBox.bottom, panelBox.top + panelHeight);
  const width = Math.ceil(right - left) + 32, height = Math.ceil(bottom - top) + 60;
  const matrixX = matrixBox.left - left, matrixY = matrixBox.top - top;
  // The timeline can scroll beyond its viewport; clip it before adding the docked panel.
  const matrixInner = matrix.svg.slice(matrix.svg.indexOf('<g transform='), matrix.svg.lastIndexOf('<text x="16"'));
  const rootStyle = getComputedStyle(document.documentElement), panelStyle = getComputedStyle(panel);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    fontStyle,
    `<rect width="100%" height="100%" fill="${xml(rootStyle.getPropertyValue('--page').trim())}"/>`,
    `<defs><clipPath id="matrix-clip"><rect x="${viewport.left - left + 16}" y="16" width="${viewport.width}" height="${height - 60}"/></clipPath></defs>`,
    `<g clip-path="url(#matrix-clip)"><g transform="translate(${matrixX} ${matrixY})">${matrixInner}</g></g>`,
    `<rect x="${panelBox.left - left + 16}" y="${panelBox.top - top + 16}" width="${panelBox.width}" height="${panelHeight}" rx="${parseFloat(panelStyle.borderRadius) || 0}" fill="${xml(panelStyle.backgroundColor)}" stroke="${xml(panelStyle.borderColor)}"/>`,
    `<svg x="${detailBox.left - left + 16}" y="${detailBox.top - top + 16}" width="${detail.width}" height="${detail.height}" viewBox="0 0 ${detail.width} ${detail.height}">${detail.svg.slice(detail.svg.indexOf('>') + 1, -6)}</svg>`,
    `<text x="16" y="${height - 14}" fill="${xml(rootStyle.getPropertyValue('--muted').trim())}" font-family="Arial, sans-serif" font-size="11">${xml(translate('OWASP Evolution · OWASP Top 10', language))}</text>`,
    '</svg>',
  ];
  return { width, height, svg: parts.join('') };
}
export async function pngBlob({ svg, width, height }) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
