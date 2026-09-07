const { getPlatformById } = require('./platforms');
const { obtenerNuevosDePlataforma, obtenerPaginaCatalogoCompleto } = require('./scraper');
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

  // Resolución de IDs en paralelo (por lotes, para no saturar TMDB de
  // golpe) — antes se hacía uno a uno en fila, y con 30-40 títulos por
  // plataforma eso eran igual de peticiones secuenciales: la causa
  // real de la lentitud al abrir el addon.
  const LOTE = 8;
  const metas = [];
  const vistos = new Set();

  for (let i = 0; i < filtrados.length; i += LOTE) {
    const lote = filtrados.slice(i, i + LOTE);
    const resueltos = await Promise.all(
      lote.map((item) =>
        resolverImdbId({ titulo: item.titulo, tipo: contentType, jwSlugTitulo: item.jwSlugTitulo })
          .then((imdbId) => ({ item, imdbId }))
          .catch(() => ({ item, imdbId: null }))
      )
    );

    for (const { item, imdbId } of resueltos) {
      if (!imdbId || !/^tt\d+$/.test(imdbId)) continue;
      if (vistos.has(imdbId)) continue;
      vistos.add(imdbId);
      metas.push({
        id: imdbId,
        type: STREMIO_TIPO[contentType],
        name: item.titulo,
        poster: item.posterUrl || undefined,
      });
    }
  }

  return metas;
}

module.exports = { construirCatalogo, construirCatalogoCompleto };

// Cuántos títulos asumimos que trae cada página del catálogo completo
// de JustWatch. No lo sabemos con precisión exacta (no viene indicado
// en el HTML), así que usamos un valor conservador; el mapeo
// skip->página es aproximado pero funcional para "cargar más".
const ITEMS_POR_PAGINA_ASUMIDOS = 24;

/**
 * Construye una "página" del catálogo COMPLETO de una plataforma
 * (no "novedades" — esto es el catálogo entero, ordenado por
 * popularidad, sin fecha de incorporación porque JustWatch no la da
 * para el histórico). `skip` viene del protocolo estándar de Stremio
 * para paginar catálogos largos.
 */
async function construirCatalogoCompleto({ platformId, contentType, skip }) {
  const platform = getPlatformById(platformId);
  if (!platform) return [];

  const pagina = Math.floor((skip || 0) / ITEMS_POR_PAGINA_ASUMIDOS) + 1;
  const cacheKey = `full:${platform.slug}:${contentType}:${pagina}`;

  let brutos = getCached(cacheKey);
  if (!brutos) {
    try {
      brutos = await obtenerPaginaCatalogoCompleto(platform.slug, contentType, pagina);
      setCached(cacheKey, brutos);
    } catch (err) {
      console.error(`[catalogHandler] Fallo catálogo completo ${platform.name} pág.${pagina}:`, err.message);
      return [];
    }
  }

  const LOTE = 8;
  const metas = [];
  const vistos = new Set();

  for (let i = 0; i < brutos.length; i += LOTE) {
    const lote = brutos.slice(i, i + LOTE);
    const resueltos = await Promise.all(
      lote.map((item) =>
        resolverImdbId({ titulo: item.titulo, tipo: contentType, jwSlugTitulo: item.jwSlugTitulo })
          .then((imdbId) => ({ item, imdbId }))
          .catch(() => ({ item, imdbId: null }))
      )
    );
    for (const { item, imdbId } of resueltos) {
      if (!imdbId || !/^tt\d+$/.test(imdbId)) continue;
      if (vistos.has(imdbId)) continue;
      vistos.add(imdbId);
      metas.push({
        id: imdbId,
        type: contentType === 'series' ? 'series' : 'movie',
        name: item.titulo,
        poster: item.posterUrl || undefined,
      });
    }
  }
  return metas;
}
