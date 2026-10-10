// One delayed tooltip for the whole UI, rendered above dialogs and clipping panels.
export function sharedTooltip(document, delay = 400) {
  const tip = document.createElement('div');
  tip.id = 'shared-tooltip';
  tip.className = 'detail-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('popover', 'manual');
  document.body.append(tip);
  let timer, target, keyboard = false;
  function hide() {
    clearTimeout(timer);
    target?.removeAttribute('aria-describedby');
    target = null;
    if (tip.matches(':popover-open')) tip.hidePopover();
  }
  function queue(element) {
    if (!element || element.disabled || target === element) return;
    hide();
    target = element;
    timer = setTimeout(() => {
      if (!element.isConnected) { hide(); return; }
      tip.replaceChildren();
      const label = document.createElement('span');
      label.textContent = element.dataset.tooltip;
      tip.append(label);
      if (element.dataset.hint) {
        const hint = document.createElement('kbd');
        hint.textContent = element.dataset.hint;
        tip.append(hint);
      }
      element.setAttribute('aria-describedby', tip.id);
      tip.showPopover();
      const rect = element.getBoundingClientRect(), box = tip.getBoundingClientRect();
      const view = document.defaultView;
      tip.style.left = `${Math.max(8, Math.min(rect.left, view.innerWidth - box.width - 8))}px`;
      tip.style.top = `${rect.bottom + box.height + 8 > view.innerHeight ? rect.top - box.height - 6 : rect.bottom + 6}px`;
    }, delay);
  }
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    queue(event.target.closest('[data-tooltip]'));
  });
  document.addEventListener('pointerout', event => {
    if (target && !target.contains(event.relatedTarget)) hide();
  });
  document.addEventListener('focusin', event => {
    if (keyboard && event.target.tabIndex !== -1 && event.target.matches(':focus-visible')) queue(event.target.closest('[data-tooltip]'));
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', event => {
    keyboard = true;
    if (event.key === 'Escape') hide();
  }, true);
  document.addEventListener('pointerdown', () => { keyboard = false; hide(); }, true);
  document.addEventListener('scroll', hide, true);
  document.defaultView.addEventListener('resize', hide);
  return { hide };
}
