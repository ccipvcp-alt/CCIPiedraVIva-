// Correo de bienvenida para miembros aprobados que dejaron su correo.
// Se envía una sola vez por miembro y queda marcado con el campo "bienvenida".
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { IMG } from './imagenes.mjs';

const PLATA = '#c9ccd1';
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const primerNombre = n => {
  const p = String(n || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
};
const boton = (href, txt, bg, fg) => `<a href="${href}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:1px;padding:15px 34px;border-radius:999px;margin:4px">${txt}</a>`;
const icono = (n, href) => `<a href="${href}" style="display:inline-block;margin:0 7px"><img src="cid:${n}@cci" alt="${n}" width="44" height="44" style="display:block;width:44px;height:44px"></a>`;

// Nuestra visión: evangelizamos, ganamos, afirmamos, discipulamos y enviamos
const PASOS = [
  ['1', 'EVANGELIZAMOS', 'Salimos a compartir el amor de Cristo en nuestras calles, casas y comunidades, con la certeza de que Dios quiere alcanzar a cada persona.'],
  ['2', 'GANAMOS', 'Quien recibe a Jesús es recibido en familia: lo acompañamos de cerca en las casas de paz, como nuevo creyente.'],
  ['3', 'AFIRMAMOS', 'En la Escuela de Formación de MIEMBROS, afirmas los fundamentos de tu fe y descubres quién eres en Cristo.'],
  ['4', 'DISCIPULAMOS', 'En la Escuela de DISCÍPULOS, un mentor camina contigo para formar tu carácter y despertar tu llamado.'],
  ['5', 'ENVIAMOS', 'En la Escuela de LÍDERES, te preparamos para ser enviado: a formar discípulos y a cumplir tu ministerio.']
];
const ESCUELAS = ['MIEMBROS', 'DISCÍPULOS', 'LÍDERES'];

export function plantilla(nombre) {
  const n = esc(primerNombre(nombre));
  const pasos = PASOS.map(([num, t, d]) => `<tr><td style="padding:0 0 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="56" valign="top" style="padding-right:14px"><div style="width:44px;height:44px;line-height:44px;border-radius:22px;background:#111111;color:#ffffff;font-weight:bold;font-size:18px;text-align:center">${num}</div></td>
<td valign="top" style="text-align:left"><div style="font-size:14px;font-weight:bold;letter-spacing:2px;color:#111111;padding:2px 0 4px">${t}</div><div style="font-size:16px;line-height:1.55;color:#333333">${d}</div></td></tr></table></td></tr>`).join('');
  return `<div style="background:#e9e9ec;padding:16px 8px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" align="center" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff" cellpadding="0" cellspacing="0">

<tr><td style="background:#111111;text-align:center;padding:34px 24px 40px">
  <span style="display:inline-block;border:1px solid #777;border-radius:999px;color:#fff;font-size:12px;letter-spacing:2px;padding:8px 18px">BIENVENIDO A LA FAMILIA</span>
  <div style="padding:26px 0 8px"><img src="cid:logo@cci" alt="CCI Piedra Viva" width="110" style="display:inline-block;width:110px;height:auto"></div>
  <div style="color:#ffffff;font-size:38px;line-height:1.08;font-weight:900;text-transform:uppercase;padding:10px 0 12px">${n ? `${n}, <span style="color:${PLATA}">bienvenido</span>` : `<span style="color:${PLATA}">Bienvenido</span>`}<br>a casa</div>
  <div style="color:#bdbdbd;font-size:13px;letter-spacing:3px">CENTRO CRISTIANO PIEDRAVIVA</div>
</td></tr>

<tr><td style="padding:36px 30px 14px;text-align:center;color:#222222;font-size:17px;line-height:1.7">
  <p style="margin:0 0 6px">¡Paz de Dios${n ? ', ' + n : ''}! Para nosotros es un gozo enorme que hoy seas parte de esta familia.</p>
</td></tr>

<tr><td style="background:#111111;text-align:center;padding:38px 28px">
  <div style="color:${PLATA};font-size:13px;letter-spacing:3px;padding-bottom:12px">TU PROPÓSITO</div>
  <div style="color:#ffffff;font-size:32px;line-height:1.1;font-weight:900;text-transform:uppercase;padding-bottom:18px">No naciste<br>por error</div>
  <div style="color:#e4e4e6;font-size:17px;line-height:1.7">Como enseña el <b>Apóstol Guillermo Maldonado</b>, padre de esta Visión Sobrenatural, Dios te trajo al mundo con un <b>propósito personal y espiritual</b> para cada uno de nosotros.<br><br>Para nosotros, como iglesia, es un privilegio ayudarte a desarrollarlo.</div>
</td></tr>

<tr><td style="background:#1c1c1e;text-align:center;padding:26px 30px"><div style="color:#ffffff;font-size:18px;line-height:1.5;font-style:italic">“Porque somos hechura suya, creados en Cristo Jesús para buenas obras, las cuales Dios preparó de antemano para que anduviésemos en ellas.”</div><div style="color:${PLATA};font-size:13px;letter-spacing:2px;padding-top:12px">EFESIOS 2:10</div></td></tr>

<tr><td style="padding:34px 30px 6px;text-align:center"><div style="font-size:22px;font-weight:900;letter-spacing:1px;color:#111111;padding-bottom:6px">NUESTRA VISIÓN</div><div style="font-size:16px;color:#555555;padding-bottom:22px">El camino para desarrollar tu propósito, ministerio y llamado.</div></td></tr>
<tr><td style="padding:0 30px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${pasos}</table></td></tr>

<tr><td style="background:#f1f1f2;padding:32px 24px 26px;text-align:center">
  <div style="font-size:21px;font-weight:900;letter-spacing:1px;color:#111111;padding-bottom:8px">ESCUELAS DE FORMACIÓN</div>
  <div style="font-size:16px;line-height:1.6;color:#444444;padding-bottom:18px">Por esto es importante que te unas a nuestras escuelas de formación:</div>
  ${ESCUELAS.map(e => `<span style="display:inline-block;background:#111111;color:#ffffff;font-weight:bold;font-size:14px;letter-spacing:2px;padding:12px 18px;border-radius:999px;margin:4px">${e}</span>`).join('')}
  <div style="padding-top:22px">${boton('https://ccipvcp-alt.github.io/CCIPiedraVIva-/?v=escuela&r=1', 'QUIERO INSCRIBIRME', PLATA, '#111111')}</div>
</td></tr>
<tr><td style="padding:28px 30px 8px;text-align:center;color:#222222;font-size:17px;line-height:1.7">
  <p style="margin:0"><b>Te esperamos este domingo</b><br>9:00 a. m. y 11:00 a. m. · Presencial y en vivo</p>
</td></tr>
<tr><td style="padding:14px 30px 30px;text-align:center">
  ${boton('https://youtube.com/@ccipiedravivaoficial', 'VER EN VIVO', '#111111', '#ffffff')}
</td></tr>

<tr><td style="padding:6px 30px 34px;text-align:center;color:#222222;font-size:17px;line-height:1.6">Estamos para servirte y orar contigo por el propósito que Dios tiene para ti.<br>¡Dios te bendiga grandemente!<br><b>Pastores Daniel y Saraid De García</b></td></tr>

<tr><td style="background:#111111;text-align:center;padding:30px 20px 10px"><img src="cid:logo@cci" alt="CCI Piedra Viva" width="70" style="display:inline-block;width:70px;height:auto"></td></tr>
<tr><td style="background:#111111;text-align:center;padding:14px 20px 8px">
  ${icono('ig', 'https://www.instagram.com/ccipiedraviva')}${icono('yt', 'https://youtube.com/@ccipiedravivaoficial')}${icono('tt', 'https://www.tiktok.com/@cci.piedraviva.oficial')}
</td></tr>
<tr><td style="background:#111111;color:#c9c9c9;text-align:center;padding:14px 26px 30px;font-size:12px;line-height:1.7">
  <b style="color:#fff">Centro Cristiano Piedraviva</b><br>Sede principal: Calle Padre María de Triana<br>La Guaricha · Valencia · Boconó<br><br>
  Recibes este correo porque te registraste como miembro de CCI Piedra Viva.<br>Para dejar de recibir correos, responde con la palabra BAJA.
</td></tr>
</table></div>`;
}

const textoPlano = nombre => `¡Paz de Dios${primerNombre(nombre) ? ', ' + primerNombre(nombre) : ''}! Bienvenido a la familia de Centro Cristiano Piedraviva. No naciste por error: como enseña el Apóstol Guillermo Maldonado, Dios te trajo al mundo con un propósito personal y espiritual, y es un privilegio para nosotros ayudarte a desarrollarlo. Nuestra visión: evangelizamos, ganamos, afirmamos, discipulamos y enviamos. Únete a nuestras escuelas de formación: Miembros, Discípulos y Líderes. Te esperamos el domingo a las 9:00 a. m. y 11:00 a. m. Pastores Daniel y Saraid De García.`;

if (process.env.PREVIEW) { (await import('fs')).writeFileSync(process.env.PREVIEW, plantilla('daniel jose')); process.exit(0); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const snap = await db.collection('miembros').where('estado', '==', 'aprobado').get();
const pendientes = snap.docs.filter(d => { const x = d.data(); return x.email && /^\S+@\S+\.\S+$/.test(x.email) && !x.bienvenida; });
if (!pendientes.length) { console.log('No hay bienvenidas pendientes.'); process.exit(0); }

const attachments = [
  { filename: 'logo.png', content: Buffer.from(IMG.logo, 'base64'), contentType: 'image/png', cid: 'logo@cci' },
  ...['ig', 'yt', 'tt', 'wa'].map(n => ({ filename: n + '.png', content: Buffer.from(IMG[n], 'base64'), contentType: 'image/png', cid: `${n}@cci` }))
];
const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
let ok = 0;
for (const d of pendientes) {
  const m = d.data();
  try {
    await tr.sendMail({ from: `"CCI Piedra Viva" <${process.env.GMAIL_USER}>`, to: m.email, subject: '¡Bienvenido a la familia de CCI Piedra Viva!', text: textoPlano(m.nombre), html: plantilla(m.nombre), attachments });
    await d.ref.update({ bienvenida: admin.firestore.FieldValue.serverTimestamp() });
    ok++;
  } catch (e) { console.log('No se pudo enviar a un miembro:', e.message); }
}
console.log('Bienvenidas enviadas:', ok);
