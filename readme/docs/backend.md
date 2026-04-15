# Backend: implementación mínima para contenido fresco

## Objetivo
Soportar “contenido fresco” mediante:
- **Manifest** de contenido (liviano, cacheable).
- **App config** (flags + copy + parámetros) cacheable.
- **Recursos grandes** (export de arcanos) cacheables.

La app solo necesita cambiar cuando:
- se agrega una nueva capacidad nativa, o
- cambia el contrato de API de forma incompatible.

## Contrato recomendado

### 1) Health
`GET /api/health`

Respuesta:
```json
{ "ok": true, "service": "mitarot-backend" }
```

### 2) Manifest de contenido
`GET /api/content/manifest`

Headers recomendados:
- `ETag: "<hash o revision>"`
- `Last-Modified: <http-date>`
- `Cache-Control: public, max-age=60`

Request headers soportados:
- `If-None-Match`
- `If-Modified-Since`

Respuesta 200 (ejemplo):
```json
{
  "schema_version": 1,
  "revision": 42,
  "updated_at": "2026-04-14T00:00:00Z",
  "resources": [
    {
      "key": "app_config",
      "etag": "\"cfg-9b3c...\"",
      "updated_at": "2026-04-14T00:00:00Z",
      "url": "/api/app-config"
    },
    {
      "key": "major_arcana_export_v2",
      "etag": "\"arc-1f2a...\"",
      "updated_at": "2026-04-14T00:00:00Z",
      "url": "/api/arcanos/export/v2/arcanos.json"
    }
  ]
}
```

Respuesta 304:
- Sin body.

### 3) App Config
`GET /api/app-config`

Headers recomendados:
- `ETag`
- `Cache-Control: public, max-age=60`

Respuesta 200 (ejemplo):
```json
{
  "schema_version": 1,
  "updated_at": "2026-04-14T00:00:00Z",
  "features": {
    "tarot_daily_enabled": true,
    "tarot_three_cards_enabled": true
  },
  "copy": {
    "tarot_daily_guest": "Hola. Bienvenido a MITAROT. Hoy el Tarot tiene 3 cartas para ti.",
    "tarot_daily_registered": "Hola, {name}. Hoy el Tarot tiene 3 mensajes para ti."
  },
  "ui": {
    "home_sections_order": ["tarot_daily", "major_arcana", "profile"]
  }
}
```

### 4) Export de arcanos
Ya existe (en tu app se consume):
- `GET /api/arcanos/export/v2/arcanos.json`

Mejora recomendada:
- servir con `ETag` y `Last-Modified`
- responder `304` si `If-None-Match` coincide

## Modelo de datos mínimo (PostgreSQL)

Archivo de referencia: [backend_reference/db.sql](file:///d:/AndroidStudioProjects/MITAROT/backend_reference/db.sql)

Tablas sugeridas:
- `app_config` (1 fila activa)
- `content_manifest` (1 fila activa)
- `major_arcana_export` (contenido JSON + updated_at + etag)

## Implementación de referencia (Node/Express)
Carpeta: [backend_reference](file:///d:/AndroidStudioProjects/MITAROT/backend_reference)

Incluye:
- `GET /api/health`
- `GET /api/content/manifest` con `ETag` y `304`
- `GET /api/app-config` con `ETag` y `304`
- `GET /api/arcanos/export/v2/arcanos.json` con `ETag` y `304`

Variables de entorno esperadas:
- `DATABASE_URL`
- `PORT`

Notas:
- El `ETag` se calcula con `sha256` del payload JSON.
- Para mantener consistencia, conviene recalcular y persistir `etag` en DB al actualizar contenido.

