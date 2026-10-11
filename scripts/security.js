import { createHash } from 'node:crypto';

export const immutable = 'public, max-age=31536000, immutable';
export const revalidate = 'public, max-age=0, must-revalidate';
export const fingerprinted = '^/(?:assets/app-[a-f0-9]{12}/.*|styles-[a-f0-9]{12}\\.css)$';

// Hash exactly the executable inline bytes in the built document, not the template.
export function securityHeaders(html, env = process.env) {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => !/\bsrc\s*=|\btype=["']application\/ld\+json["']/i.test(attrs))
    .map(([, , body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  const analyticsOrigin = env.UMAMI_SCRIPT_URL?.trim() && env.UMAMI_WEBSITE_ID?.trim()
    ? new URL(env.UMAMI_SCRIPT_URL.trim()).origin : 'https://unami-oclazi.vercel.app';
  return {
    'Content-Security-Policy': [
      "default-src 'self'", `script-src 'self' ${analyticsOrigin} ${[...new Set(hashes)].join(' ')}`.trim(),
      // CSS custom properties position docks, popovers and SVG animation steps.
      "style-src 'self' 'unsafe-inline'", "font-src 'self'", "img-src 'self' data: blob:",
      `connect-src 'self' ${analyticsOrigin}`, "object-src 'none'", "base-uri 'self'",
      "frame-src 'none'", "frame-ancestors 'none'", "form-action 'none'",
    ].join('; '),
    'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), clipboard-write=(self)',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Cache-Control': revalidate,
  };
}
