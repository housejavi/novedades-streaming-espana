const { PLATFORMS, DAYS_OPTIONS } = require('./platforms');

function renderConfigurePage({ baseUrl, currentConfig }) {
  const checkboxesPlataformas = PLATFORMS.map((p) => {
    const checked = currentConfig.platforms.includes(p.id) ? 'checked' : '';
    return `
      <label class="platform">
        <input type="checkbox" name="platforms" value="${p.id}" ${checked} />
        ${p.emoji} ${p.name}
        ${p.confidence === 'probable' ? '<span class="badge">sin verificar</span>' : ''}
      </label>`;
  }).join('\n');

  const radiosDias = DAYS_OPTIONS.map((d) => {
    const checked = String(currentConfig.days) === String(d) ? 'checked' : '';
    return `
      <label class="dias">
        <input type="radio" name="days" value="${d}" ${checked} />
        Últimos ${d} días
      </label>`;
  }).join('\n');

  const contentMovies = currentConfig.content.includes('movies') ? 'checked' : '';
  const contentSeries = currentConfig.content.includes('series') ? 'checked' : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Configurar · Novedades Streaming España</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; background: #0f0f14; color: #eaeaea; }
  h1 { font-size: 1.4rem; }
  fieldset { border: 1px solid #333; border-radius: 8px; margin-bottom: 20px; padding: 12px 16px; }
  legend { padding: 0 8px; color: #aaa; }
  .platform, .dias { display: block; margin: 8px 0; cursor: pointer; }
  .badge { font-size: 0.7rem; color: #e0a000; border: 1px solid #e0a000; border-radius: 4px; padding: 1px 5px; margin-left: 6px; }
  button { background: #7c3aed; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-size: 1rem; cursor: pointer; width: 100%; }
  button:hover { background: #6d28d9; }
  #resultado { margin-top: 20px; word-break: break-all; }
  #resultado a { color: #a78bfa; }
  code { background: #1c1c24; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <h1>🆕 Novedades Streaming España</h1>
  <p>Elige qué plataformas quieres ver en tus catálogos de Stremio / Nuvio.</p>

  <form id="configForm">
    <fieldset>
      <legend>Plataformas</legend>
      ${checkboxesPlataformas}
    </fieldset>

    <fieldset>
      <legend>Contenido</legend>
      <label class="platform"><input type="checkbox" name="content" value="movies" ${contentMovies} /> Películas</label>
      <label class="platform"><input type="checkbox" name="content" value="series" ${contentSeries} /> Series</label>
    </fieldset>

    <fieldset>
      <legend>Periodo (histórico de "novedades")</legend>
      ${radiosDias}
    </fieldset>

    <button type="submit">Generar enlace de instalación</button>
  </form>

  <div id="resultado"></div>

  <script>
    const baseUrl = ${JSON.stringify(baseUrl)};
    const form = document.getElementById('configForm');
    const resultado = document.getElementById('resultado');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const config = {
        platforms: fd.getAll('platforms'),
        content: fd.getAll('content'),
        days: fd.get('days') || '14',
      };
      const json = JSON.stringify(config);
      const b64 = btoa(json).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
      const manifestUrl = baseUrl + '/' + b64 + '/manifest.json';
      const stremioUrl = manifestUrl.replace(/^https?:\\/\\//, 'stremio://');

      resultado.innerHTML =
        '<p><strong>Instalar en Stremio:</strong><br/><a href="' + stremioUrl + '">' + stremioUrl + '</a></p>' +
        '<p><strong>URL de manifest (para Nuvio, pégala en "Añadir addon"):</strong><br/><code>' + manifestUrl + '</code></p>';
    });
  </script>
</body>
</html>`;
}

module.exports = { renderConfigurePage };
