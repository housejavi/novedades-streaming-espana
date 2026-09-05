const { getPlatformById } = require('./platforms');
const { obtenerNuevosDePlataforma } = require('./scraper');
const { resolverImdbId } = require('./idResolver');
const { getCached, setCached } = require('./cache');

const JW_TIPO_A_STREMIO = { movies: 'peliculas', series: 'series' };
const STREMIO_TIPO = { movies: 'movie', series: 'series' };

/**
 * Filtra por antigüedad según los días configurados por el usuario.
 */
function dentroDelPeriodo(fechaISO, dias) {
  const limite = new Date();
  limite.setDate(limite.getDate() - parseInt(dias, 10));
  return new Date(fechaISO) >= limite;
}

/**
 * Obtiene (con caché) los títulos nuevos en bruto de una plataforma,
 * para un tipo de contenido concreto.
 */
async function obtenerConCache(platform, contentType) {
  const jwTipo = JW_TIPO_A_STREMIO[contentType];
  const cacheKey = `raw:${platform.slug}:${jwTipo}`;

  const cacheado = getCached(cacheKey);
  if (cacheado) return cacheado;

  try {
    const resultados = await obtenerNuevosDePlataforma(platform.slug, jwTipo);
    setCached(cacheKey, resultados);
    return resultados;
  } catch (err) {
    console.error(`[catalogHandler] Fallo al obtener ${platform.name} (${jwTipo}):`, err.message);
    // Robustez: si una plataforma falla, el resto del addon debe seguir
    // funcionando. Devolvemos lista vacía en vez de propagar el error.
    return [];
  }
}

/**
 * Construye la lista de Meta Preview Objects de Stremio para un
 * platformId + contentType + días de histórico, ordenados por fecha
 * de incorporación descendente y, en empate, alfabéticamente.
 */
async function construirCatalogo({ platformId, contentType, dias }) {
  const platform = getPlatformById(platformId);
  if (!platform) return [];

  const brutos = await obtenerConCache(platform, contentType);

  const filtrados = brutos.filter((item) => dentroDelPeriodo(item.fechaIncorporacion, dias));

  // Orden cronológico estricto: fecha de incorporación desc, luego título asc.
  filtrados.sort((a, b) => {
    if (a.fechaIncorporacion !== b.fechaIncorporacion) {
      return b.fechaIncorporacion.localeCompare(a.fechaIncorporacion);
    }
    return a.titulo.localeCompare(b.titulo, 'es');
  });

  const metas = [];
  const vistos = new Set();

  for (const item of filtrados) {
    const imdbId = await resolverImdbId({
      titulo: item.titulo,
      tipo: contentType,
      jwSlugTitulo: item.jwSlugTitulo,
    });

    // Requisito explícito: eliminar resultados sin ID válido.
    if (!imdbId || !/^tt\d+$/.test(imdbId)) continue;
    if (vistos.has(imdbId)) continue; // Evitar duplicados (p.ej. franquicias listadas dos veces)
    vistos.add(imdbId);

    metas.push({
      id: imdbId,
      type: STREMIO_TIPO[contentType],
      name: item.titulo,
      // Póster real de JustWatch — sin esto, Stremio/Nuvio muestran
      // las carátulas en blanco (confirmado: era justo lo que faltaba).
      poster: item.posterUrl || undefined,
    });
  }

  return metas;
}

module.exports = { construirCatalogo };
