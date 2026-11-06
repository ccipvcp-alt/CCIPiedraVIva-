// Lee el canal de YouTube de la iglesia: videos y transmisiones recientes, y si hay un en vivo ahora.
// Guarda el resultado en Firestore (youtube/estado) para que la sección "Contenido en línea" lo muestre.
import admin from 'firebase-admin';

const HANDLE = 'ccipiedravivaoficial';
const CANAL_RESPALDO = 'UCtFUL3cDrQlT5K5Q8wa-Zpg';
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
export function leerLive(html) {
  const on = /"isLive":true|"isLiveNow":true/.test(html);
  const v = (html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/) || [])[1];
  return { on: on && !!v, id: on && v ? v : '' };
}

const get = async url => { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-VE,es;q=0.9', 'Cookie': 'CONSENT=YES+1' }, redirect: 'follow' }); return { status: r.status, body: await r.text() }; };

if (process.env.PREVIEW) {
  console.log(leerRss('<feed><entry><yt:videoId>abc12345678</yt:videoId><title>Culto &amp; Prédica</title><published>2026-11-01T15:00:00+00:00</published></entry></feed>'));
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
  console.log('Lista de videos: estado', r.status, '· videos', videos.length);
} catch (e) { console.log('No se pudo leer la lista de videos:', e.message); }

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
