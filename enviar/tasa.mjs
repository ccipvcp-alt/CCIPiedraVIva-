// Lee la tasa oficial del dólar publicada por el BCV (https://www.bcv.org.ve/)
// y la guarda en Firestore (eventos_config/tasa_bcv) para que la página la use.
import admin from 'firebase-admin';
import https from 'node:https';

export function leerTasa(html) {
  const m = html.match(/id="dolar"[\s\S]*?<strong>\s*([\d.,]+)\s*<\/strong>/i);
  if (!m) return null;
  const valor = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  if (!(valor > 0)) return null;
  const f = html.match(/Fecha Valor:[\s\S]*?content="(\d{4}-\d{2}-\d{2})/i);
  const fecha = f ? f[1].split('-').reverse().join('/') : '';
  return { valor, fecha };
}

// El certificado del sitio del BCV suele fallar; solo se lee un dato público.
const bajar = url => new Promise((ok, mal) => {
  https.get(url, { rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }, r => {
    let t = ''; r.setEncoding('utf8'); r.on('data', c => t += c); r.on('end', () => ok(t));
  }).on('error', mal).on('timeout', function () { this.destroy(new Error('tiempo agotado')); });
});

if (process.env.PREVIEW) {
  console.log(leerTasa('<div id="dolar" class="x"><div class="row"><div><span> USD </span></div><div class="centrado"><strong> 39,18130000</strong></div></div></div><span>Fecha Valor:</span><span class="date-display-single" content="2024-10-22T00:00:00-04:00">'));
  process.exit(0);
}

const t = leerTasa(await bajar('https://www.bcv.org.ve/'));
if (!t) { console.log('No se pudo leer la tasa del BCV (cambió la página o no respondió).'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
await admin.firestore().doc('eventos_config/tasa_bcv').set({ valor: t.valor, fecha: t.fecha, actualizado: admin.firestore.FieldValue.serverTimestamp() });
console.log('Tasa BCV guardada:', t.valor, t.fecha);
