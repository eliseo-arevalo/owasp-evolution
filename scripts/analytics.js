function escapeAttribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function umamiScript(env) {
  const url = env.UMAMI_SCRIPT_URL?.trim();
  const id = env.UMAMI_WEBSITE_ID?.trim();
  if (!url || !id) return '';

  let parsed;
  try { parsed = new URL(url); } catch { /* Report the configuration key, not its value. */ }
  if (parsed?.protocol !== 'https:') {
    throw new Error('UMAMI_SCRIPT_URL must be a valid HTTPS URL');
  }
  const domains = env.UMAMI_DOMAINS?.split(',').map(domain => domain.trim()).filter(Boolean).join(',');
  return `<script defer src="${escapeAttribute(url)}" data-website-id="${escapeAttribute(id)}"${domains ? ` data-domains="${escapeAttribute(domains)}"` : ''}></script>`;
}
