const { PLATFORMS, DEFAULT_ENABLED_IDS, DAYS_OPTIONS, DEFAULT_DAYS } = require('./platforms');

const DEFAULT_CONFIG = {
  platforms: DEFAULT_ENABLED_IDS,
  days: DEFAULT_DAYS,
  content: ['movies', 'series'],
};

/**
 * Codifica la configuración como un string base64url apto para ir en
 * un segmento de la URL, ej:
 *   https://mi-addon.example.com/<CONFIG>/manifest.json
 */
function encodeConfig(config) {
  const json = JSON.stringify(config);
  return Buffer.from(json, 'utf8').toString('base64url');
}

/**
 * Decodifica un segmento de configuración. Si no es válido o está
 * ausente, devuelve la configuración por defecto (todas las
 * plataformas, 14 días, películas+series) en vez de fallar — un
 * addon mal configurado no debe romperse, debe degradar con
 * sensatez.
 */
function decodeConfig(segment) {
  if (!segment) return { ...DEFAULT_CONFIG };

  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);

    const platformIds = Array.isArray(parsed.platforms) && parsed.platforms.length
      ? parsed.platforms.filter((id) => PLATFORMS.some((p) => p.id === id))
      : DEFAULT_ENABLED_IDS;

    const days = DAYS_OPTIONS.includes(String(parsed.days)) ? String(parsed.days) : DEFAULT_DAYS;

    const content = Array.isArray(parsed.content) && parsed.content.length
      ? parsed.content.filter((c) => c === 'movies' || c === 'series')
      : ['movies', 'series'];

    return { platforms: platformIds, days, content };
  } catch (err) {
    // Segmento corrupto o no es en realidad una config (podría ser
    // otra ruta cualquiera) — degradamos a valores por defecto.
    return { ...DEFAULT_CONFIG };
  }
}

module.exports = { encodeConfig, decodeConfig, DEFAULT_CONFIG };
