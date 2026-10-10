// Shared APG menu button behavior for commands and radio choices.
export function menuButton(button, menu) {
  const listeners = new AbortController();
  const on = (element, type, handler, options = {}) => element.addEventListener(type, handler, { ...options, signal: listeners.signal });
  let query = '', typedAt = 0;
  const items = () => [...menu.querySelectorAll('[role^="menuitem"]:not(:disabled)')];
  function close(restore = false) {
    if (menu.matches(':popover-open')) menu.hidePopover();
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    query = '';
    if (restore) button.focus();
  }
  function open(last = false) {
    menu.hidden = false;
    if (menu.hasAttribute('popover')) {
      menu.showPopover();
      const rect = button.getBoundingClientRect(), box = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(rect.right - box.width, innerWidth - box.width - 8))}px`;
      menu.style.top = `${Math.max(8, rect.bottom + box.height + 8 > innerHeight ? rect.top - box.height - 5 : rect.bottom + 5)}px`;
    }
    button.setAttribute('aria-expanded', 'true');
    (last ? items().at(-1) : items()[0])?.focus();
  }
  on(button, 'click', () => menu.hidden ? open() : close(true));
  on(button, 'keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); open(event.key === 'ArrowUp');
    }
  });
  on(menu, 'keydown', event => {
    const choices = items(), index = choices.indexOf(document.activeElement);
    if (event.key === 'Tab') { close(); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Escape') { close(true); return; }
      choices[event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length]?.focus();
    } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      query = performance.now() - typedAt > 700 ? event.key : query + event.key;
      typedAt = performance.now();
      const prefix = [...query].every(char => char === query[0]) ? query[0] : query;
      const ordered = [...choices.slice(index + 1), ...choices.slice(0, index + 1)];
      ordered.find(item => item.textContent.trim().toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()))?.focus();
    }
  });
  on(document, 'click', event => {
    if (!button.parentElement.contains(event.target)) close();
  });
  on(button.parentElement, 'focusout', event => {
    if (!button.parentElement.contains(event.relatedTarget)) close();
  });
  if (menu.hasAttribute('popover')) {
    on(document, 'scroll', () => close(), { capture: true });
    on(window, 'resize', () => close());
  }
  return { close, open, destroy: () => listeners.abort() };
}
