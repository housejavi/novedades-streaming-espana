/**
 * Catálogo de plataformas soportadas.
 *
 * `slug` es el identificador que usa JustWatch en sus URLs:
 *   https://www.justwatch.com/es/proveedor/<slug>/nuevo/peliculas
 *   https://www.justwatch.com/es/proveedor/<slug>/nuevo/series
 *
 * Confianza de cada slug (ver conversación de investigación):
 *   - "verificado": comprobado en vivo contra la web de JustWatch.
 *   - "probable": inferido por consistencia con otros países (mx/py/sv/cl),
 *     no confirmado directamente contra /es todavía.
 *
 * Si en producción alguna plataforma devuelve 404 o vacío, lo primero
 * a revisar es este archivo: JustWatch cambia slugs cuando cambian
 * acuerdos comerciales (p.ej. rebrandings de "HBO Max" a "Max" y vuelta).
 */

const PLATFORMS = [
  { id: 'netflix', name: 'Netflix', slug: 'netflix', confidence: 'verificado', emoji: '🔴' },
  { id: 'hbomax', name: 'HBO Max', slug: 'hbo-max', confidence: 'verificado', emoji: '🟣' },
  { id: 'primevideo', name: 'Prime Video', slug: 'amazon-prime-video', confidence: 'verificado', emoji: '🔵' },
  { id: 'disneyplus', name: 'Disney+', slug: 'disney-plus', confidence: 'verificado', emoji: '🔷' },
  { id: 'appletvplus', name: 'Apple TV+', slug: 'apple-tv-plus', confidence: 'verificado', emoji: '⚪' },
  { id: 'movistarplus', name: 'Movistar Plus+', slug: 'movistar-plus-eu9-99', confidence: 'verificado', emoji: '🟢' },
  { id: 'movistarficcion', name: 'Movistar Plus+ Ficción Total', slug: 'movistar-plus-plus-ficcion-total', confidence: 'verificado', emoji: '🟢' },
  { id: 'skyshowtime', name: 'SkyShowtime', slug: 'skyshowtime', confidence: 'verificado', emoji: '🟡' },
  { id: 'filmin', name: 'Filmin', slug: 'filmin', confidence: 'verificado', emoji: '🟠' },
  { id: 'paramountplus', name: 'Paramount+', slug: 'paramount-plus', confidence: 'probable', emoji: '🔵' },
  { id: 'rakutentv', name: 'Rakuten TV', slug: 'rakuten-tv', confidence: 'verificado', emoji: '🟤' },
  { id: 'atresplayer', name: 'Atresplayer', slug: 'atres-player', confidence: 'verificado', emoji: '🟢' },
];

// Plataformas activadas por defecto cuando el usuario instala el addon
// sin pasar por la página de configuración.
const DEFAULT_ENABLED_IDS = PLATFORMS.map((p) => p.id);

const DAYS_OPTIONS = ['7', '14', '30'];
const DEFAULT_DAYS = '14';

function getPlatformById(id) {
  return PLATFORMS.find((p) => p.id === id);
}

module.exports = {
  PLATFORMS,
  DEFAULT_ENABLED_IDS,
  DAYS_OPTIONS,
  DEFAULT_DAYS,
  getPlatformById,
};
