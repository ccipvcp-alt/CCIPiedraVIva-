// Lee el canal de YouTube de la iglesia: videos y transmisiones recientes, y si hay un en vivo ahora.
// Guarda el resultado en Firestore (youtube/estado) para que la sección "Contenido en línea" lo muestre.
import admin from 'firebase-admin';

const HANDLE = 'ccipiedravivaoficial';
const VIDEOS_SEMILLA = ['3Pz3o_m-n50'];
const CANAL_RESPALDO = 'UCtFUL3cDrQ1T5K5Q8wa-Zpg';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ent = t => String(t).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function leerRss(xml) {
  return xml.split('<entry>').slice(1).map(e => {
    const id = (e.match(/<yt:videoId>([^<]+)</) || [])[1];
    const t = (e.match(/<title>([^<]*)</) || [])[1];
    const p = (e.match(/<published>([^<]+)</) || [])[1];
    return id ? { id, t: ent(t || ''), p: p || '' } : null;
  }).filter(Boolean).slice(0, 12);
}
export function leerHtml(html) {
  const out = [], vistos = new Set(), todos = [...html.matchAll(/"(?:videoId|contentId)":"([\w-]{11})"/g)];
  for (let i = 0; i < todos.length && out.length < 12; i++) {
    const id = todos[i][1];
    if (vistos.has(id)) continue;
    vistos.add(id);
    let j = i + 1;
    while (j < todos.length && todos[j][1] === id) j++;
    const fin = j < todos.length ? todos[j].index : todos[i].index + 2500;
    const seg = html.slice(todos[i].index, Math.min(fin, todos[i].index + 4000));
    const f = seg.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/) || seg.match(/"title":\{"simpleText":"((?:[^"\\]|\\.)*)"/) || seg.match(/"title":\{"content":"((?:[^"\\]|\\.)*)"/);
    let t = f ? f[1] : '';
    try { t = JSON.parse('"' + t + '"'); } catch {}
    out.push({ id, t, p: '' });
  }
  return out;
}
const diag = h => `${h.length} caracteres · videoId ${(h.match(/"videoId":"/g) || []).length} · contentId ${(h.match(/"contentId":"/g) || []).length} · consentimiento ${/consent\.youtube|consent\.google/.test(h) ? 'SÍ' : 'no'}`;
export function leerLive(html) {
  const on = /"isLive":true|"isLiveNow":true/.test(html);
  const v = (html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/) || [])[1];
  return { on: on && !!v, id: on && v ? v : '' };
}

const get = async url => { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-VE,es;q=0.9', 'Cookie': 'CONSENT=YES+1' }, redirect: 'follow' }); return { status: r.status, body: await r.text() }; };

if (process.env.PREVIEW) {
  console.log(leerRss('<feed><entry><yt:videoId>abc12345678</yt:videoId><title>Culto &amp; Prédica</title><published>2026-11-01T15:00:00+00:00</published></entry></feed>'));
  console.log(leerHtml('x"videoRenderer":{"videoId":"abc12345678","thumbnail":{},"title":{"runs":[{"text":"Culto \\u0026 Prédica"}]}'));
  console.log(leerLive('<link rel="canonical" href="https://www.youtube.com/watch?v=abc12345678"><script>{"isLive":true}</script>'));
  process.exit(0);
}

// Canales posibles: el del @usuario, el dueño del video semilla (un video conocido del canal) y el de respaldo.
const candidatos = [];
const agrega = c => { if (c && !candidatos.includes(c)) candidatos.push(c); };
try {
  const r = await get(`https://www.youtube.com/@${HANDLE}`);
  const m = r.body.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/) || r.body.match(/channel\/(UC[\w-]{22})/);
  console.log('Página del @usuario: estado', r.status, '· canal', m ? m[1] : 'no encontrado');
  if (m) agrega(m[1]);
} catch (e) { console.log('No se pudo abrir la página del @usuario:', e.message); }
for (const v of VIDEOS_SEMILLA) {
  try {
    const r = await get(`https://www.youtube.com/watch?v=${v}`);
    const m = r.body.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/) || r.body.match(/channel\/(UC[\w-]{22})/);
    console.log('Video semilla', v, ': estado', r.status, '· canal', m ? m[1] : 'no encontrado');
    if (m) agrega(m[1]);
  } catch (e) { console.log('No se pudo abrir el video semilla:', e.message); }
}
agrega(CANAL_RESPALDO);

let canal = candidatos[0], videos = [];
for (const c of candidatos) {
  const fuentes = [
    ['RSS del canal', async () => leerRss((await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${c}`)).body)],
    ['RSS de subidos', async () => leerRss((await get(`https://www.youtube.com/feeds/videos.xml?playlist_id=UU${c.slice(2)}`)).body)],
    ['páginas del canal', async () => {
      const ha = (await get(`https://www.youtube.com/channel/${c}/videos`)).body, hb = (await get(`https://www.youtube.com/channel/${c}/streams`)).body;
      console.log('  /videos:', diag(ha), '\n  /streams:', diag(hb));
      const va = leerHtml(ha), vb = leerHtml(hb);
      const vistos = new Set();
      return [...va.slice(0, 8), ...vb.slice(0, 6), ...va.slice(8)].filter(v => !vistos.has(v.id) && vistos.add(v.id)).slice(0, 12);
    }],
  ];
  for (const [nombre, f] of fuentes) {
    try { videos = await f(); console.log(`Canal ${c} · ${nombre}: videos ${videos.length}`); } catch (e) { console.log(`Canal ${c} · ${nombre}: error`, e.message); }
    if (videos.length) break;
  }
  if (videos.length) { canal = c; break; }
}
if (videos.some(v => !v.t)) {
  await Promise.all(videos.filter(v => !v.t).map(async v => {
    try { v.t = JSON.parse((await get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + v.id)}&format=json`)).body).title || ''; } catch {}
  }));
}
if (!videos.length) {
  for (const v of VIDEOS_SEMILLA) {
    try {
      const r = await get(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + v)}&format=json`);
      const j = JSON.parse(r.body);
      videos.push({ id: v, t: j.title || '', p: '' });
      console.log('Video semilla recuperado por oEmbed:', v, '·', j.title);
    } catch (e) { console.log('oEmbed falló para', v, e.message); }
  }
}

let live = { on: false, id: '' };
try {
  const r = await get(`https://www.youtube.com/channel/${canal}/live`);
  live = leerLive(r.body);
  console.log('En vivo:', live.on ? 'SÍ (' + live.id + ')' : 'no');
} catch (e) { console.log('No se pudo comprobar el en vivo:', e.message); }

if (!videos.length && !live.on) { console.log('No se obtuvo nada de YouTube; no se guarda.'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
await admin.firestore().doc('youtube/estado').set({ canal, live: live.on, liveId: live.id, videos, actualizado: admin.firestore.FieldValue.serverTimestamp() });
console.log('YouTube guardado. Videos:', videos.length, '· En vivo:', live.on);
