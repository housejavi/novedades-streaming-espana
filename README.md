# Novedades Streaming España

Addon de Stremio / Nuvio que muestra las novedades **por fecha real de
incorporación a la plataforma en España** (no por año de estreno, ni
popularidad, ni "Trending"), usando como fuente las páginas
`justwatch.com/es/proveedor/<slug>/nuevo/...`.

## ⚠️ Estado del proyecto

**El scraper ya está verificado contra datos reales**, no es una suposición:

- Netflix España → Películas nuevas: 40 títulos, orden cronológico correcto.
- HBO Max España → Series nuevas: 21 títulos, orden correcto, sin el
  fallo de "serie antigua arriba" que tenía OmniCatalogs.
- Resolución de IMDb ID vía TMDB: funciona (títulos genéricos sin año
  de referencia pueden fallar puntualmente — limitación conocida, no
  un bug).

Lo que queda por comprobar antes de dar el V1 por completamente
cerrado:

1. Ejecutar el addon completo (`npm start` en esta carpeta, no en la
   de pruebas) y comprobar los endpoints `/catalog/...` reales — ver
   sección "Prueba final" más abajo.
2. Confirmar que `paramount-plus` funciona contra `/es/` (slug
   "probable", no verificado directamente).
3. Decidir qué hacer con el histórico más allá de lo que trae la
   carga inicial (parece ser ~8 días por plataforma; para llegar a 30
   días fiables puede hacer falta paginar).

## Prueba final antes de desplegar

1. En esta carpeta (la del proyecto completo, no `novedades-poc`):
   ```
   npm install
   ```
2. Copia `.env.example` a `.env` y pon tu `TMDB_API_KEY` (la misma que
   ya probaste).
3. ```
   npm start
   ```
4. Con el servidor corriendo, abre en el navegador:
   - `http://localhost:7000/catalog/movie/jwes-netflix-movies.json`
   - `http://localhost:7000/catalog/series/jwes-hbomax-series.json`

   Deberías ver un JSON con `"metas": [...]`, cada uno con un `id`
   tipo `tt1234567` y `name` con el título. Si sale así, el addon
   funciona de punta a punta.

## Qué SÍ está verificado

- La URL `justwatch.com/es/proveedor/<slug>/nuevo/<peliculas|series>`
  existe, es accesible sin JavaScript (contenido server-rendered) y
  muestra títulos agrupados por fecha real de incorporación —
  comprobado en vivo contra Netflix España.
- Los slugs de las 12 plataformas objetivo (ver `src/platforms.js`),
  con nivel de confianza indicado.
- El manifest, el filtrado de catálogos por configuración, la página
  `/configure` y la degradación ante fallos de red están probados
  contra un servidor real.

## Instalación local

```bash
npm install
cp .env.example .env
# Rellena TMDB_API_KEY en .env (gratis: https://www.themoviedb.org/settings/api)
npm start
```

Abre `http://localhost:7000/configure`, elige tus plataformas, pulsa
"Generar enlace de instalación" y pega la URL resultante en Stremio
(Añadir addon → pegar URL) o en Nuvio (Content & Discovery → Addons →
pegar manifest URL).

## Por qué hace falta TMDB_API_KEY

JustWatch no expone el IMDb ID en las páginas de "nuevo". Para que
los títulos funcionen con otros addons de Stremio (streams,
subtítulos, etc.) hace falta un IMDb ID válido, así que cada título
nuevo se busca una vez en TMDB y se cachea permanentemente en
`data/id-cache.json`. Es gratuita y de alto límite de peticiones para
este volumen de uso.

## Despliegue

No hace falta navegador headless (Playwright/Puppeteer) — el scraping
es HTTP + parseo de HTML server-rendered, así que cualquier hosting
que ejecute Node.js de forma persistente sirve. Recomendación por
sencillez y coste:

| Opción | Encaja bien | Por qué |
|---|---|---|
| **Render (free/starter)** | ✅ Recomendado | Deploy directo desde Dockerfile o desde `npm start`, disco persistente en el plan de pago (útil para `data/id-cache.json`), certificado HTTPS automático. |
| **Railway** | ✅ Alternativa sólida | Igual de sencillo que Render, plan gratuito con límite de horas/mes. |
| **Fly.io** | ✅ Viable | Más control (regiones, volúmenes), algo más de configuración inicial (`fly.toml`). |
| **Cloudflare Workers** | ❌ No recomendado | Sin sistema de archivos persistente ni soporte nativo para `axios`/`cheerio` tal cual — habría que reescribir con `fetch` + un parser HTML compatible con Workers, y renunciar a la caché en disco. |
| **Vercel** | ⚠️ Posible pero incómodo | Funciones serverless sin disco persistente entre invocaciones — perderías la caché de IDs entre despliegues/cold starts, más llamadas a TMDB de las necesarias. |

Con Render o Railway: conecta el repo, define `TMDB_API_KEY` como
variable de entorno, y usa el `Dockerfile` incluido o el comando
`node server.js`. La URL pública que te den (algo como
`https://tu-addon.onrender.com`) es tu base — `/configure` genera la
URL de instalación final.

## Estructura

```
novedades-streaming-espana/
├── server.js              # Express: /configure, /manifest.json, /catalog/...
├── src/
│   ├── platforms.js       # Slugs de JustWatch por plataforma
│   ├── userConfig.js       # Codifica/decodifica la config del usuario en la URL
│   ├── manifest.js         # Construye manifest.json según config
│   ├── configurePage.js    # HTML de /configure
│   ├── scraper.js          # Descarga y parsea las páginas "nuevo" (⚠️ ver arriba)
│   ├── idResolver.js       # JustWatch título -> IMDb ID vía TMDB
│   ├── catalogHandler.js   # Orquesta scraping + IDs + orden cronológico + caché
│   └── cache.js            # Caché en memoria (TTL) + caché de IDs en disco
├── data/                   # id-cache.json se genera aquí (no versionar)
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Limitaciones conocidas

- **Histórico limitado por lo que JustWatch pre-renderiza.** La
  primera carga de `/nuevo` trae varios días hacia atrás, pero para
  llegar de forma fiable a 30 días en todas las plataformas puede
  hacer falta paginar (scroll infinito) — pendiente de comprobar
  cuántos días trae cada plataforma en la práctica.
- **Resolución de IMDb ID por nombre, sin año**, puede fallar con
  títulos ambiguos (remakes, nombres genéricos). Si esto da problemas
  reales, la alternativa es extraer el ID directamente de la ficha de
  detalle de JustWatch, pendiente de investigar si compensa el coste.
- **Solo Paramount+** tiene slug "probable" (`paramount-plus`) — funciona
  igual en mx/py/sv/cl/do, pero no he visto el link exacto `/es/` en
  una búsqueda; Rakuten TV y Atresplayer ya están verificados en firme
  contra `/es/`. Revisar si Paramount+ da 404 en el primer despliegue.
- **El parser (`scraper.js`) usa ahora una heurística basada en datos
  reales** (los títulos son el `alt` de la imagen del póster, no texto
  de enlace — confirmado contra una página real de Paramount+), pero
  sigue sin confirmarse contra el HTML exacto de `/es/`. Sigue siendo
  buena idea correr `poc-diagnostico.js` antes de confiar el resultado
  a ciegas.
- Uso pensado como **personal, no comercial** — respeta los términos
  de JustWatch y no satures sus servidores (la caché de 45 min ya
  ayuda a esto).
