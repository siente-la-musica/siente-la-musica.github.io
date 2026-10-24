// Cloudflare Worker que reconoce canciones con AudD sin dejar la clave a la vista.
// La página envía unos segundos de audio; el Worker añade la clave y pregunta a AudD.
//
// Variables del Worker:
//   AUDD_TOKEN   (secreta)  la clave de https://dashboard.audd.io
//   ORIGEN       (opcional) la web que puede usarlo, p. ej. https://juanmanuelpinto2014-star.github.io

const MAX_BYTES = 2 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = !env.ORIGEN || origin === env.ORIGEN;
    const cors = {
      'Access-Control-Allow-Origin': allowed ? (origin || '*') : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!allowed) return json({ status: 'error', error: { error_message: 'Origen no permitido' } }, 403);
    if (request.method !== 'POST') return json({ status: 'error', error: { error_message: 'Usa POST' } }, 405);

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ status: 'error', error: { error_message: 'Falta el audio' } }, 400);
    if (file.size > MAX_BYTES) return json({ status: 'error', error: { error_message: 'Audio demasiado largo' } }, 413);

    const out = new FormData();
    out.append('api_token', env.AUDD_TOKEN);
    out.append('file', file, file.name || 'clip.webm');
    out.append('return', 'apple_music,spotify');

    const res = await fetch('https://api.audd.io/', { method: 'POST', body: out });
    return new Response(await res.text(), { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
