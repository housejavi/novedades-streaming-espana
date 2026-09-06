require('dotenv').config();
const express = require('express');
const { buildManifest, catalogId } = require('./src/manifest');
const { decodeConfig, DEFAULT_CONFIG } = require('./src/userConfig');
const { renderConfigurePage } = require('./src/configurePage');
const { construirCatalogo, construirCatalogoCompleto } = require('./src/catalogHandler');
const { PLATFORMS } = require('./src/platforms');

const app = express();
const PORT = process.env.PORT || 7000;

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.get('host')}`;
}

// --- Página de configuración (sin config previa) --------------------------
app.get('/configure', (req, res) => {
  res.send(renderConfigurePage({ baseUrl: getBaseUrl(req), currentConfig: DEFAULT_CONFIG }));
});

// --- Página de configuración (reconfigurar desde una URL ya generada) -----
app.get('/:config/configure', (req, res) => {
  const currentConfig = decodeConfig(req.params.config);
  res.send(renderConfigurePage({ baseUrl: getBaseUrl(req), currentConfig }));
});

// --- Manifest sin configurar (todas las plataformas por defecto) ----------
app.get('/manifest.json', (req, res) => {
  res.json(buildManifest(DEFAULT_CONFIG));
});

// --- Manifest configurado ---------------------------------------------------
app.get('/:config/manifest.json', (req, res) => {
  const config = decodeConfig(req.params.config);
  res.json(buildManifest(config));
});

// --- Catálogo: helper compartido entre ruta con y sin config ---------------
// `extraStr` viene con la convención de Stremio: "skip=100" (o vacío/undefined
// si no hay paginación en la petición).
function parseExtra(extraStr) {
  const extra = {};
  if (!extraStr) return extra;
  for (const par of extraStr.split('&')) {
    const [k, v] = par.split('=');
    if (k) extra[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return extra;
}

async function manejarCatalogo(req, res, config, extraStr) {
  const { type, id } = req.params;
  const extra = parseExtra(extraStr);

  // Catálogo completo: id termina en "-full"
  const matchFull = id.match(/^jwes-(.+)-(movies|series)-full$/);
  if (matchFull) {
    const [, platformId, contentType] = matchFull;
    const stremioTipoEsperado = contentType === 'movies' ? 'movie' : 'series';
    if (type !== stremioTipoEsperado) return res.status(404).json({ metas: [] });

    try {
      const skip = parseInt(extra.skip, 10) || 0;
      const metas = await construirCatalogoCompleto({ platformId, contentType, skip });
      return res.json({ metas });
    } catch (err) {
      console.error('[server] Error construyendo catálogo completo:', err.message);
      return res.json({ metas: [] });
    }
  }

  // Catálogo de novedades (comportamiento existente)
  const match = id.match(/^jwes-(.+)-(movies|series)$/);
  if (!match) return res.status(404).json({ metas: [] });

  const [, platformId, contentType] = match;
  const stremioTipoEsperado = contentType === 'movies' ? 'movie' : 'series';
  if (type !== stremioTipoEsperado) return res.status(404).json({ metas: [] });

  try {
    const metas = await construirCatalogo({ platformId, contentType, dias: config.days });
    res.json({ metas });
  } catch (err) {
    console.error('[server] Error construyendo catálogo:', err.message);
    // Robustez: nunca devolver 500 desnudo a Stremio — mejor una
    // lista vacía que un addon que "se cae" en la interfaz.
    res.json({ metas: [] });
  }
}

app.get('/catalog/:type/:id.json', (req, res) => manejarCatalogo(req, res, DEFAULT_CONFIG, null));
app.get('/catalog/:type/:id/:extra.json', (req, res) =>
  manejarCatalogo(req, res, DEFAULT_CONFIG, req.params.extra)
);
app.get('/:config/catalog/:type/:id.json', (req, res) =>
  manejarCatalogo(req, res, decodeConfig(req.params.config), null)
);
app.get('/:config/catalog/:type/:id/:extra.json', (req, res) =>
  manejarCatalogo(req, res, decodeConfig(req.params.config), req.params.extra)
);

// --- Raíz: redirige a /configure para humanos que abran la URL a pelo -----
app.get('/', (req, res) => res.redirect('/configure'));

app.listen(PORT, () => {
  console.log(`Novedades Streaming España escuchando en http://localhost:${PORT}`);
  console.log(`Configuración: http://localhost:${PORT}/configure`);
  console.log(`Plataformas cargadas: ${PLATFORMS.length}`);
});
