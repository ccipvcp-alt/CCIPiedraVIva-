// Envía por correo las notificaciones a departamentos que el pastor cargó en la página.
// Destino 'general' = todos los integrantes aprobados; si no, solo los del departamento elegido.
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { IMG } from './imagenes.mjs';

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const primer = n => { const p = String(n || '').trim().split(/\s+/)[0] || ''; return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''; };
const fechaTxt = f => { if (!f) return ''; const [y, m, d] = f.split('-').map(Number); return `${DIAS[new Date(y, m - 1, d).getDay()]} ${d} de ${MESES[m - 1]}`; };
const horaTxt = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; };

export function plantilla(x, nombre) {
  const cuando = [fechaTxt(x.fecha), horaTxt(x.hora), x.lugar ? 'Lugar: ' + x.lugar : ''].filter(Boolean);
  const cuerpo = String(x.mensaje || '').split(/\n{2,}/).map(p => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="background:#e9e9ec;padding:16px 8px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" align="center" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff" cellpadding="0" cellspacing="0">
<tr><td style="background:#111111;text-align:center;padding:30px 24px">
  <img src="cid:logo@cci" alt="CCI Piedra Viva" width="90" style="display:inline-block;width:90px;height:auto">
  <div style="color:#ffffff;font-size:13px;letter-spacing:3px;padding-top:14px">${x.destino === 'general' ? 'AVISO GENERAL' : 'AVISO PARA ' + esc(String(x.destinoNombre || '').toUpperCase())}</div>
</td></tr>
<tr><td style="padding:30px 30px 8px;color:#222222;font-size:16px;line-height:1.7">
  <div style="font-size:24px;font-weight:900;line-height:1.2;color:#111111;padding-bottom:14px">${esc(x.titulo)}</div>
  ${cuando.length ? `<div style="background:#f1f1f2;border-left:4px solid #111111;padding:12px 16px;margin-bottom:18px;font-weight:bold;color:#111111">${cuando.map(esc).join('<br>')}</div>` : ''}
  <p style="margin:0 0 16px">Paz de Dios${nombre ? ', ' + esc(nombre) : ''}.</p>
  ${cuerpo}
</td></tr>
<tr><td style="background:#f1f1f2;padding:20px 24px;text-align:center;color:#666;font-size:12px;line-height:1.6">CCI Piedra Viva · Mensaje para los equipos de servicio</td></tr>
</table></div>`;
}

if (process.argv[1] && process.argv[1].endsWith('notifdeptos.mjs')) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();
  const snap = await db.collection('deptos_notif').where('correoEstado', '==', 'pendiente').get();
  if (snap.empty) { console.log('No hay notificaciones por enviar.'); process.exit(0); }
  const gente = (await db.collection('deptos_usuarios').where('estado', '==', 'aprobado').get()).docs.map(d => d.data()).filter(u => u.email && /^\S+@\S+\.\S+$/.test(u.email));
  const attachments = [{ filename: 'logo.png', content: Buffer.from(IMG.logo, 'base64'), contentType: 'image/png', cid: 'logo@cci' }];
  const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  for (const d of snap.docs) {
    const x = d.data();
    const dest = [...new Map(gente.filter(u => x.destino === 'general' || u.deptoId === x.destino).map(u => [u.email.toLowerCase(), u])).values()];
    if (!dest.length) { await d.ref.update({ correoEstado: 'sin_destinatarios', enviados: 0 }); console.log('Sin destinatarios para:', x.titulo); continue; }
    let ok = 0;
    for (const u of dest) {
      try {
        await tr.sendMail({ from: `"CCI Piedra Viva" <${process.env.GMAIL_USER}>`, to: u.email, subject: x.titulo, text: [x.titulo, fechaTxt(x.fecha), horaTxt(x.hora), x.lugar, '', x.mensaje].filter(v => v !== undefined && v !== null).join('\n'), html: plantilla(x, primer(u.nombre)), attachments });
        ok++;
      } catch (e) { console.log('No se pudo enviar a un integrante:', e.message); }
    }
    await d.ref.update({ correoEstado: ok ? 'enviado' : 'error', enviados: ok, enviadoEn: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`"${x.titulo}": ${ok} de ${dest.length} correos enviados.`);
  }
}
