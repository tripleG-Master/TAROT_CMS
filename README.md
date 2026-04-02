# Tarot CMS (Arcanos Mayores) · Node.js + Express + Handlebars + PostgreSQL (Sequelize)

Panel administrativo para gestionar los **22 Arcanos Mayores (0–21)** y exportar un **arcanos.json** listo para consumir desde Android (Room/SQLite).

## Features

- CRUD de Arcanos Mayores (crear, listar, ver detalle, editar, eliminar)
- Importación desde JSON (pegado) y atajo para importar `data/arcanosMajores.json`
- Exportación de contrato JSON (metadata + `arcanos_mayores`) para Android
- Servidor de imágenes estáticas desde `public/img` (tema oscuro “místico”)
- PostgreSQL + Sequelize (sin SQL manual en controladores)

## Stack

- Node.js + Express
- Handlebars (`express-handlebars`)
- PostgreSQL
- Sequelize + pg
- UI: Bootstrap (Bootswatch Darkly)

## Requisitos

- Node.js + npm
- PostgreSQL 15+ (local o remoto)

## Instalación

```bash
npm install
```

## Variables de entorno

Este repo ignora `.env` por seguridad. Crea un `.env` en la raíz con:

```env
NODE_ENV=development
HOST=127.0.0.1
PORT=4000

PGHOST=localhost
PGPORT=5432
PGDATABASE=tarot_cms
PGUSER=postgres
PGPASSWORD=postgres

EXPORT_AUTHOR=Oracle Family Devs
EXPORT_VERSION=1.0.0
```

Notas:
- Si `PGDATABASE` no existe, el servicio intenta crearla automáticamente conectando a `PGADMIN_DB` (por defecto `postgres`).
- Para producción, usa un usuario/contraseña dedicados y fuertes.

## Ejecutar

Modo normal:

```bash
npm start
```

Modo desarrollo (auto-reload):

```bash
npm run dev
```

La app queda en:
- `http://HOST:PORT/arcanos`

## Rutas principales

### UI (CMS)

- `GET /arcanos` — listado
- `GET /arcanos/new` — crear
- `POST /arcanos` — guardar nuevo
- `GET /arcanos/:id` — detalle
- `GET /arcanos/:id/edit` — editar
- `PUT /arcanos/:id` — actualizar
- `DELETE /arcanos/:id` — eliminar

### Importación

- `GET /arcanos/import` — pantalla de importación
- `POST /arcanos/import` — importar pegando JSON
- `POST /arcanos/import/local` — importar automáticamente `data/arcanosMajores.json`

La importación hace **upsert por `numero` (0–21)**.

### Export (contrato para Android)

- `GET /arcanos/export/arcanos.json` — descarga `arcanos.json`

Estructura (resumen):

```json
{
  "metadata": { "version": "1.0.0", "last_updated": "ISO-8601", "author": "..." },
  "arcanos_mayores": [
    {
      "id": 0,
      "number": "0",
      "slug": "el_loco",
      "name": "El Loco",
      "arcana_type": "major",
      "keywords": ["Inicios", "Fe"],
      "meanings": {
        "upright": { "general": "...", "advice": "", "career": "" },
        "reversed": { "general": "...", "advice": "", "career": "" }
      },
      "visual_description": "...",
      "image_url": "/public/img/el-loco.jpg",
      "attributes": { "element": "", "astrology": "", "color_hex": "" }
    }
  ]
}
```

### Estáticos (imágenes)

- `GET /public/img/<archivo>` — ejemplo: `/public/img/el-loco.jpg`

Si `imagen_url` está vacío en DB, el export intenta resolver la imagen por nombre:
- Normaliza el nombre a minúsculas, sin acentos, usando `-` (ej: `El Loco` → `el-loco.jpg`)
- Soporta `.jpg`, `.jpeg`, `.png`, `.webp`
- Alias incluido: `El Hierofante` → `el-papa.jpg`

## Importante para Android

- `image_url` puede ser **relativo** (`/public/img/...`), por lo que en Android debes resolverlo con `BASE_URL + image_url`.
- Para emulador Android, el host del PC es `10.0.2.2` (si el CMS corre en tu máquina).

Guía para un agente GEMINI (Android Studio Kotlin):
- Ver [ANDROID_GEMINI_ANDROID_KOTLIN.md](./ANDROID_GEMINI_ANDROID_KOTLIN.md)

## Deploy rápido (sin dominio, con IP pública + Nginx)

- Levanta la app en `127.0.0.1:4000`
- Configura Nginx como reverse proxy en `:80` apuntando a `127.0.0.1:4000`
- Abre el puerto 80 en tu Security Group

Endpoints:
- `http://IP_PUBLICA/arcanos`
- `http://IP_PUBLICA/arcanos/export/arcanos.json`
- `http://IP_PUBLICA/public/img/el-loco.jpg`

