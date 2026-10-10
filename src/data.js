const WEB_2013_SOURCE = 'https://wiki.owasp.org/images/f/f8/OWASP_Top_10_-_2013.pdf';
const WEB_2017_SOURCE = 'https://github.com/OWASP/Top10/blob/master/2017/OWASP%20Top%2010-2017%20(en).pdf';

const web2021Source = (file) => `https://owasp.org/Top10/2021/${file}/`;
const web2025Source = (file) => `https://owasp.org/Top10/2025/${file}/`;
const llm2025Source = (file) => `https://github.com/GenAI-Security-Project/GenAI-LLM-Top10/blob/main/2025/${file}.md`;
const llm2026Source = (file) => `https://github.com/GenAI-Security-Project/GenAI-LLM-Top10/blob/main/2026/final/${file}.md`;

const webProfiles = {
  injection: {
    summary: 'Datos no confiables se interpretan como comandos o consultas. La inyección puede alterar consultas, ejecutar instrucciones o acceder a información fuera del flujo previsto.',
    prevention: ['Usar APIs parametrizadas y evitar concatenar entradas en comandos.', 'Validar con listas permitidas cuando la parametrización no sea posible.', 'Separar datos de instrucciones y probar los puntos de entrada con casos adversarios.'],
  },
  authentication: {
    summary: 'Controles débiles de identidad, credenciales o sesiones permiten suplantación y toma de cuentas. El riesgo incluye recuperación insegura, sesiones mal gestionadas y ausencia de defensas contra ataques automatizados.',
    prevention: ['Adoptar autenticación multifactor y políticas de credenciales seguras.', 'Proteger sesiones, rotar identificadores y cerrar sesiones de forma confiable.', 'Limitar intentos, detectar credenciales comprometidas y evitar cuentas predeterminadas.'],
  },
  crypto: {
    summary: 'Datos sensibles quedan expuestos cuando faltan controles criptográficos o se usan algoritmos, protocolos, claves o configuraciones inadecuadas.',
    prevention: ['Clasificar y minimizar los datos sensibles que se almacenan.', 'Usar cifrado moderno para datos en tránsito y en reposo.', 'Gestionar claves fuera del código y rotarlas mediante procesos controlados.'],
  },
  xxe: {
    summary: 'Procesadores XML inseguros pueden resolver entidades externas y permitir lectura de archivos, solicitudes internas o denegación de servicio.',
    prevention: ['Deshabilitar DTD y entidades externas en todos los analizadores XML.', 'Preferir formatos simples como JSON cuando XML no sea necesario.', 'Actualizar bibliotecas y validar el contenido XML recibido.'],
  },
  access: {
    summary: 'La aplicación no hace cumplir correctamente qué puede leer, modificar o ejecutar cada identidad. Incluye acceso a objetos ajenos, funciones administrativas y recursos internos.',
    prevention: ['Denegar por defecto y verificar autorización en el servidor para cada operación.', 'Centralizar reglas de acceso y comprobar propiedad o pertenencia del recurso.', 'Probar controles con usuarios, roles y tenants distintos.'],
  },
  misconfiguration: {
    summary: 'Valores predeterminados inseguros, servicios innecesarios, permisos excesivos, mensajes detallados o configuraciones inconsistentes crean superficies explotables.',
    prevention: ['Automatizar una configuración endurecida y repetible en todos los entornos.', 'Eliminar funciones, cuentas y servicios que no sean necesarios.', 'Aplicar parches, cabeceras de seguridad y revisiones continuas de configuración.'],
  },
  xss: {
    summary: 'Contenido controlado por un atacante se ejecuta como código en el navegador de otra persona, permitiendo robo de sesión, suplantación o modificación de la interfaz.',
    prevention: ['Codificar la salida según el contexto HTML, atributo, URL o JavaScript.', 'Usar plantillas con escape automático y sanear HTML cuando sea imprescindible.', 'Aplicar una Content Security Policy restrictiva como defensa adicional.'],
  },
  deserialization: {
    summary: 'Objetos serializados no confiables pueden alterar lógica, ejecutar código o abusar de tipos peligrosos durante la reconstrucción del objeto.',
    prevention: ['Evitar deserializar objetos nativos provenientes de fuentes no confiables.', 'Usar formatos simples con esquemas y listas permitidas de tipos.', 'Verificar integridad y aislar el procesamiento de datos serializados.'],
  },
  components: {
    summary: 'Dependencias, frameworks o componentes vulnerables y obsoletos heredan fallos conocidos y amplían la superficie de ataque de la aplicación.',
    prevention: ['Mantener un inventario y SBOM de dependencias directas y transitivas.', 'Monitorizar avisos de seguridad y actualizar con rapidez.', 'Eliminar componentes sin mantenimiento o innecesarios.'],
  },
  logging: {
    summary: 'La falta de registros, monitorización y alertas impide detectar, investigar y responder a ataques a tiempo.',
    prevention: ['Registrar autenticación, autorización, validación y errores relevantes.', 'Centralizar y proteger logs contra alteración o acceso no autorizado.', 'Crear alertas accionables y probar periódicamente la respuesta a incidentes.'],
  },
  idor: {
    summary: 'Referencias directas a objetos permiten acceder a recursos ajenos cuando el servidor confía en un identificador sin verificar autorización.',
    prevention: ['Comprobar autorización sobre cada objeto solicitado.', 'Evitar depender de identificadores impredecibles como control de seguridad.', 'Aplicar consultas limitadas por usuario, organización o tenant.'],
  },
  functionAccess: {
    summary: 'Funciones o endpoints sensibles quedan disponibles para identidades sin el rol requerido porque el control existe solo en la interfaz o está incompleto.',
    prevention: ['Aplicar control de acceso en el servidor para cada función.', 'Denegar por defecto y reutilizar una política de autorización central.', 'Probar endpoints directamente, sin depender de la navegación visible.'],
  },
  csrf: {
    summary: 'El navegador de una persona autenticada puede ser inducido a enviar una acción no deseada a una aplicación que confía únicamente en sus cookies.',
    prevention: ['Usar tokens anti-CSRF vinculados a la sesión.', 'Configurar cookies SameSite y comprobar origen cuando corresponda.', 'Exigir reautenticación o confirmación para acciones sensibles.'],
  },
  redirect: {
    summary: 'Redirecciones controladas por parámetros no validados pueden enviar a la víctima a sitios maliciosos o encadenarse con otros ataques.',
    prevention: ['Aceptar solo destinos relativos o incluidos en una lista permitida.', 'No construir redirecciones directamente desde entradas del usuario.', 'Mostrar confirmación clara cuando sea necesario abandonar el dominio.'],
  },
  insecureDesign: {
    summary: 'El sistema carece de controles necesarios desde el diseño, incluso si la implementación no contiene un error puntual. El riesgo se origina en requisitos, límites de confianza y flujos inseguros.',
    prevention: ['Realizar modelado de amenazas y definir requisitos de seguridad verificables.', 'Usar patrones seguros, límites de negocio y separación de responsabilidades.', 'Probar escenarios de abuso durante diseño, desarrollo y revisión.'],
  },
  integrity: {
    summary: 'Software, datos, actualizaciones o pipelines se aceptan sin verificar su integridad o procedencia, permitiendo cambios no autorizados y ejecución de artefactos manipulados.',
    prevention: ['Firmar y verificar artefactos, actualizaciones y datos críticos.', 'Proteger CI/CD y separar funciones de construcción, aprobación y despliegue.', 'Evitar fuentes no confiables y mantener trazabilidad de los cambios.'],
  },
  ssrf: {
    summary: 'El servidor realiza solicitudes a una ubicación controlada por un atacante, que puede alcanzar servicios internos, metadatos cloud o destinos bloqueados para el usuario.',
    prevention: ['Permitir solo destinos y protocolos necesarios mediante una lista explícita.', 'Aplicar segmentación y controles de salida en la red.', 'Normalizar y validar URLs y bloquear rangos internos y servicios de metadatos.'],
  },
  supplyChain: {
    summary: 'Fallos en dependencias, repositorios, herramientas, procesos de construcción y distribución permiten introducir componentes o artefactos comprometidos.',
    prevention: ['Mantener SBOM, procedencia y versiones bloqueadas de los componentes.', 'Verificar firmas y hashes y proteger repositorios y pipelines.', 'Evaluar proveedores, actualizar dependencias y reducir la superficie de la cadena.'],
  },
  exceptional: {
    summary: 'Errores, estados inesperados o agotamiento de recursos se gestionan de forma insegura y provocan fallos abiertos, información expuesta o comportamiento inconsistente.',
    prevention: ['Definir manejo explícito de errores y fallar de forma segura.', 'Probar rutas excepcionales, límites y fallos de dependencias.', 'Aplicar timeouts, cuotas, circuit breakers y mensajes de error mínimos.'],
  },
};

function webItem(id, rank, name, profile, source, change = '') {
  return { id, rank, name, ...webProfiles[profile], source, change };
}

const web2013 = [
  webItem('A1', 1, 'Injection', 'injection', WEB_2013_SOURCE, 'Continúa en 2017'),
  webItem('A2', 2, 'Broken Authentication and Session Management', 'authentication', WEB_2013_SOURCE, 'Renombrada en 2017'),
  webItem('A3', 3, 'Cross-Site Scripting (XSS)', 'xss', WEB_2013_SOURCE, 'Baja al puesto 7 en 2017'),
  webItem('A4', 4, 'Insecure Direct Object References', 'idor', WEB_2013_SOURCE, 'Se fusiona en Broken Access Control'),
  webItem('A5', 5, 'Security Misconfiguration', 'misconfiguration', WEB_2013_SOURCE, 'Baja al puesto 6 en 2017'),
  webItem('A6', 6, 'Sensitive Data Exposure', 'crypto', WEB_2013_SOURCE, 'Sube al puesto 3 en 2017'),
  webItem('A7', 7, 'Missing Function Level Access Control', 'functionAccess', WEB_2013_SOURCE, 'Se fusiona en Broken Access Control'),
  webItem('A8', 8, 'Cross-Site Request Forgery (CSRF)', 'csrf', WEB_2013_SOURCE, 'Sale del Top 10 en 2017'),
  webItem('A9', 9, 'Using Components with Known Vulnerabilities', 'components', WEB_2013_SOURCE, 'Continúa en 2017'),
  webItem('A10', 10, 'Unvalidated Redirects and Forwards', 'redirect', WEB_2013_SOURCE, 'Sale del Top 10 en 2017'),
];

const web2017 = [
  webItem('A1', 1, 'Injection', 'injection', WEB_2017_SOURCE, 'Continúa'),
  webItem('A2', 2, 'Broken Authentication', 'authentication', WEB_2017_SOURCE, 'Renombrada y baja en 2021'),
  webItem('A3', 3, 'Sensitive Data Exposure', 'crypto', WEB_2017_SOURCE, 'Renombrada en 2021'),
  webItem('A4', 4, 'XML External Entities (XXE)', 'xxe', WEB_2017_SOURCE, 'Se integra en Security Misconfiguration'),
  webItem('A5', 5, 'Broken Access Control', 'access', WEB_2017_SOURCE, 'Sube al puesto 1 en 2021'),
  webItem('A6', 6, 'Security Misconfiguration', 'misconfiguration', WEB_2017_SOURCE, 'Se amplía con XXE en 2021'),
  webItem('A7', 7, 'Cross-Site Scripting (XSS)', 'xss', WEB_2017_SOURCE, 'Se integra en Injection'),
  webItem('A8', 8, 'Insecure Deserialization', 'deserialization', WEB_2017_SOURCE, 'Se amplía en una categoría nueva'),
  webItem('A9', 9, 'Using Components with Known Vulnerabilities', 'components', WEB_2017_SOURCE, 'Renombrada y sube en 2021'),
  webItem('A10', 10, 'Insufficient Logging & Monitoring', 'logging', WEB_2017_SOURCE, 'Renombrada y sube en 2021'),
];

const web2021 = [
  webItem('A01', 1, 'Broken Access Control', 'access', web2021Source('A01_2021-Broken_Access_Control'), 'Sube desde A5:2017'),
  webItem('A02', 2, 'Cryptographic Failures', 'crypto', web2021Source('A02_2021-Cryptographic_Failures'), 'Renombrada desde Sensitive Data Exposure'),
  webItem('A03', 3, 'Injection', 'injection', web2021Source('A03_2021-Injection'), 'Absorbe XSS'),
  webItem('A04', 4, 'Insecure Design', 'insecureDesign', web2021Source('A04_2021-Insecure_Design'), 'Nueva en 2021'),
  webItem('A05', 5, 'Security Misconfiguration', 'misconfiguration', web2021Source('A05_2021-Security_Misconfiguration'), 'Absorbe XXE'),
  webItem('A06', 6, 'Vulnerable and Outdated Components', 'components', web2021Source('A06_2021-Vulnerable_and_Outdated_Components'), 'Renombrada y sube desde A9:2017'),
  webItem('A07', 7, 'Identification and Authentication Failures', 'authentication', web2021Source('A07_2021-Identification_and_Authentication_Failures'), 'Renombrada desde A2:2017'),
  webItem('A08', 8, 'Software and Data Integrity Failures', 'integrity', web2021Source('A08_2021-Software_and_Data_Integrity_Failures'), 'Nueva y ampliada desde Insecure Deserialization'),
  webItem('A09', 9, 'Security Logging and Monitoring Failures', 'logging', web2021Source('A09_2021-Security_Logging_and_Monitoring_Failures'), 'Renombrada desde A10:2017'),
  webItem('A10', 10, 'Server-Side Request Forgery (SSRF)', 'ssrf', web2021Source('A10_2021-Server-Side_Request_Forgery_(SSRF)'), 'Nueva en 2021'),
];

const web2025 = [
  webItem('A01', 1, 'Broken Access Control', 'access', web2025Source('A01_2025-Broken_Access_Control'), 'Consolida SSRF y permanece en el puesto 1'),
  webItem('A02', 2, 'Security Misconfiguration', 'misconfiguration', web2025Source('A02_2025-Security_Misconfiguration'), 'Sube desde el puesto 5'),
  webItem('A03', 3, 'Software Supply Chain Failures', 'supplyChain', web2025Source('A03_2025-Software_Supply_Chain_Failures'), 'Nueva y ampliada desde componentes vulnerables'),
  webItem('A04', 4, 'Cryptographic Failures', 'crypto', web2025Source('A04_2025-Cryptographic_Failures'), 'Baja desde el puesto 2'),
  webItem('A05', 5, 'Injection', 'injection', web2025Source('A05_2025-Injection'), 'Baja desde el puesto 3'),
  webItem('A06', 6, 'Insecure Design', 'insecureDesign', web2025Source('A06_2025-Insecure_Design'), 'Baja desde el puesto 4'),
  webItem('A07', 7, 'Authentication Failures', 'authentication', web2025Source('A07_2025-Authentication_Failures'), 'Nombre simplificado'),
  webItem('A08', 8, 'Software or Data Integrity Failures', 'integrity', web2025Source('A08_2025-Software_or_Data_Integrity_Failures'), 'Continúa en el puesto 8'),
  webItem('A09', 9, 'Security Logging & Alerting Failures', 'logging', web2025Source('A09_2025-Security_Logging_and_Alerting_Failures'), 'Monitoring cambia a Alerting'),
  webItem('A10', 10, 'Mishandling of Exceptional Conditions', 'exceptional', web2025Source('A10_2025-Mishandling_of_Exceptional_Conditions'), 'Nueva en 2025'),
];

function llmItem(id, rank, name, summary, prevention, source, change = '') {
  return { id, rank, name, summary, prevention, source, change };
}

const llm2025 = [
  llmItem('LLM01', 1, 'Prompt Injection', 'Entradas directas, indirectas o multimodales alteran el comportamiento previsto del modelo y pueden provocar divulgación de datos o acciones no autorizadas.', ['Separar y marcar contenido externo no confiable.', 'Aplicar mínimo privilegio y aprobación humana para acciones sensibles.', 'Validar formatos de salida y realizar pruebas adversarias periódicas.'], llm2025Source('LLM01_PromptInjection'), 'Permanece en el puesto 1'),
  llmItem('LLM02', 2, 'Sensitive Information Disclosure', 'El modelo o la aplicación revelan PII, credenciales, propiedad intelectual u otra información confidencial en respuestas, trazas o datos usados por el sistema.', ['Minimizar, redactar o tokenizar datos sensibles.', 'Aplicar controles de acceso sobre fuentes y contexto.', 'Definir retención y educar a los usuarios para no introducir secretos.'], llm2025Source('LLM02_SensitiveInformationDisclosure'), 'Permanece en el puesto 2'),
  llmItem('LLM03', 3, 'Supply Chain', 'Modelos, datos, adaptadores, dependencias y plataformas de terceros pueden estar manipulados, comprometidos o sin mantenimiento.', ['Evaluar proveedores, fuentes y licencias.', 'Mantener SBOM o AIBOM y verificar firmas y hashes.', 'Parchear y someter artefactos de terceros a evaluación y red teaming.'], llm2025Source('LLM03_SupplyChain'), 'Baja al puesto 4 en 2026'),
  llmItem('LLM04', 4, 'Data and Model Poisoning', 'La manipulación de datos, embeddings o artefactos del modelo introduce sesgos, degradación o puertas traseras activadas por condiciones específicas.', ['Registrar procedencia y versiones de datos y modelos.', 'Aislar fuentes no verificadas y detectar anomalías.', 'Monitorizar comportamiento y ejecutar pruebas de robustez.'], llm2025Source('LLM04_DataModelPoisoning'), 'Baja al puesto 5 en 2026'),
  llmItem('LLM05', 5, 'Improper Output Handling', 'Salidas del LLM pasan a navegadores, bases de datos, shells u otros sistemas sin validación, provocando inyección, SSRF o ejecución de código.', ['Tratar toda salida como entrada no confiable.', 'Aplicar codificación contextual y consultas parametrizadas.', 'Registrar y monitorizar patrones anómalos.'], llm2025Source('LLM05_ImproperOutputHandling'), 'Baja al puesto 10 en 2026'),
  llmItem('LLM06', 6, 'Excessive Agency', 'Herramientas, permisos o autonomía excesivos convierten una alucinación o inyección en acciones dañinas sobre sistemas conectados.', ['Reducir herramientas y permisos al mínimo.', 'Autorizar cada acción de forma determinista.', 'Exigir aprobación humana y usar límites o circuit breakers.'], llm2025Source('LLM06_ExcessiveAgency'), 'Sube al puesto 3 en 2026'),
  llmItem('LLM07', 7, 'System Prompt Leakage', 'El prompt de sistema es descubrible; su exposición resulta peligrosa cuando contiene secretos, permisos o lógica interna usada como control de seguridad.', ['No colocar secretos ni credenciales en el prompt.', 'Mantener autorización y validación fuera del modelo.', 'Aplicar separación de privilegios independientemente del LLM.'], llm2025Source('LLM07_SystemPromptLeakage'), 'Renombrada y ampliada en 2026'),
  llmItem('LLM08', 8, 'Vector and Embedding Weaknesses', 'Debilidades en vectores y recuperación pueden filtrar información, mezclar tenants, invertir embeddings o manipular un sistema RAG.', ['Particionar datos y aplicar controles de acceso granulares.', 'Autenticar fuentes y registrar la procedencia de la ingestión.', 'Detectar consultas y vectores anómalos.'], llm2025Source('LLM08_VectorAndEmbeddingWeaknesses'), 'Baja al puesto 9 en 2026'),
  llmItem('LLM09', 9, 'Misinformation', 'El modelo produce información falsa o engañosa con apariencia convincente; la sobreconfianza convierte esos errores en decisiones o acciones dañinas.', ['Fundamentar respuestas con fuentes confiables.', 'Exigir verificación cruzada y supervisión humana.', 'Validar automáticamente resultados críticos y código generado.'], llm2025Source('LLM09_Misinformation'), 'Sube al puesto 7 en 2026'),
  llmItem('LLM10', 10, 'Unbounded Consumption', 'Inferencias excesivas agotan recursos, provocan denegación de servicio o presupuesto y pueden facilitar extracción o réplica del modelo.', ['Aplicar cuotas y límites por identidad.', 'Usar timeouts, throttling y colas limitadas.', 'Monitorizar consumo, costes y patrones anómalos.'], llm2025Source('LLM10_UnboundedConsumption'), 'Sube al puesto 6 en 2026'),
];

const llm2026 = [
  llmItem('LLM01', 1, 'Prompt Injection', 'Cualquier contenido que llegue al contexto —usuario, RAG, herramientas, memoria o medios— puede alterar el comportamiento. La defensa debe asumir que la inyección ocurrirá y limitar su impacto.', ['Validar esquemas de salida en código confiable.', 'Mantener credenciales y cambios de estado fuera del modelo.', 'Exigir confirmación humana para acciones privilegiadas o irreversibles.'], llm2026Source('LLM01_PromptInjection'), 'Continúa en el puesto 1'),
  llmItem('LLM02', 2, 'Sensitive Information Disclosure', 'La divulgación puede aparecer en respuestas, argumentos de herramientas, logs, embeddings, cachés o canales laterales durante todo el ciclo del sistema.', ['Clasificar, minimizar y depurar datos antes de incorporarlos.', 'Autorizar documentos dentro de la consulta de recuperación.', 'Redactar respuestas y logs y proteger embeddings y cachés.'], llm2026Source('LLM02_SensitiveInformationDisclosure'), 'Continúa en el puesto 2'),
  llmItem('LLM03', 3, 'Excessive Agency', 'Una aplicación con demasiadas herramientas, permisos o autonomía convierte salidas erróneas o manipuladas en acciones reales perjudiciales.', ['Ofrecer solo funciones mínimas con esquemas estrictos.', 'Conservar el contexto de autorización del usuario.', 'Mediar acciones con políticas, aprobación humana y circuit breakers.'], llm2026Source('LLM03_ExcessiveAgency'), 'Sube desde el puesto 6'),
  llmItem('LLM04', 4, 'Supply Chain', 'La cadena incluye código, datos, modelos, adaptadores, formatos y plataformas. Artefactos sin procedencia o referencias mutables pueden introducir comportamiento oculto.', ['Inventariar artefactos con SBOM/AIBOM firmados.', 'Usar referencias por digest y verificar firmas y hashes.', 'Controlar conversión, merge, cuantización y promoción.'], llm2026Source('LLM04_SupplyChain'), 'Baja desde el puesto 3'),
  llmItem('LLM05', 5, 'Data and Model Poisoning', 'Datos o artefactos manipulados corrompen de forma duradera aprendizaje, embeddings, RAG o feedback continuo y pueden ocultar puertas traseras.', ['Mantener linaje, firmas, hashes y versiones recuperables.', 'Restringir la inyección de datos y supervisar reentrenamiento.', 'Monitorizar deriva, anomalías y desencadenantes.'], llm2026Source('LLM05_DataModelPoisoning'), 'Baja desde el puesto 4'),
  llmItem('LLM06', 6, 'Unbounded Consumption', 'El consumo sin límites explota la asimetría de costes para causar indisponibilidad, gasto o robo del modelo; agentes y razonamiento extendido aumentan el riesgo.', ['Aplicar límites por tokens, coste, usuario y sesión.', 'Imponer topes de gasto y límites de pasos o tiempo de agentes.', 'Detectar bucles y usar circuit breakers.'], llm2026Source('LLM06_UnboundedConsumption'), 'Sube desde el puesto 10'),
  llmItem('LLM07', 7, 'Misinformation', 'Información incorrecta o manipulada se convierte en vulnerabilidad cuando una persona, workflow o agente la acepta como cierta y actúa sobre ella.', ['Usar fuentes autorizadas y actuales.', 'Separar generación, verificación y ejecución.', 'Comprobar autorización, precondiciones y estado antes de actuar.'], llm2026Source('LLM07_Misinformation'), 'Sube desde el puesto 9'),
  llmItem('LLM08', 8, 'Hidden Context Exposure', 'La extracción o inferencia de instrucciones, reglas, esquemas de herramientas u otro contexto oculto aumenta la capacidad del atacante. Todo contexto accesible al modelo debe considerarse descubrible.', ['No colocar secretos ni controles críticos en el contexto oculto.', 'Implementar validación y políticas fuera del LLM.', 'Aplicar autorización y separación de privilegios de forma independiente.'], llm2026Source('LLM08_HiddenContextExposure'), 'Renombrada desde System Prompt Leakage'),
  llmItem('LLM09', 9, 'Vector and Embedding Weaknesses', 'La geometría de embeddings y búsqueda por similitud permite fugas entre tenants, inversión, envenenamiento, bloqueo de recuperación o manipulación de cachés.', ['Aplicar alcance de tenant dentro de la consulta.', 'Autenticar fuentes y versionar cada embedding.', 'No exponer puntuaciones brutas y monitorizar anomalías.'], llm2026Source('LLM09_VectorAndEmbeddingWeaknesses'), 'Baja desde el puesto 8'),
  llmItem('LLM10', 10, 'Improper Output Handling', 'Usar salidas sin validación antes de entregarlas a sistemas o renderizadores causa inyección, exfiltración o ejecución de código, incluido código generado inseguro.', ['Validar y codificar toda salida según el destino.', 'Bloquear recursos externos y caracteres de control no permitidos.', 'Revisar y probar el código generado antes de ejecutarlo.'], llm2026Source('LLM10_ImproperOutputHandling'), 'Baja desde el puesto 5'),
];

export const catalog = {
  defaultFamily: 'web',
  families: {
    web: {
      id: 'web',
      label: 'OWASP Top 10 · Web',
      shortLabel: 'Aplicaciones web',
      description: 'Cómo evolucionaron las categorías de riesgo de aplicaciones web desde 2013 hasta la edición vigente de 2025.',
      defaultYear: 2025,
      editions: [
        { year: 2013, hiddenByDefault: true, label: 'OWASP Top 10 2013', status: 'Histórica', items: web2013 },
        { year: 2017, label: 'OWASP Top 10 2017', status: 'Histórica', items: web2017 },
        { year: 2021, label: 'OWASP Top 10 2021', status: 'Anterior', items: web2021 },
        { year: 2025, label: 'OWASP Top 10 2025', status: 'Vigente', items: web2025 },
      ],
      edges: [
        { from: '2013:A1', to: '2017:A1', type: 'continues', note: 'Injection conserva el primer puesto.' },
        { from: '2013:A2', to: '2017:A2', type: 'renamed', note: 'El nombre se simplifica y mantiene el puesto 2.' },
        { from: '2013:A3', to: '2017:A7', type: 'moved', note: 'XSS baja del puesto 3 al 7.' },
        { from: '2013:A4', to: '2017:A5', type: 'merged', note: 'IDOR se integra en Broken Access Control.' },
        { from: '2013:A5', to: '2017:A6', type: 'moved', note: 'Security Misconfiguration baja un puesto.' },
        { from: '2013:A6', to: '2017:A3', type: 'moved', note: 'Sensitive Data Exposure sube al puesto 3.' },
        { from: '2013:A7', to: '2017:A5', type: 'merged', note: 'Missing Function Level Access Control se integra en Broken Access Control.' },
        { from: '2013:A9', to: '2017:A9', type: 'continues', note: 'La categoría de componentes conserva el puesto 9.' },
        { from: '2017:A5', to: '2021:A01', type: 'moved', note: 'Broken Access Control sube del puesto 5 al 1.' },
        { from: '2017:A3', to: '2021:A02', type: 'renamed', note: 'Sensitive Data Exposure se reformula como Cryptographic Failures.' },
        { from: '2017:A1', to: '2021:A03', type: 'moved', note: 'Injection baja del puesto 1 al 3.' },
        { from: '2017:A7', to: '2021:A03', type: 'merged', note: 'XSS se integra dentro de Injection.' },
        { from: '2017:A6', to: '2021:A05', type: 'moved', note: 'Security Misconfiguration sube un puesto.' },
        { from: '2017:A4', to: '2021:A05', type: 'merged', note: 'XXE se integra en Security Misconfiguration.' },
        { from: '2017:A9', to: '2021:A06', type: 'renamed', note: 'La categoría cambia a Vulnerable and Outdated Components.' },
        { from: '2017:A2', to: '2021:A07', type: 'renamed', note: 'Broken Authentication se amplía y cambia de nombre.' },
        { from: '2017:A8', to: '2021:A08', type: 'expanded', note: 'Insecure Deserialization pasa a una categoría de integridad más amplia.' },
        { from: '2017:A10', to: '2021:A09', type: 'renamed', note: 'Logging and Monitoring cambia de nombre y sube un puesto.' },
        { from: '2021:A01', to: '2025:A01', type: 'continues', note: 'Broken Access Control permanece en el puesto 1.' },
        { from: '2021:A10', to: '2025:A01', type: 'consolidated', note: 'SSRF se consolida dentro de Broken Access Control.' },
        { from: '2021:A05', to: '2025:A02', type: 'moved', note: 'Security Misconfiguration sube del puesto 5 al 2.' },
        { from: '2021:A06', to: '2025:A03', type: 'expanded', note: 'Vulnerable Components se amplía a Software Supply Chain Failures.' },
        { from: '2021:A02', to: '2025:A04', type: 'moved', note: 'Cryptographic Failures baja del puesto 2 al 4.' },
        { from: '2021:A03', to: '2025:A05', type: 'moved', note: 'Injection baja del puesto 3 al 5.' },
        { from: '2021:A04', to: '2025:A06', type: 'moved', note: 'Insecure Design baja del puesto 4 al 6.' },
        { from: '2021:A07', to: '2025:A07', type: 'renamed', note: 'El nombre se simplifica a Authentication Failures.' },
        { from: '2021:A08', to: '2025:A08', type: 'continues', note: 'La categoría continúa en el puesto 8 con un ajuste menor de nombre.' },
        { from: '2021:A09', to: '2025:A09', type: 'renamed', note: 'Monitoring cambia a Alerting.' },
      ],
    },
    llm: {
      id: 'llm',
      label: 'OWASP Top 10 · GenAI / LLM',
      shortLabel: 'GenAI y LLM',
      description: 'Evolución de los riesgos principales para aplicaciones con modelos generativos entre 2025 y la edición vigente de 2026.',
      defaultYear: 2026,
      editions: [
        { year: 2025, label: 'OWASP Top 10 for LLM Applications 2025', status: 'Anterior', items: llm2025 },
        { year: 2026, label: 'OWASP GenAI LLM Top 10 2026', status: 'Vigente', items: llm2026 },
      ],
      edges: [
        { from: '2025:LLM01', to: '2026:LLM01', type: 'continues', note: 'Prompt Injection permanece en el puesto 1 y amplía ataques multimodales.' },
        { from: '2025:LLM02', to: '2026:LLM02', type: 'continues', note: 'Sensitive Information Disclosure conserva el puesto 2.' },
        { from: '2025:LLM03', to: '2026:LLM04', type: 'moved', note: 'Supply Chain baja del puesto 3 al 4.' },
        { from: '2025:LLM04', to: '2026:LLM05', type: 'moved', note: 'Data and Model Poisoning baja del puesto 4 al 5.' },
        { from: '2025:LLM05', to: '2026:LLM10', type: 'moved', note: 'Improper Output Handling baja del puesto 5 al 10.' },
        { from: '2025:LLM06', to: '2026:LLM03', type: 'moved', note: 'Excessive Agency sube del puesto 6 al 3 por la adopción de agentes.' },
        { from: '2025:LLM07', to: '2026:LLM08', type: 'renamed', note: 'System Prompt Leakage se reformula como Hidden Context Exposure.' },
        { from: '2025:LLM08', to: '2026:LLM09', type: 'moved', note: 'Vector and Embedding Weaknesses baja del puesto 8 al 9.' },
        { from: '2025:LLM09', to: '2026:LLM07', type: 'moved', note: 'Misinformation sube del puesto 9 al 7.' },
        { from: '2025:LLM10', to: '2026:LLM06', type: 'moved', note: 'Unbounded Consumption sube del puesto 10 al 6.' },
      ],
    },
  },
};
