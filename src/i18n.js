import { english } from './translations-en.js';

const ui = {
  'Cómo funciona el ataque': 'How the attack works',
  'Actor': 'Actor',
  'Entrada': 'Entry point',
  'Fallo': 'Flaw',
  'Impacto': 'Impact',
  'Usuario': 'User',
  'API de objetos': 'Object API',
  'Sin autorización': 'No authorization',
  'Datos ajenos': 'Others’ data',
  'Atacante': 'Attacker',
  'Servicio expuesto': 'Exposed service',
  'Acceso por defecto': 'Default access',
  'Control del servicio': 'Service control',
  'Dependencia': 'Dependency',
  'Build comprometido': 'Compromised build',
  'Código malicioso': 'Malicious code',
  'Observador': 'Observer',
  'Tráfico sensible': 'Sensitive traffic',
  'Sin cifrado': 'No encryption',
  'Datos expuestos': 'Exposed data',
  'Entrada de consulta': 'Query input',
  'Datos como SQL': 'Data as SQL',
  'Consulta alterada': 'Altered query',
  'Usuario abusivo': 'Abusive user',
  'Flujo de compra': 'Purchase flow',
  'Sin límite de uso': 'No usage limit',
  'Descuento repetido': 'Repeated discount',
  'Inicio de sesión': 'Login',
  'Sin límite ni MFA': 'No limit or MFA',
  'Cuenta tomada': 'Account takeover',
  'Datos serializados': 'Serialized data',
  'Sin verificación': 'No verification',
  'Estado manipulado': 'Tampered state',
  'Operación sensible': 'Sensitive operation',
  'Sin logs ni alerta': 'No logs or alert',
  'Abuso persistente': 'Persistent abuse',
  'Solicitud adversa': 'Adversarial request',
  'Fallo abierto': 'Fails open',
  'Acceso permitido': 'Access allowed',
  'Un usuario cambia el identificador de un objeto en la API; el servidor omite la autorización y devuelve datos de otra persona.': 'A user changes an object identifier in the API; the server skips authorization and returns another person’s data.',
  'Un atacante llega a un servicio innecesariamente expuesto que conserva acceso inseguro por defecto y obtiene control del servicio.': 'An attacker reaches an unnecessarily exposed service with insecure default access and gains control of the service.',
  'Un atacante compromete una dependencia que el proceso de construcción incorpora y distribuye, introduciendo código malicioso en la aplicación.': 'An attacker compromises a dependency that the build process incorporates and distributes, introducing malicious code into the application.',
  'Un observador intercepta tráfico que contiene datos sensibles; la falta de cifrado permite leerlos.': 'An observer intercepts traffic containing sensitive data; missing encryption allows the data to be read.',
  'Un atacante envía datos que la aplicación concatena en SQL; el intérprete los ejecuta como instrucciones y altera la consulta.': 'An attacker sends data that the application concatenates into SQL; the interpreter executes it as instructions and alters the query.',
  'Un usuario repite un descuento en el flujo de compra porque el diseño no define ni exige un límite de uso, abusando de la lógica de negocio.': 'A user repeats a discount in the purchase flow because the design neither defines nor enforces a usage limit, abusing business logic.',
  'Un atacante prueba credenciales robadas en un inicio de sesión sin límites de intentos ni segundo factor y toma una cuenta.': 'An attacker tries stolen credentials at a login with no attempt limits or second factor and takes over an account.',
  'Un atacante modifica datos serializados que la aplicación acepta sin verificar su integridad o procedencia y altera un estado de confianza.': 'An attacker modifies serialized data that the application accepts without verifying integrity or provenance and alters trusted state.',
  'Un atacante abusa de una operación sensible; la falta de registros y alertas impide detectarlo y responder a tiempo, permitiendo que el abuso continúe.': 'An attacker abuses a sensitive operation; missing logs and alerts prevent timely detection and response, allowing the abuse to continue.',
  'Un atacante provoca un error durante una comprobación de seguridad; el manejo de excepciones falla abierto y permite el acceso.': 'An attacker triggers an error during a security check; exception handling fails open and allows access.',
  'Cambiar tamaño del panel': 'Resize panel',
  'Exportar': 'Export',
  'Markdown · detalle': 'Markdown · detail',
  'No se pudo exportar. Inténtalo de nuevo.': 'Export failed. Please try again.',
  'Explorador interactivo de la evolución del OWASP Top 10 para aplicaciones web y sistemas GenAI/LLM.': 'Interactive explorer of OWASP Top 10 evolution for web applications and GenAI/LLM systems.',
  'Saltar al explorador': 'Skip to explorer',
  'OWASP Evolution, inicio': 'OWASP Evolution, home',
  'Familia de riesgos': 'Risk family',
  'Herramientas del explorador': 'Explorer tools',
  'Buscar categoría, identificador o concepto': 'Search category, identifier or concept',
  'Buscar categorías': 'Search categories',
  'Leyenda de relaciones': 'Relationship legend',
  'Continúa / se mueve': 'Continues / moves',
  'Se renombra': 'Renamed',
  'Se fusiona / amplía': 'Merged / expanded',
  'Renombra': 'Renamed',
  'Fusiona': 'Merged',
  'Matriz de evolución de categorías': 'Category evolution matrix',
  'Detalle': 'Detail',
  'Idioma': 'Language',
  'Tema': 'Theme',
  'Sistema': 'System',
  'Oscuro': 'Dark',
  'Claro': 'Light',
  'Ediciones': 'Editions',
  'Mantén al menos una edición visible.': 'Keep at least one edition visible.',
  'Ediciones visibles': 'Visible editions',
  '← Volver': '← Back',
  'Volver a la matriz': 'Back to matrix',
  'Cerrar': 'Close',
  'Cerrar detalle': 'Close details',
  'Prevención prioritaria': 'Priority prevention',
  'Linaje en el tiempo': 'Lineage over time',
  'Sin cambio documentado': 'No documented change',
  'Categoría sin predecesor o sucesor directo en las ediciones incluidas.': 'Category with no direct predecessor or successor in the included editions.',
  'Relaciones': 'Relationships',
  'No hay una relación directa documentada en las ediciones incluidas.': 'No direct relationship is documented in the included editions.',
  'Nueva en': 'New in',
  'Sale en': 'Leaves in',
  'Abrir fuente oficial ↗': 'Open official source ↗',
  'No se encontraron categorías.': 'No categories found.',
  'Continúa': 'Continues',
  'Cambia de posición': 'Moves',
  'Renombrada': 'Renamed',
  'Fusionada': 'Merged',
  'Ampliada': 'Expanded',
  'Consolidada': 'Consolidated',
  'Nueva': 'New',
  'Sale del Top 10': 'Leaves the Top 10',
};

export function translate(text, language) {
  return language === 'en' ? ui[text] ?? english[text] ?? text : text;
}

export function localizeCatalog(catalog, language) {
  const t = (text) => translate(text, language);
  return {
    ...catalog,
    families: Object.fromEntries(Object.entries(catalog.families).map(([id, family]) => [id, {
      ...family, label: t(family.label), shortLabel: t(family.shortLabel), description: t(family.description),
      editions: family.editions.map((edition) => ({ ...edition, status: t(edition.status), items: edition.items.map((risk) => ({
        ...risk, summary: t(risk.summary), prevention: risk.prevention.map(t), change: t(risk.change),
      })) })),
      edges: family.edges.map((edge) => ({ ...edge, note: t(edge.note) })),
    }])),
  };
}

// Capture static copy once, before the application creates dynamic content.
export function staticTranslator(document) {
  const entries = [];
  const reverse = new Map(Object.entries({ ...english, ...ui }).map(([source, translated]) => [translated, source]));
  const walker = document.createTreeWalker(document.body, 4);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('script, #language-select, #prerender, noscript')) continue;
    const original = node.textContent.replace(node.textContent.trim(), reverse.get(node.textContent.trim()) ?? node.textContent.trim());
    if (original.trim()) entries.push((language) => { node.textContent = original.replace(original.trim(), translate(original.trim(), language)); });
  }
  for (const element of document.querySelectorAll('[aria-label], [placeholder], meta[name="description"]')) {
    for (const attribute of ['aria-label', 'placeholder', 'content']) {
      if (!element.hasAttribute(attribute)) continue;
      const value = element.getAttribute(attribute);
      const original = reverse.get(value) ?? value;
      entries.push((language) => element.setAttribute(attribute, translate(original, language)));
    }
  }
  return (language) => { document.documentElement.lang = language; entries.forEach((apply) => apply(language)); };
}
