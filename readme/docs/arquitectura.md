# Arquitectura para mantener contenido fresco (MITAROT)

## Objetivo
Mantener el contenido de la app fresco (textos, interpretaciones, tiradas, orden de secciones, imágenes, banners, paywall copy, etc.) sin tener que publicar una nueva versión de la app para cada ajuste.

La idea central es separar:
- **App**: capacidades, UI, lógica de presentación, cache y sincronización.
- **Contenido**: datos y configuraciones que cambian con frecuencia, alojadas en backend.

## Principios
- **Backend como source of truth**: la fuente oficial del contenido y reglas vive en el servidor.
- **Offline-first**: la app funciona con cache local (Room) y se actualiza por sincronización.
- **UI reactiva**: la UI se alimenta de Flows/Room; cuando se sincroniza, la UI se actualiza sola.
- **Contratos versionados**: endpoints estables, payloads versionados o con `schema_version` para evolucionar sin romper.
- **Cache inteligente (ETag/Last-Modified)**: evitar descargar contenido si no ha cambiado.

## Capas (Android)
- **Remote** (Retrofit): obtiene snapshots y config del backend.
- **Local** (Room / DataStore):
  - Room: contenido grande (arcanos, lecturas, catálogos, manifest).
  - DataStore: preferencias y pequeños estados (ids, flags locales).
- **Repository**: fuente única de datos; decide cuándo leer de cache y cuándo sync.
- **ViewModel**: expone `StateFlow` para UI; dispara sync en eventos.
- **UI** (Compose): renderiza y reacciona a cambios.

## Qué contenido conviene mover al backend
- Arcanos: metadatos, textos completos, imágenes, keywords.
- Tarot del día: mensaje, ids de cartas del día, lectura (intro/pasado/presente/futuro/cierre).
- Copy (textos) y variantes de UX: saludos, instrucciones, placeholders, títulos.
- Reglas de presentación: orden de secciones, habilitar/deshabilitar features, enlaces.
- Paywall: copy, opciones y experimentos (sin implementar cobro aún).

## Mecanismo de actualización (recomendado)
### 1) Manifest de contenido
Un endpoint entrega un **manifest** pequeño que describe “qué hay” y “qué versión”:
- `revision`: entero incremental o hash global.
- `updated_at`: timestamp.
- `resources`: lista de recursos (ej. `major_arcana_export_v2`, `app_config`, `daily_copy_es`), cada uno con `etag`, `updated_at`, `url` y opcionalmente tamaño/checksum.

La app guarda el manifest en Room. Si el manifest no cambia (ETag 304), no baja nada más.

### 2) Recursos con cache HTTP
Cada recurso grande se sirve con:
- `ETag`
- `Last-Modified`
- `Cache-Control` (ej. `public, max-age=60`)

La app hace requests con:
- `If-None-Match: <etag>`
- `If-Modified-Since: <lastModified>`

Si el backend responde `304 Not Modified`, se conserva el cache local.

### 3) Sincronización
Disparadores típicos:
- Al abrir la app (sync liviano del manifest).
- En background (WorkManager cada X horas, con Wi‑Fi/carga opcional).
- En acciones puntuales (ej. después de completar registro).

## Estrategia de compatibilidad
- Mantener `schema_version` en `app_config` y `manifest`.
- Si la app recibe `schema_version` mayor al soportado, puede degradar:
  - ignorar campos desconocidos (ya se usa `ignoreUnknownKeys`),
  - usar defaults locales,
  - evitar activar features no soportadas.

## Seguridad y entornos (dev/prod)
- **Tokens y URLs no deben ir hardcodeados** en el repo.
- Configurar:
  - `API_BASE_URL` por ambiente,
  - `API_TOKEN` desde `local.properties` o variables de entorno.
- En debug se permite HTTP para consumir IP local; en release restringir a HTTPS.

## Checklist de implementación
- Backend:
  - Endpoint `GET /api/content/manifest` con ETag.
  - Endpoint `GET /api/app-config` con ETag.
  - Servir export de arcanos con ETag/Last-Modified.
- App:
  - Repo y tablas para manifest/config.
  - WorkManager de sync.
  - Aplicar flags/copy desde config.

