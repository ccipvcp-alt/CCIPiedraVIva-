// Lee el canal de YouTube de la iglesia: videos y transmisiones recientes, y si hay un en vivo ahora.
// Guarda el resultado en Firestore (youtube/estado) para que la sección "Contenido en línea" lo muestre.
import admin from 'firebase-admin';

const HANDLE = 'ccipiedravivaoficial';
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
  const out = [], vistos = new Set(), re = /"videoRenderer":\{"videoId":"([\w-]{11})"/g;
  let m;
  while ((m = re.exec(html)) && out.length < 12) {
    if (vistos.has(m[1])) continue;
    vistos.add(m[1]);
    const seg = html.slice(m.index, m.index + 3000);
    let t = (seg.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/) || [])[1] || '';
    try { t = JSON.parse('"' + t + '"'); } catch {}
    out.push({ id: m[1], t, p: '' });
  }
  return out;
}
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

let canal = CANAL_RESPALDO;
try {
  const r = await get(`https://www.youtube.com/@${HANDLE}`);
  const m = r.body.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/) || r.body.match(/channel\/(UC[\w-]{22})/);
  console.log('Página del canal: estado', r.status, '· canal', m ? m[1] : 'no encontrado (se usa el de respaldo)');
  if (m) canal = m[1];
} catch (e) { console.log('No se pudo abrir la página del canal:', e.message); }

let videos = [];
try {
  const r = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${canal}`);
  videos = leerRss(r.body);
  console.log('Lista de videos (RSS del canal): estado', r.status, '· videos', videos.length);
} catch (e) { console.log('No se pudo leer la lista de videos:', e.message); }
if (!videos.length) {
  try {
    const r = await get(`https://www.youtube.com/feeds/videos.xml?playlist_id=UU${canal.slice(2)}`);
    videos = leerRss(r.body);
    console.log('Lista de videos (RSS de la lista de subidos): estado', r.status, '· videos', videos.length);
  } catch (e) { console.log('Falló el RSS de la lista:', e.message); }
}
if (!videos.length) {
  try {
    const a = await get(`https://www.youtube.com/channel/${canal}/videos`);
    const b = await get(`https://www.youtube.com/channel/${canal}/streams`);
    const va = leerHtml(a.body), vb = leerHtml(b.body);
    const vistos = new Set();
    videos = [...va.slice(0, 8), ...vb.slice(0, 6), ...va.slice(8)].filter(v => !vistos.has(v.id) && vistos.add(v.id)).slice(0, 12);
    console.log('Lista de videos (páginas del canal): videos', va.length, '· transmisiones', vb.length, '· estados', a.status, b.status);
  } catch (e) { console.log('Falló la lectura de las páginas del canal:', e.message); }
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
