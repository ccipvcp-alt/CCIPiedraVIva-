import admin from 'firebase-admin';
import nodemailer from 'nodemailer';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const ref = db.doc('anuncios/semana');
const snap = await ref.get();
if (!snap.exists) { console.log('No hay anuncios guardados.'); process.exit(0); }
const a = snap.data();
const texto = (a.texto || '').trim();
if (!texto) { console.log('El texto está vacío.'); process.exit(0); }

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

const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cuerpo = esc(texto).split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('');
const asunto = (a.asunto || '').trim() || 'Anuncios de la semana · CCI Piedra Viva';
const html = `<div style="background:#f4f4f4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
<div style="background:#111;color:#fff;padding:22px 24px;text-align:center"><div style="font-size:13px;letter-spacing:2px">CENTRO CRISTIANO</div><div style="font-size:24px;font-weight:bold">PIEDRA VIVA</div></div>
<div style="padding:26px 24px;color:#222;font-size:16px;line-height:1.5"><h2 style="margin:0 0 16px;font-size:20px">Anuncios de la semana</h2>${cuerpo}
<p style="margin:22px 0 0">¡Dios les bendiga!<br><b>Pastores Daniel y Saraid De García</b></p></div>
<div style="background:#f4f4f4;padding:14px 24px;font-size:12px;color:#666;text-align:center">Recibes este correo porque te registraste en CCI Piedra Viva.<br>Para dejar de recibirlo, responde a este mensaje con la palabra BAJA.</div>
</div></div>`;

const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
let enviados = 0;
for (let i = 0; i < lista.length; i += 40) {
  const lote = lista.slice(i, i + 40);
  await tr.sendMail({ from: `"CCI Piedra Viva" <${process.env.GMAIL_USER}>`, to: process.env.GMAIL_USER, bcc: lote, subject: asunto, text: texto, html });
  enviados += lote.length;
}
await ref.update({ ultimoEnvio: admin.firestore.FieldValue.serverTimestamp(), ultimosDestinatarios: enviados });
console.log('Enviado a', enviados, 'correos.');
