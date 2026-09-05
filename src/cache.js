const fs = require('fs');
const path = require('path');

// --- Cache de resultados "nuevo" por plataforma (caduca) -----------------

const TTL_MS = (parseInt(process.env.CACHE_TTL_MINUTES, 10) || 45) * 60 * 1000;

const memoryCache = new Map(); // key -> { value, expiresAt }

function getCached(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  memoryCache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

// --- Cache persistente de resolución de IDs (no caduca) -------------------
// slug de JustWatch -> { imdbId, resolvedAt }
// Esto es lo caro de recalcular (una búsqueda TMDB por título), así que
// se guarda en disco y se reutiliza indefinidamente.

const ID_CACHE_PATH = path.join(__dirname, '..', 'data', 'id-cache.json');

function loadIdCache() {
  try {
    const raw = fs.readFileSync(ID_CACHE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

let idCache = loadIdCache();
let dirty = false;
let saveScheduled = false;

function getResolvedId(jwSlugTitulo) {
  return idCache[jwSlugTitulo] || null;
}

function setResolvedId(jwSlugTitulo, imdbId) {
  idCache[jwSlugTitulo] = { imdbId, resolvedAt: new Date().toISOString() };
  dirty = true;
  scheduleSave();
}

function scheduleSave() {
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(() => {
    saveScheduled = false;
    if (!dirty) return;
    dirty = false;
    try {
      fs.mkdirSync(path.dirname(ID_CACHE_PATH), { recursive: true });
      fs.writeFileSync(ID_CACHE_PATH, JSON.stringify(idCache, null, 2));
    } catch (err) {
      console.error('[cache] No se pudo guardar id-cache.json:', err.message);
    }
  }, 2000);
}

module.exports = { getCached, setCached, getResolvedId, setResolvedId };
