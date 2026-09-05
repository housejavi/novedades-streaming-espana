const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9',
};

const REQUEST_TIMEOUT_MS = 15000;

// Meses en español, para poder parsear fechas tipo "2 de septiembre de 2026".
const MESES_ES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

const MESES_EN = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

/**
 * Convierte una etiqueta de fecha tal y como la muestra JustWatch en un
 * objeto Date. Soporta varios formatos porque hemos comprobado en
 * datos reales que /es/ mezcla "Hoy"/"Ayer" con fechas absolutas en
 * INGLÉS ("September 4, 2026", "Aug 28, 2026") pese a ser la versión
 * en español de la web.
 *
 * IMPORTANTE: a propósito NO hay un último recurso tipo
 * `new Date(texto)` para "lo que no encaje en nada de lo anterior".
 * Se probó y fue la causa de un bug real: textos cortos que no eran
 * fechas (duraciones, etiquetas de temporada, etc.) se colaban como
 * fechas de 2000/2001 porque el parser nativo de JS es demasiado
 * permisivo. Mejor no reconocer una fecha real ocasional que aceptar
 * basura con confianza.
 */
function parseFechaJustWatch(texto, ahora = new Date()) {
  const t = texto.trim().toLowerCase();

  if (t === 'hoy') {
    return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  }
  if (t === 'ayer') {
    const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    d.setDate(d.getDate() - 1);
    return d;
  }

  // "2 de septiembre de 2026"
  let m = t.match(/^(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})$/i);
  if (m) {
    const dia = parseInt(m[1], 10);
    const mes = MESES_ES[m[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
    const anio = parseInt(m[3], 10);
    if (mes !== undefined) return new Date(anio, mes, dia);
    return null;
  }

  // "September 4, 2026" / "Aug 28, 2026" (confirmado en datos reales
  // de /es/ — JustWatch usa nombres de mes en inglés incluso aquí).
  m = t.match(/^([a-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})$/i);
  if (m) {
    const mes = MESES_EN[m[1].toLowerCase()];
    const dia = parseInt(m[2], 10);
    const anio = parseInt(m[3], 10);
    if (mes !== undefined) return new Date(anio, mes, dia);
    return null;
  }

  return null; // No coincide con ningún formato conocido: se descarta, no se adivina.
}

/**
 * Descarga el HTML de una página "nuevo" de JustWatch para un
 * proveedor y tipo de contenido concretos.
 *
 * @param {string} slug - slug de JustWatch, ej. "netflix"
 * @param {"peliculas"|"series"} tipo
 */
async function descargarPaginaNuevo(slug, tipo) {
  const url = `https://www.justwatch.com/es/proveedor/${slug}/nuevo/${tipo}`;
  const res = await axios.get(url, { headers: HEADERS, timeout: REQUEST_TIMEOUT_MS });
  return res.data;
}

/**
 * ====================================================================
 * ESTADO: VERIFICADO CONTRA DATOS REALES (no ya una suposición)
 * ====================================================================
 * Probado en vivo por el usuario, contra la web real de JustWatch:
 *  - Netflix España -> Películas nuevas: 40 títulos, orden cronológico
 *    descendente correcto.
 *  - HBO Max España -> Series nuevas: 21 resultados, orden correcto,
 *    SIN el fallo de "serie antigua arriba" que tenía OmniCatalogs.
 *  - Resolución IMDb ID vía TMDB: 4/5 encontrados en la primera prueba
 *    real (el fallo restante es el límite conocido de buscar por
 *    nombre sin año de referencia — títulos genéricos pueden fallar).
 *
 * Estructura real confirmada: cada título es un
 * <a href="/es/pelicula/<slug>"> o <a href="/es/serie/<slug>/temporada-N">
 * que envuelve una <img alt="Título">. Las fechas por bloque aparecen
 * como texto suelto en inglés ("September 4, 2026", "Aug 28, 2026")
 * o como "Hoy"/"Ayer", intercaladas entre los bloques de títulos en
 * el orden del documento.
 * ====================================================================
 */
function parsearPaginaNuevo(html, { slug, tipo }) {
  const $ = cheerio.load(html);
  const resultados = [];
  let fechaActual = null;

  // Recorremos todos los nodos relevantes en orden de documento:
  // cabeceras/textos cortos (candidatos a fecha) e imágenes con alt
  // (candidatos a título). Cheerio conserva el orden del DOM al usar
  // un selector combinado, así que esto reconstruye correctamente
  // "qué título pertenece a qué bloque de fecha".
  // Un único recorrido en orden de documento: por cada nodo decidimos
  // si es "candidato a fecha" (texto corto que parsea como fecha) o
  // "enlace a título" (a[href] a /pelicula/ o /serie/ con imagen con
  // alt). Evitamos el enfoque de dos pasadas con cursores separados
  // porque un desajuste entre pasadas (p.ej. un enlace sin img/alt)
  // podría emparejar mal fecha↔título sin que se note.
  $('*').each((_, el) => {
    const $el = $(el);
    const tag = el.tagName;

    if (tag === 'a') {
      const href = $el.attr('href') || '';
      if (!/\/(pelicula|serie)\//.test(href)) return;
      if (!fechaActual) return; // Enlace visto antes de cualquier fecha reconocida: se descarta.

      const alt = ($el.find('img[alt]').first().attr('alt') || '').trim();
      if (!alt) return;

      // La URL del póster viene directamente en el src de la imagen
      // (confirmado en datos reales: https://images.justwatch.com/poster/...).
      const posterUrl = $el.find('img[alt]').first().attr('src') || null;

      const tipoDetectado = href.includes('/serie/') ? 'series' : 'movie';
      // Usamos la URL completa como identificador de caché, no solo el
      // último tramo — en series, ese último tramo es a menudo algo
      // genérico como "temporada-1", que colisiona entre shows
      // distintos (confirmado con datos reales: "Dogu" y "El
      // Presidente Curtis" generaban el mismo jwSlugTitulo).
      const jwSlugTitulo = href.replace(/^\/es\//, '').replace(/\//g, '_');

      resultados.push({
        titulo: alt,
        jwSlugTitulo,
        jwHref: href,
        posterUrl,
        tipo: tipoDetectado,
        fechaIncorporacion: fechaActual.toISOString().slice(0, 10),
        plataformaSlug: slug,
      });
      return;
    }

    // Candidato a cabecera de fecha: texto propio corto (sin contar
    // el de los hijos, para no capturar párrafos largos que
    // contengan una fecha de refilón).
    const textoPropio = $el.clone().children().remove().end().text().trim();
    if (!textoPropio || textoPropio.length > 40) return;

    const fecha = parseFechaJustWatch(textoPropio);
    if (fecha) fechaActual = fecha;
  });

  return resultados;
}

/**
 * Obtiene y parsea los títulos nuevos de una plataforma, para películas
 * o series. Lanza si la descarga falla (el llamante decide cómo
 * degradar: cache antigua, plataforma omitida, etc.)
 */
async function obtenerNuevosDePlataforma(slug, tipo) {
  const html = await descargarPaginaNuevo(slug, tipo);
  return parsearPaginaNuevo(html, { slug, tipo });
}

module.exports = {
  parseFechaJustWatch,
  parsearPaginaNuevo,
  descargarPaginaNuevo,
  obtenerNuevosDePlataforma,
};
