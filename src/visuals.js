// Hand-authored 24px glyphs share a 1.5px stroke, round caps and 2px corners.
// Each schematic is one representative abuse case, rather than the full category.
export const visuals = {
  web: {
    2025: {
      A01: {
        glyph: '<path d="M13 21H4V3h11v5M8 12h.01"/><rect x="12" y="13" width="9" height="8" rx="2"/><path d="M14 13v-3a3 3 0 0 1 3-3m3 3v1m-3 6v1"/>',
        nodes: ['Usuario', 'API de objetos', 'Sin autorización', 'Datos ajenos'],
        description: 'Un usuario cambia el identificador de un objeto en la API; el servidor omite la autorización y devuelve datos de otra persona.',
      },
      A02: {
        glyph: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M6 8h12M6 16h12"/><rect x="8" y="6" width="3" height="4" rx="1"/><rect x="14" y="14" width="3" height="4" rx="1"/>',
        nodes: ['Atacante', 'Servicio expuesto', 'Acceso por defecto', 'Control del servicio'],
        description: 'Un atacante llega a un servicio innecesariamente expuesto que conserva acceso inseguro por defecto y obtiene control del servicio.',
      },
      A03: {
        glyph: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><path d="M7 3v3h4m6 7v3h4M11 7h4a2 2 0 0 1 2 2v4M13 17H9a2 2 0 0 1-2-2v-4"/>',
        nodes: ['Atacante', 'Dependencia', 'Build comprometido', 'Código malicioso'],
        description: 'Un atacante compromete una dependencia que el proceso de construcción incorpora y distribuye, introduciendo código malicioso en la aplicación.',
      },
      A04: {
        glyph: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3M12 14l-2 2 2 2-2 3m4-5h2"/>',
        nodes: ['Observador', 'Tráfico sensible', 'Sin cifrado', 'Datos expuestos'],
        description: 'Un observador intercepta tráfico que contiene datos sensibles; la falta de cifrado permite leerlos.',
      },
      A05: {
        glyph: '<path d="M8 4H4v16h4m8-16h4v16h-4M8 12h8m-3-3 3 3-3 3"/>',
        nodes: ['Atacante', 'Entrada de consulta', 'Datos como SQL', 'Consulta alterada'],
        description: 'Un atacante envía datos que la aplicación concatena en SQL; el intérprete los ejecuta como instrucciones y altera la consulta.',
      },
      A06: {
        glyph: '<rect x="3" y="3" width="7" height="6" rx="2"/><rect x="14" y="15" width="7" height="6" rx="2"/><path d="M6.5 9v9H14m-3-15h7a2 2 0 0 1 2 2v7M16 8l2-2 2 2"/>',
        nodes: ['Usuario abusivo', 'Flujo de compra', 'Sin límite de uso', 'Descuento repetido'],
        description: 'Un usuario repite un descuento en el flujo de compra porque el diseño no define ni exige un límite de uso, abusando de la lógica de negocio.',
      },
      A07: {
        glyph: '<circle cx="8" cy="7" r="4"/><path d="M2 21v-2a6 6 0 0 1 10-4"/><circle cx="17" cy="13" r="3"/><path d="M17 16v5m0-2h3m-3-2h2"/>',
        nodes: ['Atacante', 'Inicio de sesión', 'Sin límite ni MFA', 'Cuenta tomada'],
        description: 'Un atacante prueba credenciales robadas en un inicio de sesión sin límites de intentos ni segundo factor y toma una cuenta.',
      },
      A08: {
        glyph: '<path d="M13 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11M13 3v6h6M8 14l3 3 5-5M17 3l4 4m0-4-4 4"/>',
        nodes: ['Atacante', 'Datos serializados', 'Sin verificación', 'Estado manipulado'],
        description: 'Un atacante modifica datos serializados que la aplicación acepta sin verificar su integridad o procedencia y altera un estado de confianza.',
      },
      A09: {
        glyph: '<path d="M5 11a7 7 0 0 1 14 0v5l2 2H3l2-2v-2m5 7h4M3 3l18 18"/>',
        nodes: ['Atacante', 'Operación sensible', 'Sin logs ni alerta', 'Abuso persistente'],
        description: 'Un atacante abusa de una operación sensible; la falta de registros y alertas impide detectarlo y responder a tiempo, permitiendo que el abuso continúe.',
      },
      A10: {
        glyph: '<path d="m10.3 4-7.8 14a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 4a2 2 0 0 0-3.4 0M12 9v5m0 3h.01"/>',
        nodes: ['Atacante', 'Solicitud adversa', 'Fallo abierto', 'Acceso permitido'],
        description: 'Un atacante provoca un error durante una comprobación de seguridad; el manejo de excepciones falla abierto y permite el acceso.',
      },
    },
  },
};

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const getVisual = (family, year, id) => visuals[family]?.[year]?.[id];

// Shared markup keeps the interactive panel and no-JavaScript pages identical.
export function iconSVG(family, year, id, title = '', className = 'risk-icon') {
  const visual = getVisual(family, year, id);
  if (!visual) return '';
  const titleMarkup = title ? `<title>${escape(title)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${escape(className)}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${title ? 'role="img"' : 'aria-hidden="true"'} focusable="false">${titleMarkup}${visual.glyph}</svg>`;
}

export function diagramSVG(family, year, id, t = text => text) {
  const visual = getVisual(family, year, id);
  if (!visual) return '';
  const roles = ['Actor', 'Entrada', 'Fallo', 'Impacto'];
  const positions = [[10, 22], [180, 22], [180, 98], [10, 98]];
  // A clockwise path keeps labels readable at the narrowest dock width.
  const arrows = ['M140 45h34m-4-4 4 4-4 4', 'M265 68v24m-4-4 4 4 4-4', 'M180 121h-34m4-4-4 4 4 4'];
  const paths = arrows.map((d, i) => `<path class="attack-path" style="--step:${i}" d="${d}" pathLength="1"/>`).join('');
  const nodes = positions.map(([x, y], i) => `<g class="attack-node" style="--step:${i}" transform="translate(${x} ${y})"><text class="attack-role" x="0" y="-5">${i + 1} · ${escape(t(roles[i]))}</text><rect width="130" height="46" rx="4"/><text class="attack-label" x="65" y="27" text-anchor="middle">${escape(t(visual.nodes[i]))}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="attack-diagram" viewBox="0 0 320 160" width="320" height="160" role="img" focusable="false"><title>${escape(id)} · ${escape(t('Cómo funciona el ataque'))}</title><desc>${escape(t(visual.description))}</desc>${paths}${nodes}</svg>`;
}

export function attackSectionHTML(family, year, id, t = text => text) {
  const visual = getVisual(family, year, id);
  if (!visual) return '';
  return `<section class="detail-section attack-section"><h2>${escape(t('Cómo funciona el ataque'))}</h2>${diagramSVG(family, year, id, t)}<p class="attack-description">${escape(t(visual.description))}</p></section>`;
}
