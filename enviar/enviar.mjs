import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const ref = db.doc('anuncios/semana');
const snap = await ref.get();
if (!snap.exists) { console.log('No hay anuncios guardados.'); process.exit(0); }
const a = snap.data();
const texto = (a.texto || '').trim();
const NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const dias = [];
for (let i = 0; i < 7; i++) {
const ds = await db.doc(`anuncios/dia${i}`).get();
const d = ds.exists ? ds.data() : {};
const txt = (d.texto || '').trim();
const im = /^data:image\/jpeg;base64,(.+)$/.exec(d.imagen || '');
if (txt || im) dias.push({ i, nombre: NOMBRES[i], txt, img: im ? im[1] : null });
}
if (!texto && !dias.length) { console.log('No hay anuncios escritos.'); process.exit(0); }
const textoPlano = [texto, ...dias.map(d => `${d.nombre.toUpperCase()}\n${d.txt || '(ver imagen)'}`)].filter(Boolean).join('\n\n');
// Evita repetir anuncios viejos: solo se envía lo guardado en los últimos 8 días
// (o siempre, si se lanza a mano desde Actions)
const edadDias = a.fecha ? (Date.now() - a.fecha.toMillis()) / 864e5 : 999;
if (!process.env.FORZAR && edadDias > 8) { console.log('Los anuncios tienen más de 8 días; no se envía.'); process.exit(0); }
const emails = new Set();
(await db.collection('miembros').where('estado', '==', 'aprobado').get())
.forEach(d => { const e = (d.data().email || '').trim().toLowerCase(); if (e) emails.add(e); });
(await db.collection('boletin').get())
.forEach(d => { const e = (d.data().email || '').trim().toLowerCase(); if (e) emails.add(e); });
const lista = [...emails];
if (!lista.length) { console.log('No hay correos registrados.'); process.exit(0); }
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const asuntoRaw = (a.asunto || '').trim() || 'Anuncios de la *semana*';
const asunto = asuntoRaw.replace(/\*/g, '');
const PLATA = '#c9ccd1';
const dir = p => new URL(p, import.meta.url).pathname;
// Adjuntos incrustados (cid): logo, íconos e imágenes subidas desde el panel
const attachments = [
