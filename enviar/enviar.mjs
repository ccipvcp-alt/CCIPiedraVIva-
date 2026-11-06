import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { IMG } from './imagenes.mjs';

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
  { filename: 'logo.png', content: Buffer.from(IMG.logo, 'base64'), contentType: 'image/png', cid: 'logo@cci' },
  ...['ig', 'yt', 'tt', 'wa'].map(n => ({ filename: n + '.png', content: Buffer.from(IMG[n], 'base64'), contentType: 'image/png', cid: `${n}@cci` }))
];
const imgs = (Array.isArray(a.imagenes) ? a.imagenes : []).slice(0, 3);
imgs.forEach((u, i) => {
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(u || '');
  if (m) attachments.push({ filename: `imagen${i + 1}.jpg`, content: Buffer.from(m[1], 'base64'), contentType: 'image/jpeg', cid: `img${i + 1}@cci` });
});
dias.forEach(d => { if (d.img) attachments.push({ filename: `dia${d.i}.jpg`, content: Buffer.from(d.img, 'base64'), contentType: 'image/jpeg', cid: `dia${d.i}@cci` }); });
const hay = n => attachments.some(x => x.cid === `img${n}@cci`);
const imagen = n => hay(n) ? `<tr><td style="padding:0"><img src="cid:img${n}@cci" alt="Imagen ${n}" width="600" style="display:block;width:100%;height:auto"></td></tr>` : '';

// Título grande: *palabra* en dorado
const titulo = esc(asuntoRaw).replace(/\*([^*]+)\*/g, `<span style="color:${PLATA}">$1</span>`);

// Fecha: "Semana del 8 de noviembre" (hora de Venezuela)
const fechaTxt = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'long' }).format(new Date());

// Convierte texto en párrafos; las líneas que empiezan con "- " o "• " se vuelven viñetas
const render = t => esc(t).split(/\n{2,}/).map(b => {
  const out = []; let txt = [], bl = [];
  const cierraTxt = () => { if (txt.length) out.push(`<p style="margin:0 0 12px;font-size:17px;line-height:1.7;color:#222">${txt.join('<br>')}</p>`); txt = []; };
  const cierraBl = () => { if (bl.length) out.push('<table role="presentation" align="center" style="margin:0 auto 12px;text-align:left" cellpadding="0" cellspacing="0">' + bl.map(l => `<tr><td style="color:#111111;padding:0 10px 6px 0;font-size:18px;vertical-align:top">•</td><td style="padding:0 0 6px;font-size:17px;line-height:1.5;color:#222">${l}</td></tr>`).join('') + '</table>'); bl = []; };
  b.split('\n').forEach(l => {
    if (/^\s*[-•]\s+/.test(l)) { cierraTxt(); bl.push(l.replace(/^\s*[-•]\s+/, '')); }
    else { cierraBl(); txt.push(l); }
  });
  cierraTxt(); cierraBl();
  return out.join('');
}).join('');
const intro = texto ? `<tr><td style="padding:34px 30px 6px;text-align:center">${render(texto)}</td></tr>` : '';
const seccionDia = d => d.img
  ? `<tr><td style="padding:0 0 4px"><img src="cid:dia${d.i}@cci" alt="${d.nombre}" width="600" style="display:block;width:100%;height:auto"></td></tr>` + (d.txt ? `<tr><td style="padding:16px 30px 8px;text-align:center">${render(d.txt)}</td></tr>` : '') + '<tr><td style="height:10px;line-height:10px;font-size:0">&nbsp;</td></tr>'
  : `<tr><td style="padding:0 30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #d9dadd"><tr><td style="padding:22px 0 8px;text-align:center"><span style="display:inline-block;background:#111111;color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:3px;padding:7px 18px;border-radius:999px">${d.nombre.toUpperCase()}</span></td></tr><tr><td style="padding:6px 0 14px;text-align:center">${render(d.txt)}</td></tr></table></td></tr>`;
const agenda = dias.map(seccionDia).join('');

const boton = (href, txt, bg, fg) => `<a href="${href}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:1px;padding:15px 34px;border-radius:999px">${txt}</a>`;
const urlOk = u => /^https?:\/\//i.test(u || '');
const btnTxt = (a.botonTexto || '').trim().toUpperCase();
const btnUrl = (a.botonUrl || '').trim();
const botonPrincipal = (btnTxt && urlOk(btnUrl)) ? btnTxt : 'VER EN VIVO';
const botonHref = (btnTxt && urlOk(btnUrl)) ? esc(btnUrl) : 'https://youtube.com/@ccipiedravivaoficial';
const frase = (a.frase || '').trim();

const icono = (n, href) => `<a href="${href}" style="display:inline-block;margin:0 7px"><img src="cid:${n}@cci" alt="${n}" width="44" height="44" style="display:block;width:44px;height:44px"></a>`;

const html = `<div style="background:#e9e9ec;padding:16px 8px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" align="center" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff" cellpadding="0" cellspacing="0">

<!-- PORTADA -->
<tr><td style="background:#111111;text-align:center;padding:34px 24px 38px">
  <span style="display:inline-block;border:1px solid #777;border-radius:999px;color:#fff;font-size:12px;letter-spacing:2px;padding:8px 18px">SEMANA DEL ${esc(fechaTxt).toUpperCase()}</span>
  <div style="padding:26px 0 8px"><img src="cid:logo@cci" alt="CCI Piedra Viva" width="110" style="display:inline-block;width:110px;height:auto"></div>
  <div style="color:#ffffff;font-size:40px;line-height:1.05;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;padding:10px 0 12px">${titulo}</div>
  <div style="color:#bdbdbd;font-size:13px;letter-spacing:3px">CENTRO CRISTIANO PIEDRAVIVA</div>
</td></tr>
${imagen(1)}

<!-- CUERPO -->
${intro}
${agenda}
<tr><td style="padding:22px 30px 30px;text-align:center">${boton(botonHref, esc(botonPrincipal), PLATA, '#111111')}</td></tr>
${imagen(2)}

${frase ? `<!-- FRASE DESTACADA -->
<tr><td style="background:#1c1c1e;text-align:center;padding:34px 30px"><div style="color:#fff;font-size:21px;line-height:1.45;font-style:italic">“${esc(frase)}”</div></td></tr>` : ''}
${imagen(3)}

<!-- DESPEDIDA -->
<tr><td style="padding:30px 30px 34px;text-align:center;color:#222;font-size:17px;line-height:1.6">¡Dios les bendiga!<br><b>Pastores Daniel y Saraid De García</b></td></tr>

<!-- PIE -->
<tr><td style="background:#111111;text-align:center;padding:30px 20px 10px">
  <img src="cid:logo@cci" alt="CCI Piedra Viva" width="70" style="display:inline-block;width:70px;height:auto">
</td></tr>
<tr><td style="background:#111111;text-align:center;padding:14px 20px 8px">
  ${icono('ig', 'https://www.instagram.com/ccipiedraviva')}${icono('yt', 'https://youtube.com/@ccipiedravivaoficial')}${icono('tt', 'https://www.tiktok.com/@cci.piedraviva.oficial')}
</td></tr>
<tr><td style="background:#111111;color:#c9c9c9;text-align:center;padding:14px 26px 30px;font-size:12px;line-height:1.7">
  Gracias por ser parte de nuestra comunidad de fe.<br>
  ¿Te gustaría oración? Escríbenos a <a href="mailto:CCIPIDRAVIVA@gmail.com" style="color:#fff">CCIPIDRAVIVA@gmail.com</a>.<br><br>
  <b style="color:#fff">Centro Cristiano Piedraviva</b><br>
  Sede principal: Calle Padre María de Triana<br>
  La Guaricha · Valencia · Boconó<br><br>
  Recibes este correo porque te registraste en CCI Piedra Viva.<br>
  Para dejar de recibirlo, responde a este mensaje con la palabra BAJA.
</td></tr>
</table></div>`;

const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
let enviados = 0;
for (let i = 0; i < lista.length; i += 40) {
  const lote = lista.slice(i, i + 40);
  await tr.sendMail({ from: `"CCI Piedra Viva" <${process.env.GMAIL_USER}>`, to: process.env.GMAIL_USER, bcc: lote, subject: asunto, text: textoPlano, html, attachments });
  enviados += lote.length;
}
await ref.update({ ultimoEnvio: admin.firestore.FieldValue.serverTimestamp(), ultimosDestinatarios: enviados });
console.log('Enviado a', enviados, 'correos.');
