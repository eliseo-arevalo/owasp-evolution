// This table is shared by the bilingual help dialog and its behavior tests.
export const shortcutRows = [
  ['↑ / ↓ · J / K', 'Anterior / siguiente en la columna', 'Previous / next in the column'],
  ['← / → · [ / ]', 'Linaje o rango más cercano en la edición adyacente visible', 'Lineage or nearest rank in the adjacent visible edition'],
  ['Home / End', 'Primer / último elemento de la columna', 'First / last item in the column'],
  ['Enter', 'Abrir detalle del elemento enfocado', 'Open the focused item’s detail'],
  ['Esc', 'Cerrar ayuda, volver de pantalla completa o cerrar panel', 'Close help, return from full screen or close panel'],
  ['/ · Ctrl / ⌘ + K', 'Enfocar búsqueda', 'Focus search'],
  ['F', 'Alternar pantalla completa del detalle', 'Toggle full screen detail'],
  ['1 / 2 / 3', 'Acoplar panel a izquierda / derecha / abajo', 'Dock panel left / right / bottom'],
  ['?', 'Mostrar esta ayuda', 'Show this help'],
];
export function shortcutCommand(event) {
  if (event.altKey) return null;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'k') return 'search';
  if (event.ctrlKey || event.metaKey) return null;
  if (event.shiftKey && !['?', '{', '}'].includes(key)) return null;
  return ({ '/': 'search', '?': 'help', escape: 'escape', enter: 'open', f: 'fullscreen',
    '1': 'dock:left', '2': 'dock:right', '3': 'dock:bottom',
    arrowup: 'move:ArrowUp', k: 'move:ArrowUp', arrowdown: 'move:ArrowDown', j: 'move:ArrowDown',
    arrowleft: 'move:ArrowLeft', '[': 'move:ArrowLeft', arrowright: 'move:ArrowRight', ']': 'move:ArrowRight',
    home: 'move:Home', end: 'move:End' })[key] || null;
}
