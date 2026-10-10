// Pure data generators also work in Node, without browser APIs.
export function exportFilename(family, years, format) {
  return `owasp-evolution-${String(family).replace(/[^a-z0-9-]/gi, '-')}-${[...years].map(Number).sort((a, b) => a - b).join('-')}.${format}`;
}

export function exportRows(family, years) {
  const visible = new Set([...years].map(Number));
  return family.editions.filter((edition) => visible.has(edition.year)).flatMap((edition) => edition.items.map((item) => {
    const key = `${edition.year}:${item.id}`;
    const links = family.edges.filter((edge) => (edge.from === key || edge.to === key) && visible.has(Number(edge.from.split(':')[0])) && visible.has(Number(edge.to.split(':')[0])));
    return { family: family.id, year: edition.year, code: item.id, name: item.name, position: item.rank,
      lineage_type: [...new Set(links.map((edge) => edge.type))].join(';'),
      linked_to: [...new Set(links.map((edge) => edge.from === key ? edge.to : edge.from))].join(';') };
  }));
}
const columns = ['family', 'year', 'code', 'name', 'position', 'lineage_type', 'linked_to'];
export function exportCSV(family, years) {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  return [columns.join(','), ...exportRows(family, years).map((row) => columns.map((column) => quote(row[column])).join(','))].join('\r\n') + '\r\n';
}
export const exportJSON = (family, years) => JSON.stringify(exportRows(family, years), null, 2) + '\n';
const markdown = (value = '') => String(value).replace(/[\\`*_[\]<>#]/g, '\\$&');
export function exportMarkdown(family, year, item, language) {
  if (!item) throw new Error('Select a category first');
  const en = language === 'en';
  const key = `${year}:${item.id}`;
  const links = family.edges.filter((edge) => edge.from === key || edge.to === key);
  return `# ${markdown(item.id)} · ${markdown(item.name)}\n\n${markdown(family.label)} · ${year} · ${en ? 'Position' : 'Posición'} ${item.rank}\n\n${markdown(item.summary)}\n\n## ${en ? 'Change' : 'Cambio'}\n\n${markdown(item.change)}\n\n## ${en ? 'Priority prevention' : 'Prevención prioritaria'}\n\n${item.prevention.map((text) => `- ${markdown(text)}`).join('\n')}\n\n## ${en ? 'Relationships' : 'Relaciones'}\n\n${links.length ? links.map((edge) => `- ${markdown(edge.from)} → ${markdown(edge.to)} (${markdown(edge.type)}): ${markdown(edge.note)}`).join('\n') : (en ? 'No documented direct relationship.' : 'Sin relación directa documentada.')}\n\n${en ? 'Official source' : 'Fuente oficial'}: <${item.source}>\n`;
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
      parts.push(`<svg x="${box.x - bounds.x}" y="${box.y - bounds.y}" width="${box.width}" height="${box.height}" viewBox="0 0 24 24" fill="none" stroke="${xml(getComputedStyle(icon).color)}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon.innerHTML}</svg>`);
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
        parts.push(`<text x="${line.x - bounds.x}" y="${line.y - bounds.y + line.height * .8}" fill="${xml(style.color)}" font-family="${element.matches('.risk-rank') ? 'monospace' : 'Arial, Helvetica, sans-serif'}" font-size="${style.fontSize}" font-weight="${style.fontWeight}" letter-spacing="${style.letterSpacing}">${xml(line.text)}</text>`);
      }
    }
  }
  parts.push('</g>', `<text x="16" y="${height - 14}" fill="${xml(rootStyle.getPropertyValue('--muted').trim())}" font-family="Arial, Helvetica, sans-serif" font-size="11">OWASP Evolution · OWASP Top 10</text>`, '</svg>');
  return { svg: parts.join(''), width, height };
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
