// Cloudflare Worker de respaldo para las letras sincronizadas.
// Si LRCLIB está caído o no tiene la canción, busca la letra con tiempos (formato LRC) en NetEase, que tiene
// millones de canciones de todo el mundo. La página no puede preguntarle directamente (el navegador lo
// bloquea), así que este Worker pregunta por ella y le devuelve la respuesta con permiso para leerla.
//
// Uso:  GET https://<tu-worker>.workers.dev/?artist=Harry%20Styles&title=Sign%20of%20the%20Times&duration=341
// Respuesta: { syncedLyrics, plainLyrics, source } o { none: true }
//
// Variables del Worker:
//   ORIGEN  (opcional) la web que puede usarlo, p. ej. https://siente-la-musica.github.io

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\(.*?\)|\[.*?\]/g, '').replace(/\s*-\s*(remaster|live|radio edit).*$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function timed(url, opts = {}, ms = 7000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(t); }
}

// 1) LRCLIB, por si ya volvió
async function fromLrclib(artist, title, duration) {
  try {
    const q = new URLSearchParams({ track_name: title, artist_name: artist });
    const r = await timed('https://lrclib.net/api/search?' + q, { headers: { 'User-Agent': 'siente-la-musica (https://siente-la-musica.github.io)' } });
    if (!r.ok) return null;
    const list = (await r.json()).filter(x => x.syncedLyrics);
    list.sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration));
    const best = list.find(x => !duration || Math.abs(x.duration - duration) <= 20);
    return best ? { syncedLyrics: best.syncedLyrics, plainLyrics: best.plainLyrics || '', source: 'lrclib' } : null;
  } catch (e) { return null; }
}

// 2) NetEase: se busca la canción y se pide su letra LRC
async function fromNetease(artist, title, duration) {
  const headers = { 'User-Agent': UA, Referer: 'https://music.163.com/', 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'appver=2.0.2; os=pc' };
  const body = new URLSearchParams({ s: `${title} ${artist}`, type: '1', limit: '15', offset: '0' });
  const r = await timed('https://music.163.com/api/search/get/web', { method: 'POST', headers, body });
  if (!r.ok) return null;
  const songs = ((await r.json()).result || {}).songs || [];
  const nt = norm(title), na = norm(artist);
  const scored = songs.map(s => {
    const st = norm(s.name), sa = (s.artists || []).map(a => norm(a.name)).join(' ');
    let score = 0;
    if (st === nt) score += 3; else if (st.startsWith(nt) || nt.startsWith(st)) score += 2;
    if (sa.includes(na) || na.includes(sa.split(' ')[0] || '~')) score += 2;
    if (duration && s.duration) { const d = Math.abs(s.duration / 1000 - duration); score += d <= 3 ? 2 : d <= 10 ? 1 : d > 30 ? -3 : 0; }
    return { s, score };
  }).filter(x => x.score >= 4).sort((a, b) => b.score - a.score);
  for (const { s } of scored.slice(0, 3)) {
    const l = await timed(`https://music.163.com/api/song/lyric?id=${s.id}&lv=1&kv=1&tv=-1`, { headers });
    if (!l.ok) continue;
    const j = await l.json();
    const lrc = j.lrc && j.lrc.lyric;
    // sin tiempos reales (o solo créditos) no sirve
    if (lrc && /\[\d+:\d+(\.\d+)?\]\s*\S/.test(lrc) && lrc.split('\n').filter(x => /\[\d+:\d+/.test(x)).length > 5) {
      const clean = lrc.split('\n').filter(x => !/^\[\d+:\d+(\.\d+)?\]\s*(作词|作曲|编曲|制作人|词|曲)\s*[:：]/.test(x)).join('\n');
      return { syncedLyrics: clean, plainLyrics: clean.replace(/\[[^\]]*\]/g, '').trim(), source: 'netease' };
    }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = !env.ORIGEN || origin === env.ORIGEN || !origin;
    const cors = { 'Access-Control-Allow-Origin': allowed ? (origin || '*') : 'null', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
    const json = (b, status = 200, extra = {}) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json', ...extra } });
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!allowed) return json({ error: 'origen no permitido' }, 403);
    const u = new URL(request.url), artist = u.searchParams.get('artist') || '', title = u.searchParams.get('title') || '';
    const duration = +u.searchParams.get('duration') || 0;
    if (!artist || !title) return json({ error: 'faltan artist y title' }, 400);
    // una respuesta encontrada se guarda un día en la caché de Cloudflare
    const cache = caches.default, key = new Request(u.toString(), { method: 'GET' });
    const hit = await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...cors, 'Content-Type': 'application/json' } });
    const found = (await fromLrclib(artist, title, duration)) || (await fromNetease(artist, title, duration).catch(() => null));
    const res = json(found || { none: true }, 200, found ? { 'Cache-Control': 'public, max-age=86400' } : {});
    if (found) await cache.put(key, res.clone());
    return res;
  },
};
