const axios = require('axios');
const { getResolvedId, setResolvedId } = require('./cache');

const TMDB_TOKEN = process.env.TMDB_API_KEY; // Admite v3 (clave corta) o v4 (token largo tipo JWT)
const TMDB_BASE = 'https://api.themoviedb.org/3';

// El token v4 de TMDB es un JWT: tres tramos separados por puntos.
// La clave v3 es un string corto sin puntos. Detectamos cuál nos
// pasaron para usar el método de autenticación correcto.
const esTokenV4 = TMDB_TOKEN && TMDB_TOKEN.split('.').length === 3;

function clienteTmdb() {
  if (esTokenV4) {
    return axios.create({
      baseURL: TMDB_BASE,
      headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
      timeout: 10000,
    });
  }
  // v3: la clave va como query param, no como header.
  return axios.create({ baseURL: TMDB_BASE, timeout: 10000 });
}

function paramsV3Extra() {
  return esTokenV4 ? {} : { api_key: TMDB_TOKEN };
}

/**
 * ====================================================================
 * NOTA DE FIABILIDAD [Probable, no Seguro]
 * ====================================================================
 * JustWatch no da el IMDb ID en las páginas /nuevo. La alternativa
 * más práctica es buscar el título por nombre en TMDB y pedir su
 * imdb_id. Esto puede fallar o dar falsos positivos cuando:
 *   - hay varios títulos con el mismo nombre (remakes, títulos
 *     genéricos como "Home" o "Alone")
 *   - el título en JustWatch España está traducido de forma distinta
 *     al título con el que TMDB lo indexa
 * Sin año de referencia (que JustWatch tampoco da en esta vista) no
 * hay forma de desambiguar con certeza. Si esto resulta ser un
 * problema real en pruebas, la solución más robusta sería visitar la
 * ficha de detalle de JustWatch para el título (si esa página expone
 * imdb_id en su Apollo state) en vez de depender de TMDB — pendiente
 * de investigar si compensa el coste de una petición extra por título.
 * ====================================================================
 */
// Las series en las páginas /nuevo de JustWatch aparecen como
// "Nombre del Programa - Temporada N" (confirmado con datos reales:
// "Siguiendo a Conan O'Brien - Temporada 3"). TMDB indexa por el
// nombre del programa, no por ese sufijo, así que lo quitamos antes
// de buscar.
function limpiarTituloParaBusqueda(titulo, tipo) {
  if (tipo !== 'series') return titulo;
  return titulo.replace(/\s*-\s*Temporada\s+\d+\s*$/i, '').trim();
}

async function resolverImdbId({ titulo, tipo, jwSlugTitulo }) {
  const cacheado = getResolvedId(jwSlugTitulo);
  if (cacheado) return cacheado.imdbId;

  if (!TMDB_TOKEN) {
    console.warn('[idResolver] TMDB_API_KEY no configurada — no se pueden resolver IDs.');
    return null;
  }

  const tmdbTipo = tipo === 'series' ? 'tv' : 'movie';
  const tmdb = clienteTmdb();
  const tituloBusqueda = limpiarTituloParaBusqueda(titulo, tipo);

  try {
    const busqueda = await tmdb.get(`/search/${tmdbTipo}`, {
      params: { query: tituloBusqueda, language: 'es-ES', ...paramsV3Extra() },
    });

    const primero = busqueda.data.results && busqueda.data.results[0];
    if (!primero) {
      setResolvedId(jwSlugTitulo, null); // Cacheamos también los "no encontrado" para no repetir la búsqueda
      return null;
    }

    const externos = await tmdb.get(`/${tmdbTipo}/${primero.id}/external_ids`, {
      params: { ...paramsV3Extra() },
    });

    const imdbId = externos.data.imdb_id || null;
    setResolvedId(jwSlugTitulo, imdbId);
    return imdbId;
  } catch (err) {
    console.error(`[idResolver] Error resolviendo "${titulo}":`, err.message);
    return null; // No cacheamos errores de red — pueden ser transitorios.
  }
}

module.exports = { resolverImdbId };
