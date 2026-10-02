function connectedFocusable(candidate) {
  return candidate && candidate.isConnected !== false && typeof candidate.focus === 'function';
}

export function shouldRefocusWithin(container, activeElement, open) {
  return Boolean(open && container?.contains?.(activeElement));
}

export function resetScrollPosition(container) {
  if (container) container.scrollTop = 0;
}

export function focusResolved(resolveTarget, resolveFallback = () => null) {
  const preferred = resolveTarget?.();
  const target = connectedFocusable(preferred) ? preferred : resolveFallback?.();
  if (!connectedFocusable(target)) return null;
  target.focus({ preventScroll: true });
  return target;
}

export function scheduleFocus(
  resolveTarget,
  resolveFallback = () => null,
  schedule = (callback) => requestAnimationFrame(callback),
) {
  return schedule(() => focusResolved(resolveTarget, resolveFallback));
}
