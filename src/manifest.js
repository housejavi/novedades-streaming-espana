const { PLATFORMS, DAYS_OPTIONS, DEFAULT_ENABLED_IDS, DEFAULT_DAYS, getPlatformById } = require('./platforms');

const ADDON_ID = 'es.javier.novedades-streaming-espana';
const ADDON_VERSION = '0.1.0';

/**
 * Genera un catalogId estable para una plataforma+tipo de contenido.
 * Ej: "jwes-netflix-movies"
 */
function catalogId(platformId, contentType) {
  return `jwes-${platformId}-${contentType}`;
}

/**
 * Construye el manifest.json. Si se pasa `config`, los catálogos
 * incluidos son solo los de las plataformas/contenidos seleccionados
 * (así el usuario ve en Stremio/Nuvio exactamente lo que eligió, en
 * vez de una lista fija filtrada después).
 */
function buildManifest(config) {
  const cfg = config || { platforms: DEFAULT_ENABLED_IDS, content: ['movies', 'series'], days: DEFAULT_DAYS };

  const catalogs = [];
  for (const platformId of cfg.platforms) {
    const platform = getPlatformById(platformId);
    if (!platform) continue;

    if (cfg.content.includes('movies')) {
      catalogs.push({
        type: 'movie',
        id: catalogId(platform.id, 'movies'),
        name: `${platform.name} Nuevas`,
      });
    }
    if (cfg.content.includes('series')) {
      catalogs.push({
        type: 'series',
        id: catalogId(platform.id, 'series'),
        name: `${platform.name} Nuevas`,
      });
    }
  }

  return {
    id: ADDON_ID,
    version: ADDON_VERSION,
    name: 'Novedades Streaming España',
    description:
      'Novedades reales por fecha de incorporación (no por año de estreno ni popularidad) en Netflix, HBO Max, Prime Video, Disney+ y el resto de plataformas disponibles en España. Fuente: JustWatch España.',
    logo: 'https://www.justwatch.com/favicon.ico',
    resources: ['catalog'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs,
    behaviorHints: {
      configurable: true,
      configurationRequired: false,
    },
    // No usamos manifest.config de la SDK oficial porque servimos
    // /configure a mano con Express (ver server.js) — más control
    // sobre el formulario y evita depender de un mecanismo de
    // inyección de config que varía entre versiones del SDK.
  };
}

module.exports = { buildManifest, catalogId, DAYS_OPTIONS, PLATFORMS };
