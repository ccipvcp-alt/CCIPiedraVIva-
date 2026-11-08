// Envía por correo las observaciones de IGLEKIDS que las maestras cargaron en la página.
// Cada observación queda marcada: correoEstado = 'enviado' (o 'error' tras 3 intentos).
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { IMG } from './imagenes.mjs';

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TITULO = { conducta: 'Un mensaje de IGLEKIDS', salud: 'Aviso importante de IGLEKIDS', logro: 'Una buena noticia de IGLEKIDS', recordatorio: 'Recordatorio de IGLEKIDS', otro: 'Un mensaje de IGLEKIDS' };

export function plantilla(x) {
  const cuerpo = String(x.mensaje || '').split(/\n{2,}/).map(p => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="background:#e9e9ec;padding:16px 8px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" align="center" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff" cellpadding="0" cellspacing="0">
<tr><td style="background:#111111;text-align:center;padding:30px 24px">
  <img src="cid:logo@cci" alt="CCI Piedra Viva" width="90" style="display:inline-block;width:90px;height:auto">
  <div style="color:#ffffff;font-size:26px;font-weight:900;text-transform:uppercase;padding:14px 0 4px">IGLEKIDS</div>
  <div style="color:#bdbdbd;font-size:12px;letter-spacing:3px">CENTRO CRISTIANO PIEDRAVIVA</div>
</td></tr>
<tr><td style="padding:30px 30px 8px;color:#222222;font-size:16px;line-height:1.7">
  <div style="font-size:13px;letter-spacing:2px;color:#777;padding-bottom:12px">${esc((TITULO[x.tipo] || TITULO.otro).toUpperCase())}</div>
  ${cuerpo}
</td></tr>
<tr><td style="background:#f1f1f2;padding:20px 24px;text-align:center;color:#666;font-size:12px;line-height:1.6">Este mensaje es privado y está dirigido al representante de ${esc(x.nino || '')}.<br>Por favor no lo comparta.</td></tr>
</table></div>`;
}

if (process.argv[1] && process.argv[1].endsWith('notasik.mjs')) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();
  const snap = await db.collection('ik_notas').where('correoEstado', '==', 'pendiente').get();
  if (snap.empty) { console.log('No hay observaciones por enviar.'); process.exit(0); }
  const attachments = [{ filename: 'logo.png', content: Buffer.from(IMG.logo, 'base64'), contentType: 'image/png', cid: 'logo@cci' }];
  const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  let ok = 0;
  for (const d of snap.docs) {
    const x = d.data();
    if (!x.correo || !/^\S+@\S+\.\S+$/.test(x.correo)) { await d.ref.update({ correoEstado: 'error' }); continue; }
    try {
      await tr.sendMail({ from: `"IGLEKIDS · CCI Piedra Viva" <${process.env.GMAIL_USER}>`, to: x.correo, subject: `${TITULO[x.tipo] || TITULO.otro} · ${x.nino}`, text: x.mensaje, html: plantilla(x), attachments });
      await d.ref.update({ correoEstado: 'enviado', enviadoEn: admin.firestore.FieldValue.serverTimestamp() });
      ok++;
    } catch (e) {
      const n = (x.intentos || 0) + 1;
      await d.ref.update({ intentos: n, correoEstado: n >= 3 ? 'error' : 'pendiente' });
      console.log('No se pudo enviar una observación:', e.message);
    }
  }
  console.log('Observaciones enviadas:', ok);
}
