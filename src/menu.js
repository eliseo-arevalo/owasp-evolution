// Shared APG menu button behavior for commands and radio choices.
export function menuButton(button, menu) {
  let query = '', typedAt = 0;
  const items = () => [...menu.querySelectorAll('[role^="menuitem"]:not(:disabled)')];
  function close(restore = false) {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    query = '';
    if (restore) button.focus();
  }
  function open(last = false) {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    (last ? items().at(-1) : items()[0])?.focus();
  }
  button.addEventListener('click', () => menu.hidden ? open() : close(true));
  button.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); open(event.key === 'ArrowUp');
    }
  });
  menu.addEventListener('keydown', event => {
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
  document.addEventListener('click', event => {
    if (!button.parentElement.contains(event.target)) close();
  });
  button.parentElement.addEventListener('focusout', event => {
    if (!button.parentElement.contains(event.relatedTarget)) close();
  });
  return { close, open };
}
