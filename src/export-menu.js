import { menuButton } from './menu.js';
import { uiIcon } from './icons.js';
import { translate } from './i18n.js';

export async function copyText(text, parent = document.body) {
  try { await navigator.clipboard.writeText(text); return; } catch {}
  const active = document.activeElement;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('aria-label', translate('Markdown', document.documentElement.lang));
  field.style.cssText = 'position:fixed;left:-10000px;top:0';
  parent.append(field);
  try {
    field.select();
    if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
  } finally { active?.focus({ preventScroll: true }); field.remove(); }
}

// Both contexts share markup, feedback and the application's APG menu behavior.
export function exportControl({ id, t, data = false, run, compact = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'export-control';
  const button = document.createElement('button');
  button.id = `${id}-button`;
  button.type = 'button';
  button.className = `export-button${compact ? ' detail-action' : ''}`;
  button.dataset.action = 'export';
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `${id}-menu`);
  button.innerHTML = uiIcon('download-simple');
  button.append(document.createTextNode(t('Exportar')));
  const menu = document.createElement('div');
  menu.id = `${id}-menu`;
  menu.className = 'detail-menu export-menu';
  menu.setAttribute('popover', 'manual');
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-labelledby', button.id);
  menu.hidden = true;
  const status = document.createElement('span');
  status.className = 'sr-only export-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const groups = [
    ['Imagen', [['png', 'image', 'Descargar PNG (2×)'], ['svg', 'code', 'Descargar SVG']]],
    ['Markdown', [['copy', 'copy', 'Copiar'], ['md', 'file-arrow-down', 'Descargar (.md)']]],
    ...(data ? [['Datos', [['csv', 'table', 'CSV'], ['json', 'code', 'JSON']]]] : []),
  ];
  let timer;
  for (const [title, options] of groups) {
    const group = document.createElement('div');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', t(title));
    const label = document.createElement('div');
    label.className = 'export-section-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = t(title);
    group.append(label);
    for (const [format, icon, text] of options) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'detail-menu-item';
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
      item.dataset.export = format;
      const reset = () => { item.innerHTML = `${uiIcon(icon)}<span class="menu-label"></span>`; item.lastChild.textContent = t(text); };
      reset();
      item.addEventListener('click', async () => {
        status.textContent = '';
        if (format !== 'copy') behavior.close(true);
        try {
          await run(format, wrap);
          if (!wrap.isConnected) return;
          if (format === 'copy') {
            clearTimeout(timer);
            item.innerHTML = `${uiIcon('check')}<span class="menu-label"></span>`;
            item.lastChild.textContent = t('Copiado');
            status.textContent = t('Copiado');
            timer = setTimeout(reset, 1600);
          }
        } catch { status.textContent = t(format === 'copy' ? 'No se pudo copiar. Inténtalo de nuevo.' : 'No se pudo exportar. Inténtalo de nuevo.'); }
      });
      group.append(item);
    }
    menu.append(group);
  }
  wrap.append(button, menu, status);
  const behavior = menuButton(button, menu);
  return { element: wrap, close: behavior.close, destroy: () => { clearTimeout(timer); behavior.close(); behavior.destroy(); } };
}
