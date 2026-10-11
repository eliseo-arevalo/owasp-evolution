export const normalizeDock = side => side === 'right' ? 'right' : 'left';
export function readDockPreferences(storage, search = '') {
  const desktop = { side: 'left', width: 380 };
  try {
    const saved = JSON.parse(storage.getItem('owasp-dock-layout') || '{}');
    desktop.side = normalizeDock(saved.desktop?.side ?? storage.getItem('owasp-dock'));
    if (Number.isFinite(saved.desktop?.width) && saved.desktop.width > 0) desktop.width = saved.desktop.width;
  } catch {}
  const param = new URLSearchParams(search).get('dock');
  if (param) desktop.side = normalizeDock(param);
  try {
    storage.setItem('owasp-dock-layout', JSON.stringify({ desktop }));
    storage.setItem('owasp-dock', desktop.side);
  } catch {}
  return { desktop };
}
