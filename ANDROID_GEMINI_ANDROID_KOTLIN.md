# Instrucciones para GEMINI (Android Studio · Kotlin)

Objetivo: consumir el **Tarot CMS** y actualizar en Android el listado + detalle de Arcanos Mayores usando el JSON exportado por el CMS.

## Backend (Tarot CMS) — Rutas disponibles

- Export principal (contrato estable): `GET /arcanos/export/arcanos.json`
  - Dev local típico: `http://<HOST>:<PORT>/arcanos/export/arcanos.json`
- Imágenes estáticas (según `image_url`): `GET /public/img/<archivo>`
  - Ejemplo: `http://<HOST>:<PORT>/public/img/el-loco.jpg`

Notas:
- Desde un teléfono/emulador, **localhost** apunta al dispositivo, no a tu PC. Usa:
  - En emulador: `http://10.0.2.2:<PORT>/...`
  - En dispositivo real: `http://<IP_LAN_DE_TU_PC>:<PORT>/...`
  - Alternativa: túnel tipo ngrok / Cloudflare Tunnel.

## Contrato JSON (lo que devuelve el CMS)

`GET /arcanos/export/arcanos.json` devuelve:

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
      "keywords": ["..."],
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

Regla importante:
- `image_url` puede venir como **ruta relativa** (`/public/img/...`). En Android hay que resolverla como `BASE_URL + image_url`.

## Requerimiento Android

- Al iniciar la app (o con pull-to-refresh), descargar el JSON y hacer **upsert** en Room:
  - Si existe una carta con el mismo `id` (0–21), actualizar campos.
  - Si no existe, insertarla.
- La UI debe:
  - Mostrar lista de cartas con `number`, `name`, `keywords`.
  - Al entrar a detalle, mostrar `visual_description`, meanings `upright.general`, `reversed.general` y cargar imagen desde `image_url`.

## Implementación recomendada (Clean-ish)

- Red: Retrofit + OkHttp
- Parseo: kotlinx.serialization (o Moshi si ya existe)
- Persistencia: Room
- Sincronización: WorkManager (opcional) o manual desde UI

### 1) Modelos de red (DTO)

Usando kotlinx.serialization:

```kotlin
@Serializable
data class ArcanaExportDto(
  val metadata: MetadataDto,
  @SerialName("arcanos_mayores") val arcanosMayores: List<MajorArcanaDto>
)

@Serializable
data class MetadataDto(
  val version: String,
  @SerialName("last_updated") val lastUpdated: String,
  val author: String
)

@Serializable
data class MajorArcanaDto(
  val id: Int,
  val number: String,
  val slug: String,
  val name: String,
  @SerialName("arcana_type") val arcanaType: String,
  val keywords: List<String>,
  val meanings: MeaningsDto,
  @SerialName("visual_description") val visualDescription: String,
  @SerialName("image_url") val imageUrl: String,
  val attributes: AttributesDto
)

@Serializable
data class MeaningsDto(
  val upright: MeaningBlockDto,
  val reversed: MeaningBlockDto
)

@Serializable
data class MeaningBlockDto(
  val general: String,
  val advice: String,
  val career: String
)

@Serializable
data class AttributesDto(
  val element: String,
  val astrology: String,
  @SerialName("color_hex") val colorHex: String
)
```

### 2) Retrofit service

```kotlin
interface TarotCmsApi {
  @GET("/arcanos/export/arcanos.json")
  suspend fun fetchMajorArcanaExport(): ArcanaExportDto
}
```

BaseUrl:
- Emulador: `http://10.0.2.2:4000/`
- Device: `http://<IP_PC>:4000/`

### 3) Room entity

```kotlin
@Entity(tableName = "major_arcana")
data class MajorArcanaEntity(
  @PrimaryKey val id: Int,
  val number: String,
  val slug: String,
  val name: String,
  val keywordsCsv: String,
  val uprightGeneral: String,
  val reversedGeneral: String,
  val visualDescription: String,
  val imageUrl: String,
  val lastSyncedAt: Long
)
```

DAO:

```kotlin
@Dao
interface MajorArcanaDao {
  @Query("SELECT * FROM major_arcana ORDER BY id ASC")
  fun observeAll(): Flow<List<MajorArcanaEntity>>

  @Query("SELECT * FROM major_arcana WHERE id = :id")
  fun observeById(id: Int): Flow<MajorArcanaEntity?>

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsertAll(items: List<MajorArcanaEntity>)
}
```

### 4) Mapper DTO → Entity (resolviendo imagen)

```kotlin
fun MajorArcanaDto.toEntity(baseUrl: String, now: Long): MajorArcanaEntity {
  val resolvedImageUrl =
    if (imageUrl.startsWith("http")) imageUrl
    else baseUrl.trimEnd('/') + imageUrl

  return MajorArcanaEntity(
    id = id,
    number = number,
    slug = slug,
    name = name,
    keywordsCsv = keywords.joinToString(","),
    uprightGeneral = meanings.upright.general,
    reversedGeneral = meanings.reversed.general,
    visualDescription = visualDescription,
    imageUrl = resolvedImageUrl,
    lastSyncedAt = now
  )
}
```

### 5) Repositorio: sync + lectura local

```kotlin
class MajorArcanaRepository(
  private val api: TarotCmsApi,
  private val dao: MajorArcanaDao,
  private val baseUrl: String
) {
  val arcanos: Flow<List<MajorArcanaEntity>> = dao.observeAll()

  fun arcano(id: Int): Flow<MajorArcanaEntity?> = dao.observeById(id)

  suspend fun sync() {
    val export = api.fetchMajorArcanaExport()
    val now = System.currentTimeMillis()
    val entities = export.arcanosMayores.map { it.toEntity(baseUrl, now) }
    dao.upsertAll(entities)
  }
}
```

### 6) UI (Compose o XML)

Requerido:
- Pantalla lista: observa `repository.arcanos` y renderiza.
- Detalle: navega por `id` y observa `repository.arcano(id)`.
- Imagen: Coil (recomendado) cargando `entity.imageUrl`.

Ejemplo Coil (Compose):

```kotlin
AsyncImage(
  model = entity.imageUrl,
  contentDescription = entity.name,
  modifier = Modifier.fillMaxWidth()
)
```

### 7) “Actualizar listado” (refresh)

Implementa un botón “Actualizar” o pull-to-refresh que llame:

```kotlin
viewModelScope.launch { repository.sync() }
```

Opcional (automático):
- WorkManager 1 vez al día o al abrir la app.

## Checklist final (para GEMINI)

- Consumir `GET /arcanos/export/arcanos.json`
- Mapear JSON a DTOs
- Hacer upsert en Room por `id`
- Resolver `image_url` relativo con `baseUrl`
- UI lista + detalle usando datos de Room
- Botón/acción de “Actualizar” que re-sincroniza

