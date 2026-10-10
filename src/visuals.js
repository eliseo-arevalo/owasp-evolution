import { iconPaths } from './icons.js';
// Vendored Phosphor Icons duotone paths, MIT © 2023 Phosphor Icons.
// Upstream core commit 2b75f3ad12b420c9504ef05df8d2564a28f8500e; see LICENSES/third-party.md.
// Only secondary fill styling is adapted; outline geometry remains upstream.
// Each diagram illustrates one representative scenario, not the entire OWASP category.
export const visuals = { web: { 2025: {
  A01: {
    icon: "lock-key-open",
    glyph: "<path class=\"icon-secondary\" d=\"M208,88H48a8,8,0,0,0-8,8V208a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V96A8,8,0,0,0,208,88Zm-80,72a20,20,0,1,1,20-20A20,20,0,0,1,128,160Z\"/><path d=\"M208,80H96V56a32,32,0,0,1,32-32c15.37,0,29.2,11,32.16,25.59a8,8,0,0,0,15.68-3.18C171.32,24.15,151.2,8,128,8A48.05,48.05,0,0,0,80,56V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm0,128H48V96H208V208Zm-80-96a28,28,0,0,0-8,54.83V184a8,8,0,0,0,16,0V166.83A28,28,0,0,0,128,112Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,128,152Z\"/>",
    accent: "mint",
    layout: "idor-cross-user",
    description: "Un usuario cambia el identificador de un objeto en la API; el servidor omite la autorización y devuelve datos de otra persona.",
    example: "GET /api/invoices/[[1043]]\nCookie: session=alice\nreturn invoices.find(id)",
    fix: "Comprobar en el servidor que la factura pertenece al usuario de la sesión.",
  },
  A02: {
    icon: "sliders",
    glyph: "<path class=\"icon-secondary\" d=\"M80,136a24,24,0,1,1-24-24A24,24,0,0,1,80,136Zm48-72a24,24,0,1,0,24,24A24,24,0,0,0,128,64Zm72,80a24,24,0,1,0,24,24A24,24,0,0,0,200,144Z\"/><path d=\"M64,105V40a8,8,0,0,0-16,0v65a32,32,0,0,0,0,62v49a8,8,0,0,0,16,0V167a32,32,0,0,0,0-62Zm-8,47a16,16,0,1,1,16-16A16,16,0,0,1,56,152Zm80-95V40a8,8,0,0,0-16,0V57a32,32,0,0,0,0,62v97a8,8,0,0,0,16,0V119a32,32,0,0,0,0-62Zm-8,47a16,16,0,1,1,16-16A16,16,0,0,1,128,104Zm104,64a32.06,32.06,0,0,0-24-31V40a8,8,0,0,0-16,0v97a32,32,0,0,0,0,62v17a8,8,0,0,0,16,0V199A32.06,32.06,0,0,0,232,168Zm-32,16a16,16,0,1,1,16-16A16,16,0,0,1,200,184Z\"/>",
    accent: "blue",
    layout: "exposed-admin",
    description: "Un atacante llega a un servicio innecesariamente expuesto que conserva acceso inseguro por defecto y obtiene control del servicio.",
    example: "admin:\n  public: [[true]]\n  password: [[admin]]",
    fix: "Desactivar el panel público y eliminar las credenciales predeterminadas.",
  },
  A03: {
    icon: "package",
    glyph: "<path class=\"icon-secondary\" d=\"M128,129.09V232a8,8,0,0,1-3.84-1l-88-48.18a8,8,0,0,1-4.16-7V80.18a8,8,0,0,1,.7-3.25Z\"/><path d=\"M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44ZM128,120,47.66,76l33.9-18.56,80.34,44ZM40,90l80,43.78v85.79L40,175.82Zm176,85.78h0l-80,43.79V133.82l32-17.51V152a8,8,0,0,0,16,0V107.55L216,90v85.77Z\"/>",
    accent: "amber",
    layout: "poisoned-dependency",
    description: "Un atacante compromete una dependencia que el proceso de construcción incorpora y distribuye, introduciendo código malicioso en la aplicación.",
    example: "# Unreviewed dependency update\nnpm install sample-tools@[[latest]]\nnpm run build",
    fix: "Bloquear y revisar dependencias transitivas; verificar procedencia antes del build.",
  },
  A04: {
    icon: "lock",
    glyph: "<path class=\"icon-secondary\" d=\"M216,96V208a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V96a8,8,0,0,1,8-8H208A8,8,0,0,1,216,96Z\"/><path d=\"M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z\"/>",
    accent: "blue",
    layout: "password-comparison",
    description: "Un hash MD5 sin sal permite comprobar contraseñas rápidamente si se filtra la base de datos; un hash adaptativo con sal dificulta esa comprobación.",
    example: "password_hash = [[md5(password)]]",
    fix: "Usar Argon2id con sal única y parámetros de coste adecuados.",
  },
  A05: {
    icon: "code",
    glyph: "<path class=\"icon-secondary\" d=\"M240,128l-48,40H64L16,128,64,88H192Z\"/><path d=\"M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.3Zm176,27.7-48-40a8,8,0,1,0-10.24,12.3L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z\"/>",
    accent: "mint",
    layout: "input-to-query",
    description: "Un atacante envía datos que la aplicación concatena en SQL; el intérprete los ejecuta como instrucciones y altera la consulta.",
    example: "name = request.query[\"name\"]\nsql = \"SELECT id FROM users\\n\" +\n      \"WHERE name = '\" + [[name]] + \"'\"\ndb.query(sql)",
    fix: "Usar db.query(\"SELECT id FROM users WHERE name = ?\", [name]).",
  },
  A06: {
    icon: "arrows-clockwise",
    glyph: "<path class=\"icon-secondary\" d=\"M216,128a88,88,0,1,1-88-88A88,88,0,0,1,216,128Z\"/><path d=\"M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z\"/>",
    accent: "amber",
    layout: "coupon-reuse-loop",
    description: "Un usuario repite un descuento en el flujo de compra porque el diseño no define ni exige un límite de uso, abusando de la lógica de negocio.",
    example: "POST /cart/apply-coupon\n{\"code\": \"WELCOME10\"}\ncart.discount += [[10]]",
    fix: "Definir un uso por cliente y aplicarlo de forma atómica en el servidor.",
  },
  A07: {
    icon: "fingerprint",
    glyph: "<path class=\"icon-secondary\" d=\"M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z\"/><path d=\"M72,128a134.63,134.63,0,0,1-14.16,60.47,8,8,0,1,1-14.32-7.12A118.8,118.8,0,0,0,56,128,71.73,71.73,0,0,1,83,71.8,8,8,0,1,1,93,84.29,55.76,55.76,0,0,0,72,128Zm56-8a8,8,0,0,0-8,8,184.12,184.12,0,0,1-23,89.1,8,8,0,0,0,14,7.76A200.19,200.19,0,0,0,136,128,8,8,0,0,0,128,120Zm0-32a40,40,0,0,0-40,40,8,8,0,0,0,16,0,24,24,0,0,1,48,0,214.09,214.09,0,0,1-20.51,92A8,8,0,1,0,146,226.83,230,230,0,0,0,168,128,40,40,0,0,0,128,88Zm0-64A104.11,104.11,0,0,0,24,128a87.76,87.76,0,0,1-5,29.33,8,8,0,0,0,15.09,5.33A103.9,103.9,0,0,0,40,128a88,88,0,0,1,176,0,282.24,282.24,0,0,1-5.29,54.45,8,8,0,0,0,6.3,9.4,8.22,8.22,0,0,0,1.55.15,8,8,0,0,0,7.84-6.45A298.37,298.37,0,0,0,232,128,104.12,104.12,0,0,0,128,24ZM94.4,152.17A8,8,0,0,0,85,158.42a151,151,0,0,1-17.21,45.44,8,8,0,0,0,13.86,8,166.67,166.67,0,0,0,19-50.25A8,8,0,0,0,94.4,152.17ZM128,56a72.85,72.85,0,0,0-9,.56,8,8,0,0,0,2,15.87A56.08,56.08,0,0,1,184,128a252.12,252.12,0,0,1-1.92,31A8,8,0,0,0,189,168a8.39,8.39,0,0,0,1,.06,8,8,0,0,0,7.92-7,266.48,266.48,0,0,0,2-33A72.08,72.08,0,0,0,128,56Zm57.93,128.25a8,8,0,0,0-9.75,5.75c-1.46,5.69-3.15,11.4-5,17a8,8,0,0,0,5,10.13,7.88,7.88,0,0,0,2.55.42,8,8,0,0,0,7.58-5.46c2-5.92,3.79-12,5.35-18.05A8,8,0,0,0,185.94,184.26Z\"/>",
    accent: "blue",
    layout: "credential-fan-in",
    description: "Un atacante prueba credenciales robadas en un inicio de sesión sin límites de intentos ni segundo factor y toma una cuenta.",
    example: "login:\n  rate_limit: [[off]]\n  mfa: [[disabled]]",
    fix: "Limitar intentos por cuenta y origen; exigir MFA.",
  },
  A08: {
    icon: "file-arrow-down",
    glyph: "<path class=\"icon-secondary\" d=\"M208,88H152V32Z\"/><path d=\"M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-42.34-61.66a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L120,164.69V120a8,8,0,0,1,16,0v44.69l10.34-10.35A8,8,0,0,1,157.66,154.34Z\"/>",
    accent: "amber",
    layout: "unsigned-update",
    description: "Una aplicación descarga e instala una actualización sin verificar su firma; un archivo sustituido se ejecuta como software de confianza.",
    example: "update = download(update_url)\n[[install(update)]]",
    fix: "Verificar la firma con una clave de confianza antes de instalar.",
  },
  A09: {
    icon: "bell-slash",
    glyph: "<path class=\"icon-secondary\" d=\"M208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192Z\"/><path d=\"M53.92,34.62A8,8,0,1,0,42.08,45.38L58.82,63.8A79.59,79.59,0,0,0,48,104c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.8a40,40,0,0,0,78.4,0h15.44l19.44,21.38a8,8,0,1,0,11.84-10.76ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a63.65,63.65,0,0,1,6.26-27.62L168.09,184Zm166-4.73a8.13,8.13,0,0,1-2.93.55,8,8,0,0,1-7.44-5.08C196.35,156.19,192,129.75,192,104A64,64,0,0,0,96.43,48.31a8,8,0,0,1-7.9-13.91A80,80,0,0,1,208,104c0,35.35,8.05,58.59,10.52,64.88A8,8,0,0,1,214,179.25Z\"/>",
    accent: "mint",
    layout: "silent-timeline",
    description: "Un atacante abusa de una operación sensible; la falta de registros y alertas impide detectarlo y responder a tiempo, permitiendo que el abuso continúe.",
    example: "if not valid_login(user):\n    [[return 401]]\n# No security event or alert",
    fix: "Registrar fallos sin secretos y alertar sobre patrones sospechosos.",
  },
  A10: {
    icon: "warning",
    glyph: "<path class=\"icon-secondary\" d=\"M215.46,216H40.54C27.92,216,20,202.79,26.13,192.09L113.59,40.22c6.3-11,22.52-11,28.82,0l87.46,151.87C236,202.79,228.08,216,215.46,216Z\"/><path d=\"M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z\"/>",
    accent: "red",
    layout: "fail-open-branch",
    description: "Un atacante provoca un error durante una comprobación de seguridad; el manejo de excepciones falla abierto y permite el acceso.",
    example: "try: return authorize(user)\nexcept TimeoutError:\n    [[return True]]",
    fix: "Ante un timeout, denegar el acceso y registrar el fallo de autorización.",
  },
} } };

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const getVisual = (family, year, id) => visuals[family]?.[year]?.[id];

// Tiles reserve geometry before paint; matrix icons use their own 16px column.
export function iconSVG(family, year, id, title = '', className = 'risk-icon') {
  const visual = getVisual(family, year, id);
  if (!visual) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${escape(className)} visual-${visual.accent}" data-icon="${visual.icon}" viewBox="0 0 256 256" width="40" height="40" fill="currentColor" ${title ? 'role="img"' : 'aria-hidden="true"'} focusable="false">${title ? `<title>${escape(title)}</title>` : ''}<rect class="icon-tile" width="256" height="256" rx="64"/><g transform="translate(28 28) scale(.78125)">${visual.glyph}</g></svg>`;
}

// All geometry uses an integer grid. Icon tiles and labels occupy separate lanes.
function drawing(t) {
  let step = 0;
  const text = (x, y, label, cls = 'attack-label', anchor = 'middle') => `<text class="attack-label ${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${escape(t(label))}</text>`;
  const group = content => `<g class="attack-node" style="--step:${step++ % 6}">${content}</g>`;
  const symbol = (name, x, y, size = 32) => `<svg data-actor="${name}" x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${iconPaths(name)}</svg>`;
  const actor = (x, y, name, label) => group(`<rect class="attack-box" x="${x}" y="${y}" width="48" height="48" rx="10"/>${symbol(name, x + 8, y + 8)}${text(x + 24, y + 64, label)}`);
  const card = (x, y, w, h, labels, hot = false, icon = '') => group(`<rect class="attack-box${hot ? ' attack-hot' : ''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>${icon ? symbol(icon, x + 8, y + (h - 24) / 2, 24) : ''}${labels.map((label, i) => text(x + w / 2 + (icon ? 16 : 0), y + h / 2 + 4 + (i - (labels.length - 1) / 2) * 16, label)).join('')}`);
  // Identical open arrowheads, explicitly oriented at each endpoint.
  const path = (d, muted = false) => `<path class="attack-path${muted ? ' attack-muted' : ''}" style="--step:${step++ % 6}" d="${d}" pathLength="1"/>`;
  return { text, group, card, path, actor, symbol };
}

export function diagramSVG(family, year, id, t = text => text) {
  const visual = getVisual(family, year, id);
  if (!visual) return '';
  const { text, group, card, path, actor } = drawing(t);
  let content = '';
  switch (visual.layout) {
    case 'idor-cross-user':
      content = actor(8, 8, 'user', 'Alice') + actor(264, 112, 'user-circle', 'Bob')
        + card(88, 8, 224, 40, ['GET /invoices/1042 → 1043'], true)
        + path('M56 28H80m-5-4 5 4-5 4')
        + card(88, 80, 160, 40, ['API sin autorización'], false, 'globe')
        + path('M168 48v24m-4-5 4 5 4-5')
        + card(88, 152, 160, 32, ['Factura de Bob'], true, 'database')
        + path('M168 120v24m-4-5 4 5 4-5')
        + path('M88 168H32V80m-4 5 4-5 4 5');
      break;
    case 'exposed-admin':
      content = actor(8, 64, 'detective', 'Atacante')
        + card(88, 8, 224, 40, ['/admin público'], false, 'globe')
        + card(88, 80, 224, 40, ['admin / admin'], true, 'lock')
        + path('M56 88H80m-5-4 5 4-5 4') + path('M200 48v24m-4-5 4 5 4-5')
        + card(88, 152, 224, 32, ['Control del servicio'], true, 'browser')
        + path('M200 120v24m-4-5 4 5 4-5');
      break;
    case 'poisoned-dependency':
      content = card(8, 8, 128, 40, ['App'], false, 'browser')
        + card(8, 80, 128, 40, ['sample-tools'], false, 'package')
        + card(8, 152, 128, 32, ['tiny-parser'], true, 'package')
        + path('M72 48v24m-4-5 4 5 4-5', true) + path('M72 120v24m-4-5 4 5 4-5')
        + actor(216, 8, 'detective', 'Atacante')
        + path('M240 80v56H120v8m-4-5 4 5 4-5')
        + card(184, 152, 128, 32, ['Build + artefacto'], true)
        + path('M136 168h40m-5-4 5 4-5 4') + group(text(188, 104, 'Comprometido', 'attack-accent'));
      break;
    case 'password-comparison':
      content = card(8, 8, 304, 40, ['Base de contraseñas filtrada'], false, 'database')
        + path('M160 48v24H80v16m-4-5 4 5 4-5') + path('M160 72h80v16m-4-5 4 5 4-5', true)
        + card(8, 96, 144, 40, ['MD5 sin sal'], true, 'lock')
        + card(168, 96, 144, 40, ['Argon2id + sal'], false, 'shield-check')
        + group(text(80, 160, 'Pruebas rápidas', 'attack-accent') + text(240, 160, 'Coste adaptativo') + text(160, 184, 'Misma contraseña · distinta protección', 'attack-role'));
      break;
    case 'input-to-query':
      content = actor(8, 8, 'detective', 'Atacante')
        + card(88, 8, 224, 40, ["name: O'Neil"], true, 'code') + path('M56 28H80m-5-4 5 4-5 4')
        + path('M200 48v32m-4-5 4 5 4-5')
        + group(`<rect class="attack-box" x="8" y="88" width="304" height="64" rx="8"/>${text(24, 112, 'SELECT id FROM users', 'attack-code', 'start')}<text class="attack-code" x="24" y="136">WHERE name = '<tspan class="attack-accent">O'Neil</tspan>'</text>`)
        + group(text(160, 184, 'La entrada cambia la sintaxis', 'attack-accent'));
      break;
    case 'coupon-reuse-loop':
      content = card(8, 16, 112, 48, ['Carrito'], false, 'shopping-cart')
        + card(200, 16, 112, 48, ['WELCOME10'], true)
        + path('M120 40h72m-5-4 5 4-5 4')
        + card(88, 128, 160, 40, ['Descuento +10'], true)
        + path('M256 64v84h-8m5-4-5 4 5 4') + path('M88 148H64V72m-4 5 4-5 4 5')
        + group(text(160, 96, 'Repetir sin límite', 'attack-accent') + text(160, 184, 'Falta la regla: un uso por cliente', 'attack-role'));
      break;
    case 'credential-fan-in':
      content = actor(8, 8, 'robot', 'Bot') + card(8, 96, 104, 56, ['alice : •••', 'bob : •••'], false)
        + path('M32 80v8m-4-5 4 5 4-5', true) + path('M112 124h32V40h24m-5-4 5 4-5 4')
        + card(176, 16, 136, 48, ['/login', 'Sin límite ni MFA'], true)
        + path('M244 64v48m-4-5 4 5 4-5')
        + actor(220, 120, 'user-circle', 'Cuenta tomada')
        + group(text(8, 184, 'Credenciales robadas', 'attack-role', 'start'));
      break;
    case 'unsigned-update':
      content = actor(8, 8, 'file-arrow-down', 'update.bin')
        + card(112, 8, 200, 48, ['Firma omitida'], true, 'lock')
        + path('M56 32h48m-5-4 5 4-5 4')
        + card(112, 88, 200, 40, ['Instalar'], true, 'package')
        + path('M212 56v24m-4-5 4 5 4-5')
        + card(112, 152, 200, 32, ['Código no verificado'], true, 'code')
        + path('M212 128v16m-4-5 4 5 4-5')
        + group(text(44, 96, 'Modificado', 'attack-role'));
      break;
    case 'silent-timeline':
      content = actor(16, 8, 'robot', '09:00') + actor(136, 8, 'user-circle', '09:05') + actor(256, 8, 'detective', '09:10')
        + path('M64 32h64m-5-4 5 4-5 4') + path('M184 32h64m-5-4 5 4-5 4')
        + group(text(40, 96, 'Intentos') + text(160, 96, 'Acceso') + text(280, 96, 'Abuso'))
        + card(8, 128, 304, 56, ['Sin eventos → sin alertas', 'La respuesta nunca comienza'], true, 'bell-slash');
      break;
    case 'fail-open-branch':
      content = card(64, 8, 192, 40, ['Comprobar permiso'], false, 'shield-check')
        + path('M160 48v24m-4-5 4 5 4-5')
        + card(96, 80, 128, 40, ['¿Respuesta?'], false, 'warning')
        + path('M96 100H64v44m-4-5 4 5 4-5', true) + path('M224 100h40v44m-4-5 4 5 4-5')
        + group(text(48, 80, 'No autorizado', 'attack-role') + text(272, 80, 'Timeout', 'attack-accent'))
        + card(8, 152, 112, 32, ['Denegar'], false, 'lock') + card(200, 152, 112, 32, ['Permitir'], true, 'user');
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="attack-diagram visual-${visual.accent}" data-layout="${visual.layout}" viewBox="0 0 320 196" width="320" height="196" role="img" focusable="false"><title>${escape(id)} · ${escape(t('Cómo funciona el ataque'))}</title><desc>${escape(t(visual.description))}</desc>${content}</svg>`;
}

// Mark only authored ranges; all code is escaped and remains selectable real text.
function exampleCode(code) {
  return code.split(/(\[\[[^]*?\]\])/g).map(part => part.startsWith('[[') ? `<mark>${escape(part.slice(2, -2))}</mark>` : escape(part)).join('');
}

// One renderer keeps live detail and no-JavaScript category pages identical.
export function attackSectionHTML(family, year, id, t = text => text) {
  const visual = getVisual(family, year, id);
  if (!visual) return '';
  return `<div class="attack-explainer"><section id="detail-attack" class="detail-section attack-section visual-${visual.accent}"><h2>${escape(t('Cómo funciona el ataque'))}</h2><div class="attack-flow">${diagramSVG(family, year, id, t)}<p class="attack-description">${escape(t(visual.description))}</p></div></section><section id="detail-example" class="detail-section example-section visual-${visual.accent}"><div class="section-heading"><h2>${escape(t('Ejemplo'))}</h2><span class="example-chip">${escape(t('Vulnerable'))}</span></div><div class="attack-example"><pre><code>${exampleCode(visual.example)}</code></pre><p class="attack-fix"><strong>${escape(t('Corrección:'))}</strong> ${escape(t(visual.fix))}</p></div></section></div>`;
}
