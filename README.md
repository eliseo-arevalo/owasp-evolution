# OWASP Evolution Explorer

Explorador estático e interactivo para entender cómo evolucionan las categorías de riesgo de OWASP a través del tiempo.

## Incluye

- OWASP Top 10 Web: 2013, 2017, 2021 y 2025.
- OWASP Top 10 para GenAI/LLM: 2025 y 2026.
- Filtro de ediciones generado desde el catálogo; Web muestra 2017, 2021 y 2025 por defecto, con 2013 disponible al activarla.
- Idioma español/inglés con elección manual persistente.
- Conexiones siempre visibles y linaje seleccionado resaltado.
- Linaje por categoría: continuidad, movimiento, renombre, fusión, ampliación y consolidación.
- Búsqueda tolerante a acentos por identificador, nombre y explicación.
- Vista detallada con resumen, prevención, relaciones y fuente oficial.
- Rutas compartibles mediante hash, por ejemplo `#/web/2025/A01`.
- Diseño responsive sin dependencias de ejecución ni servicios de backend.

## Desarrollo

```bash
npm test
npm run build
npm start
```

La aplicación se sirve en `http://127.0.0.1:4173` y el artefacto publicable queda en `dist/`.

## Estructura

- `src/data.js`: catálogo, explicaciones, prevención, enlaces y relaciones.
- `src/model.js`: búsqueda, rutas, consulta y cálculo de linaje.
- `src/app.js`: interfaz y conexiones visuales.
- `tests/model.test.js`: pruebas del modelo de datos.
- `styles.css`: sistema visual y responsive.
- `scripts/build.js`: generación de `dist/`.

## Actualizar una edición

1. Añadir la edición y sus diez categorías en `src/data.js`.
2. Añadir únicamente relaciones con la edición inmediatamente anterior.
3. Usar nombres y fuentes oficiales de OWASP.
4. Añadir traducciones de los nuevos textos a `src/translations-en.js`. Una edición nueva aparece en el filtro automáticamente; `hiddenByDefault: true` la oculta inicialmente.
5. Ejecutar `npm run check`.
6. Revisar visualmente escritorio y móvil.

## Despliegue en Cloudflare Pages

```bash
npm run build
npx --yes wrangler pages deploy dist --project-name=owasp-evolution
```

## Fuentes y precisión

El contenido factual enlaza exclusivamente a sitios y repositorios oficiales de OWASP. Las explicaciones y medidas preventivas están resumidas en español e inglés; se conservan los nombres oficiales de categorías en inglés. OWASP Top 10 describe categorías de riesgo, no un inventario exhaustivo de vulnerabilidades.

Este proyecto es educativo y no está afiliado oficialmente con OWASP Foundation.

## Idioma y comprobación local

El Worker generado con `npm run build:worker` detecta primero `CF-IPCountry`: países hispanohablantes → español, otros códigos → inglés. Sin ese header, usa `Accept-Language`. Inyecta la detección en el HTML y varía la respuesta por ambos headers, sin servicios externos. En un servidor estático como `npm start`, se usa `navigator.language`. La selección manual del menú Idioma prevalece y persiste en `localStorage`; si el almacenamiento está bloqueado, el cambio funciona durante la sesión.

En `http://127.0.0.1:4173`, activar/desactivar ediciones, seleccionar categorías y comprobar que las otras conexiones siguen visibles. Probar también solo 2017 y 2025 para ver conexiones a través de 2021 oculto. Cambiar idioma, abrir detalles, buscar y recargar para comprobar la persistencia. La última edición visible no puede desactivarse. Una búsqueda o enlace directo a un año oculto lo activa para mostrar el resultado.
