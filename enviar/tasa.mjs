// Lee la tasa oficial del dólar (BCV) y la guarda en Firestore (eventos_config/tasa_bcv)
// para que la página la use. Fuente 1: la página del BCV. Fuente 2 (respaldo): DolarApi, que publica la tasa oficial del BCV.
import admin from 'firebase-admin';
import https from 'node:https';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const num = t => parseFloat(String(t).replace(/\./g, '').replace(',', '.'));
const fmt = iso => { const m = String(iso || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

export function leerTasa(html) {
  let m = html.match(/id=["']dolar["'][\s\S]*?<strong>\s*([\d.,]+)\s*<\/strong>/i)
       || html.match(/USD\s*<\/span>[\s\S]{0,200}?<strong>\s*([\d.,]+)\s*<\/strong>/i);
  if (!m) return null;
  const valor = num(m[1]);
  if (!(valor > 0)) return null;
  const f = html.match(/Fecha Valor:[\s\S]*?content=["'](\d{4}-\d{2}-\d{2})/i);
  return { valor, fecha: f ? fmt(f[1]) : '', fuente: 'BCV' };
}

// Descarga con redirecciones; el certificado del BCV suele fallar y solo se lee un dato público.
const bajar = (url, n = 0) => new Promise((ok, mal) => {
  const r = https.get(url, { rejectUnauthorized: false, timeout: 25000, headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'es-VE,es;q=0.9', 'Accept-Encoding': 'identity' } }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && n < 5) { res.resume(); return ok(bajar(new URL(res.headers.location, url).href, n + 1)); }
    let t = ''; res.setEncoding('utf8'); res.on('data', c => t += c); res.on('end', () => ok({ status: res.statusCode, body: t }));
  });
  r.on('error', mal); r.on('timeout', () => r.destroy(new Error('tiempo agotado')));
});

if (process.env.PREVIEW) {
  console.log(leerTasa('<div id="dolar" class="x"><div class="row"><div><span> USD </span></div><div class="centrado"><strong> 39,18130000</strong></div></div></div><span>Fecha Valor:</span><span class="date-display-single" content="2024-10-22T00:00:00-04:00">'));
  process.exit(0);
}

let t = null;
try {
  const r = await bajar('https://www.bcv.org.ve/');
  console.log('BCV respondió: estado', r.status, '· tamaño', r.body.length);
  t = leerTasa(r.body);
  if (!t) { const i = r.body.indexOf('USD'); console.log('No se encontró la tasa. Inicio de la página:', JSON.stringify(r.body.slice(0, 200)), '· cerca de USD:', i >= 0 ? JSON.stringify(r.body.slice(Math.max(0, i - 150), i + 250)) : 'no aparece "USD"'); }
} catch (e) { console.log('Error al leer la página del BCV:', e.message); }

if (!t) {
  try {
    const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { headers: { 'User-Agent': UA } });
    const j = await r.json();
    const v = +(j.promedio || j.venta || j.compra);
    if (v > 0) t = { valor: v, fecha: fmt(j.fechaActualizacion), fuente: 'BCV vía DolarApi' };
    console.log('Respaldo DolarApi:', r.status, JSON.stringify(j).slice(0, 200));
  } catch (e) { console.log('Error en el respaldo DolarApi:', e.message); }
}

if (!t) { console.log('No se pudo obtener la tasa por ninguna vía.'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
await admin.firestore().doc('eventos_config/tasa_bcv').set({ valor: t.valor, fecha: t.fecha, fuente: t.fuente, actualizado: admin.firestore.FieldValue.serverTimestamp() });
console.log('Tasa guardada:', t.valor, t.fecha, '·', t.fuente);
