# OWASP Evolution

Explorador estático bilingüe de OWASP Top 10 Web (2013–2025) y GenAI/LLM (2025–2026). Conserva nombres oficiales, linaje, búsqueda, exportación, temas, menús y panel de detalle acoplable. Sin framework ni dependencias de ejecución.

## Construir y verificar

```sh
npm run build
npm test
npm start
MOTION_PLAYWRIGHT=/ruta/a/playwright/index.mjs npm test -- --test-concurrency=1
```

Node genera `dist/`; `npm start` lo sirve en el puerto 4173. `SITE_URL` define el origen público del build; por defecto se usa `homepage` de package.json. Publicar el contenido completo de `dist/` en cualquier servidor estático con soporte para índices de directorio. No se necesitan rewrites. Configurar `404.html` como documento de error y compresión HTTP; HTML debe revalidarse y los assets con hash pueden cachearse durante un año como immutable.

## Interacción y exportación

Las seis pestañas del detalle permanecen visibles en paneles estrechos. El encabezado muestra el nombre completo; el panel admite posición izquierda, derecha, inferior y pantalla completa. `?` abre la ayuda de atajos: flechas navegan, Enter abre el detalle y Escape lo cierra. El menú de exportación guarda la matriz en PNG, SVG, CSV, JSON o Markdown; el detalle permite exportar el elemento en Markdown y copiar su enlace. Los diagramas y ejemplos se incluyen también en páginas sin JavaScript.

## Rutas y SEO

`/` sirve inglés por defecto y `/es/` español. `/en/` y sus rutas profundas siguen sirviendo inglés como alias con canonical hacia las URLs sin prefijo; los alias no aparecen en el sitemap. Familias inglesas: `/web/`, `/genai/`; españolas: `/es/web/`, `/es/genai/`. Ejemplo: `/web/2025/a01-broken-access-control/`. Cada ruta tiene su propio `index.html` con icono, diagrama accesible, ejemplo concreto, corrección, descripción, prevención, linaje y enlaces oficiales legibles sin JavaScript. Los hashes históricos se convierten mediante replaceState; la navegación usa pushState y soporta Atrás/Adelante. El idioma de la URL prevalece sobre preferencias guardadas.

Cada página incluye título, descripción, canonical, alternates es/en/x-default, Open Graph, Twitter y datos estructurados. El hreflang `x-default` apunta al inglés. La portada usa título y descripción ingleses y `og-web-en.png` para la vista previa social. Sitemap, robots y documentos llms se generan desde el catálogo con las rutas canónicas de ambos idiomas. Cuatro PNG sociales de 1200×630, por familia e idioma, tienen sus fuentes SVG en assets. Se usan imágenes comunes porque Node no incluye un rasterizador SVG; el build no exige instalar un navegador ni un conversor. Los PNG se distribuyen como assets reproducibles desde los SVG con cualquier rasterizador.

El worker opcional delega en el servicio de archivos estáticos y no detecta idioma ni reescribe HTML. La detección geográfica anterior contradecía las URLs canónicas. `npm run build:worker` genera su módulo; el hosting estático es suficiente. El manifiesto aporta iconos PNG/SVG y modo standalone; no hay service worker.

## Estructura y contenido

- `src/data.js`: catálogo, resúmenes, prevención, relaciones y fuentes oficiales.
- `src/translations-en.js`, `src/i18n.js`: traducciones del contenido y la interfaz.
- `src/visuals.js`, `src/icons.js`: 30 conceptos visuales con paths compartidos y ejemplos bilingües.
- `src/model.js`, `src/routes.js`: consultas, linaje y rutas públicas.
- `src/app.js`, `src/motion.js`: interfaz, movimiento y navegación.
- `scripts/build.js`, `scripts/seo.js`: prerender, compactación y nombres de assets con hash.
- `tests/`: pruebas unitarias y suites opcionales de Chrome.

Para añadir una edición, incorporar sus diez categorías y relaciones con la edición anterior, fuentes oficiales y traducciones, además de registrar su concepto visual, icono, diagrama y ejemplo en `src/visuals.js`. La prueba de cobertura falla si falta cualquier visual o si dos conceptos distintos comparten un ID de layout. Ejecutar las pruebas y revisar ambos idiomas, temas, escritorio y móvil. Las ediciones nuevas aparecen automáticamente en el filtro; `hiddenByDefault` controla su visibilidad inicial.

Los datos enlazan a documentación y repositorios oficiales de OWASP. Las explicaciones y prevención son resúmenes educativos, no citas literales ni un inventario exhaustivo de vulnerabilidades. Este proyecto no está afiliado oficialmente con OWASP Foundation.

## Support

[Buy me a coffee / Invítame un café](https://ko-fi.com/oclazi) — Apoya el proyecto / Support the project.

## Licencia

Código bajo MIT, véase LICENSE. Las fuentes y denominaciones OWASP pertenecen a sus titulares.

Los iconos de las 60 categorías y de la interfaz usan paths SVG de [Phosphor Icons](https://github.com/phosphor-icons/core), peso duotone, © 2023 Phosphor Icons, licencia MIT. Se incluyen únicamente los paths necesarios en `src/icons.js`, sin dependencia de ejecución; los rellenos secundarios usan un acento por categoría y tiles neutros. Véanse la [atribución y versión fijada](LICENSES/third-party.md) y la [licencia MIT original](LICENSES/phosphor-icons-MIT.txt), también incluidas en el build.

Cada una de las 60 categorías incluye una composición de ataque adecuada a su concepto y un ejemplo educativo de hasta cuatro líneas, seleccionable como `<pre><code>`, con el punto vulnerable resaltado y una corrección EN/ES. Los ejemplos permanecen en inglés y se prerenderizan junto con los diagramas accesibles. El movimiento finaliza en 420 ms como máximo; reduced motion muestra el resultado al instante.
