// Cloudflare Worker de respaldo para las letras sincronizadas.
// Si LRCLIB está caído o no tiene la canción, busca la letra con tiempos (formato LRC) en NetEase, Kugou y
// QQ Music, que tienen millones de canciones de todo el mundo. La página no puede preguntarle directamente (el navegador lo
// bloquea), así que este Worker pregunta por ella y le devuelve la respuesta con permiso para leerla.
//
// Uso:  GET https://<tu-worker>.workers.dev/?artist=Harry%20Styles&title=Sign%20of%20the%20Times&duration=341
// Respuesta: { syncedLyrics, plainLyrics, source } o { none: true }
//
// Y con IA:  POST https://<tu-worker>.workers.dev/alinear   (cuerpo: unos segundos de audio de la canción)
// Whisper (Workers AI de Cloudflare) escucha la voz y devuelve cada palabra con su segundo exacto:
// Respuesta: { text, words: [{ word, start, end }] }
//
// Vínculos y variables del Worker:
//   AI      (vínculo de Workers AI) para /alinear
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

// Puntuación común: el mismo título, el mismo artista y una duración parecida
// en vivo, remix, acústica, karaoke… solo si se pidió esa versión
const VERSION = /\b(live|en vivo|ao vivo|remix|acoustic|ac[uú]stic[oa]|karaoke|instrumental|cover|sped up|slowed|nightcore|8d|version|ver\.)\b|伴奏|现场|翻唱|纯音乐/i;
function score(nt, na, st, sa, duration, sdur, want = '') {
  const raw = st || '';
  st = norm(st); sa = norm(sa);
  let sc = 0;
  if (VERSION.test(raw) && !VERSION.test(want)) sc -= 3;
  if (st === nt) sc += 3; else if (st && (st.startsWith(nt) || nt.startsWith(st))) sc += 2;
  if (sa && (sa.includes(na) || na.includes(sa.split(' ')[0] || '~'))) sc += 2;
  if (duration && sdur) { const d = Math.abs(sdur - duration); sc += d <= 3 ? 2 : d <= 10 ? 1 : d > 30 ? -3 : 0; }
  return sc;
}
// Una letra LRC sirve si tiene tiempos reales en varias líneas (no solo créditos)
function goodLrc(lrc, source, title = '') {
  if (!lrc) return null;
  lrc = lrc.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\r/g, '');
  // [offset:+500] significa «todo 0,5 s antes»: se aplica a cada tiempo
  const off = +((lrc.match(/^\[offset:\s*([+-]?\d+)\s*\]/im) || [])[1] || 0);
  if (off) lrc = lrc.replace(/\[(\d+):(\d+(?:\.\d+)?)\]/g, (_, m, sec) => { const t = Math.max(0, (+m * 60 + +sec) * 1000 - off) / 1000; return `[${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}]`; });
  const timed_ = lrc.split('\n').filter(x => /^\[\d+:\d+(\.\d+)?\]\s*\S/.test(x));
  if (timed_.length <= 5) return null;
  // la primera línea a veces es solo «Título - Artista»: se quita
  const nt = norm(title);
  lrc = lrc.split('\n').filter((x, i) => { const m = x.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/); return !(m && +m[1] === 0 && +m[2] < 1 && / - /.test(m[3]) && nt && norm(m[3]).startsWith(nt)); }).join('\n');
  const clean = lrc.split('\n').filter(x => !/^\[\d+:\d+(\.\d+)?\]\s*(作词|作曲|编曲|制作人|词|曲|Lyrics by|Composed by|Written by)\s*[:：]/i.test(x) && !/^\[(ti|ar|al|by|offset|id|hash|sign|qq|total|language):/i.test(x)).join('\n');
  return { syncedLyrics: clean, plainLyrics: clean.replace(/\[[^\]]*\]/g, '').trim(), source };
}

// 2) NetEase: se busca la canción y se pide su letra LRC
async function fromNetease(artist, title, duration, log) {
  const headers = { 'User-Agent': UA, Referer: 'https://music.163.com/', 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'appver=2.0.2; os=pc' };
  const body = new URLSearchParams({ s: `${title} ${artist}`, type: '1', limit: '15', offset: '0' });
  const r = await timed('https://music.163.com/api/search/get/web', { method: 'POST', headers, body });
  log.netease = 'búsqueda ' + r.status;
  if (!r.ok) return null;
  const songs = ((await r.json()).result || {}).songs || [];
  const nt = norm(title), na = norm(artist);
  const best = songs.map(s => ({ s, sc: score(nt, na, s.name, (s.artists || []).map(a => a.name).join(' '), duration, s.duration / 1000, title) }))
    .filter(x => x.sc >= 4).sort((a, b) => b.sc - a.sc);
  log.netease += `, ${songs.length} canciones, ${best.length} parecidas`;
  for (const { s } of best.slice(0, 3)) {
    const l = await timed(`https://music.163.com/api/song/lyric?id=${s.id}&lv=1&kv=1&tv=-1`, { headers });
    if (!l.ok) continue;
    const ok = goodLrc(((await l.json()).lrc || {}).lyric, 'netease', title); if (ok) return ok;
  }
  return null;
}

// 3) Kugou: tiene su propio buscador de letras con tiempos
async function fromKugou(artist, title, duration, log) {
  const headers = { 'User-Agent': UA };
  const q = new URLSearchParams({ ver: '1', man: 'yes', client: 'pc', keyword: `${artist} - ${title}`, duration: String(Math.round(duration * 1000) || ''), hash: '' });
  const r = await timed('https://lyrics.kugou.com/search?' + q, { headers });
  log.kugou = 'búsqueda ' + r.status;
  if (!r.ok) return null;
  const cands = (await r.json()).candidates || [];
  const nt = norm(title), na = norm(artist);
  const best = cands.map(c => ({ c, sc: score(nt, na, c.song, c.singer, duration, (c.duration || 0) / 1000, title) })).filter(x => x.sc >= 4).sort((a, b) => b.sc - a.sc);
  log.kugou += `, ${cands.length} letras, ${best.length} parecidas`;
  // se bajan las mejores y se elige la que de verdad es de esta versión: sin «live» en la cabecera,
  // y que su última línea no pase del final de la canción (si pasa, es de una versión más larga)
  const tries = await Promise.all(best.slice(0, 5).map(async ({ c, sc }) => {
    try {
      const d = await timed(`https://lyrics.kugou.com/download?ver=1&client=pc&id=${c.id}&accesskey=${c.accesskey}&fmt=lrc&charset=utf8`, { headers });
      if (!d.ok) return null;
      const j = await d.json(); if (!j.content) return null;
      const raw = new TextDecoder('utf-8').decode(Uint8Array.from(atob(j.content), ch => ch.charCodeAt(0)));
      const head = (raw.match(/^\[0?0:0\d(?:\.\d+)?\]([^\n]*)/m) || [])[1] || '';
      const ok = goodLrc(raw, 'kugou', title); if (!ok) return null;
      const times = [...ok.syncedLyrics.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)].map(m => +m[1] * 60 + +m[2]), last = Math.max(...times);
      let q = sc;
      if (VERSION.test(head + ' ' + c.song) && !VERSION.test(title)) q -= 5;
      if (duration && last > duration + 3) q -= 5;
      if (duration && c.duration) q -= Math.abs(c.duration / 1000 - duration) / 10;
      return { ok, q, info: `${c.song} · ${Math.round((c.duration || 0) / 1000)}s · última línea ${Math.round(last)}s · ${head.slice(0, 60)} → ${q.toFixed(1)}` };
    } catch (e) { return null; }
  }));
  const good = tries.filter(Boolean).sort((a, b) => b.q - a.q);
  log.kugouOpciones = good.map(x => x.info);
  return good.length && good[0].q >= 3 ? good[0].ok : null;
}

// 4) QQ Music
async function fromQQ(artist, title, duration, log) {
  const headers = { 'User-Agent': UA, Referer: 'https://y.qq.com/' };
  const q = new URLSearchParams({ w: `${title} ${artist}`, format: 'json', p: '1', n: '10', cr: '1' });
  const r = await timed('https://c.y.qq.com/soso/fcgi-bin/client_search_cp?' + q, { headers });
  log.qq = 'búsqueda ' + r.status;
  if (!r.ok) return null;
  const t = (await r.text()).replace(/^[^{]*/, '').replace(/\)\s*;?\s*$/, '');
  const list = ((JSON.parse(t).data || {}).song || {}).list || [];
  const nt = norm(title), na = norm(artist);
  const best = list.map(s => ({ s, sc: score(nt, na, s.songname, (s.singer || []).map(a => a.name).join(' '), duration, s.interval, title) })).filter(x => x.sc >= 4).sort((a, b) => b.sc - a.sc);
  log.qq += `, ${list.length} canciones, ${best.length} parecidas`;
  for (const { s } of best.slice(0, 3)) {
    const l = await timed(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${s.songmid}&format=json&nobase64=1&g_tk=5381`, { headers });
    if (!l.ok) continue;
    const lt = (await l.text()).replace(/^[^{]*/, '').replace(/\)\s*;?\s*$/, '');
    const ok = goodLrc(JSON.parse(lt).lyric, 'qq', title); if (ok) return ok;
  }
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = !env.ORIGEN || origin === env.ORIGEN || !origin;
    const cors = { 'Access-Control-Allow-Origin': allowed ? (origin || '*') : 'null', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    const json = (b, status = 200, extra = {}) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json', ...extra } });
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!allowed) return json({ error: 'origen no permitido' }, 403);
    const u = new URL(request.url);
    if (u.pathname.replace(/\/$/, '') === '/alinear') {
      if (request.method !== 'POST') return json({ error: 'usa POST con el audio' }, 405);
      if (!env.AI) return json({ error: 'falta el vínculo de Workers AI (nombre: AI)' }, 500);
      const buf = new Uint8Array(await request.arrayBuffer());
      if (!buf.length || buf.length > 8 * 1024 * 1024) return json({ error: 'audio vacío o demasiado grande' }, 400);
      // el modelo grande (large-v3-turbo) entiende mucho mejor el canto con música; la letra va como pista
      const prompt = (u.searchParams.get('prompt') || '').slice(0, 800);
      let b64 = ''; for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      b64 = btoa(b64);
      try {
        const out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: b64, vad_filter: true, ...(prompt ? { initial_prompt: prompt } : {}) });
        // se descartan los tramos donde la IA misma cree que no hay voz
        const segs = (out.segments || []).filter(s => !(s.no_speech_prob > 0.75));
        const words = segs.flatMap(s => (s.words || []).map(w => ({ word: w.word, start: w.start, end: w.end })));
        return json({ text: segs.map(s => s.text).join(' ').trim(), words, model: 'large-v3-turbo' });
      } catch (e) {
        try {   // si el grande falla, el pequeño de siempre
          const out = await env.AI.run('@cf/openai/whisper', { audio: [...buf] });
          return json({ text: out.text || '', words: (out.words || []).map(w => ({ word: w.word, start: w.start, end: w.end })), model: 'whisper' });
        } catch (e2) { return json({ error: 'la IA no pudo escuchar el audio: ' + (e2.message || e2) }, 502); }
      }
    }
    const artist = u.searchParams.get('artist') || '', title = u.searchParams.get('title') || '';
    const duration = +u.searchParams.get('duration') || 0;
    if (!artist || !title) return json({ error: 'faltan artist y title' }, 400);
    // una respuesta encontrada se guarda un día en la caché de Cloudflare
    const cache = caches.default, key = new Request(u.toString(), { method: 'GET' });
    const hit = await cache.match(key); if (hit) return new Response(hit.body, { headers: { ...cors, 'Content-Type': 'application/json' } });
    // se prueba cada fuente por turno; con ?debug=1 se ve qué respondió cada una
    const log = {}, debug = u.searchParams.has('debug');
    let found = await fromLrclib(artist, title, duration); log.lrclib = found ? 'sí' : 'no';
    for (const src of [fromNetease, fromKugou, fromQQ]) {
      if (found) break;
      try { found = await src(artist, title, duration, log); } catch (e) { log[src.name] = 'error: ' + (e.message || e); }
    }
    if (debug) return json({ found: found ? found.source : null, log, preview: found ? found.syncedLyrics.slice(0, 300) : '' });
    const res = json(found || { none: true }, 200, found ? { 'Cache-Control': 'public, max-age=86400' } : {});
    if (found) await cache.put(key, res.clone());
    return res;
  },
};
