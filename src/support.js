import { translate } from './i18n.js';

export function supportLinkHTML(language) {
  const label = translate('Invítame un café', language);
  return `<a class="support-link" href="https://ko-fi.com/oclazi" target="_blank" rel="noopener" aria-label="${label}">${label}</a>`;
}
