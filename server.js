require('dotenv').config();
const express = require('express');
const { buildManifest, catalogId } = require('./src/manifest');
const { decodeConfig, DEFAULT_CONFIG } = require('./src/userConfig');
const { renderConfigurePage } = require('./src/configurePage');
const { construirCatalogo } = require('./src/catalogHandler');
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
async function manejarCatalogo(req, res, config) {
  const { type, id } = req.params;

  // id tiene forma "jwes-<platformId>-<movies|series>"
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

app.get('/catalog/:type/:id.json', (req, res) => manejarCatalogo(req, res, DEFAULT_CONFIG));
app.get('/:config/catalog/:type/:id.json', (req, res) =>
  manejarCatalogo(req, res, decodeConfig(req.params.config))
);

// --- Raíz: redirige a /configure para humanos que abran la URL a pelo -----
app.get('/', (req, res) => res.redirect('/configure'));

app.listen(PORT, () => {
  console.log(`Novedades Streaming España escuchando en http://localhost:${PORT}`);
  console.log(`Configuración: http://localhost:${PORT}/configure`);
  console.log(`Plataformas cargadas: ${PLATFORMS.length}`);
});
