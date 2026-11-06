// Confirmación de inscripción a eventos: envía al correo de cada inscrito su código
// y el resumen de pagos cada vez que hay un pago nuevo o se confirma un efectivo (campo "sigEnv" distinto al estado actual).
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { IMG } from './imagenes.mjs';

const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const usd = n => '$' + (Math.round((+n || 0) * 100) / 100).toLocaleString('es-VE', { maximumFractionDigits: 2 });
const primerNombre = n => { const p = String(n || '').trim().split(/\s+/)[0] || ''; return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''; };
const fecha = f => { try { return new Date(f).toLocaleDateString('es-VE'); } catch { return ''; } };

export function plantilla(x, costo) {
  const dif = costo == null ? null : Math.round((costo - x.monto) * 100) / 100;
  const saldo = dif === null ? null : Math.max(0, dif);
  const estado = dif === null ? 'Pago registrado' : dif < 0 ? `Pago superior al costo (${usd(-dif)} de más). Un pastor revisará tu pago.` : dif === 0 ? '¡PAGO TOTAL COMPLETO!' : `Abono · Falta ${usd(dif)}`;
  const n = esc(primerNombre(x.nombre));
  const link = `https://ccipvcp-alt.github.io/CCIPiedraVIva-/?v=evento&e=${encodeURIComponent(x.k)}&f=1&c=${encodeURIComponent(x.codigo)}&ci=${encodeURIComponent(x.ci)}`;
  const ok = (x.pagos || []).filter(g => g.e !== 'pend'), pend = (x.pagos || []).filter(g => g.e === 'pend');
  const pendTotal = pend.reduce((a, g) => a + (+g.m || 0), 0);
  const filas = (x.pagos || []).map(g => `<tr><td style="padding:6px 0;border-bottom:1px solid #e5e5e5;color:#333">${esc(fecha(g.f))} · ${esc(g.mt || 'Pago Móvil')}${g.mb ? ' · Bs. ' + esc(Number(g.mb).toLocaleString('es-VE', { maximumFractionDigits: 2 })) + (g.t ? ' (tasa BCV ' + esc(g.t) + ')' : '') : ''}${g.r ? ' · ref. ' + esc(g.r) : ''}${g.e === 'pend' ? ' <b style="color:#b45309">· PENDIENTE de confirmar</b>' : ''}</td><td style="padding:6px 0;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:bold;color:${g.e === 'pend' ? '#b45309' : '#111'}">${usd(g.m)}</td></tr>`).join('');
  return `<div style="background:#e9e9ec;padding:16px 8px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" align="center" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff" cellpadding="0" cellspacing="0">
<tr><td style="background:#0a2a86;text-align:center;padding:30px 24px 34px">
  <img src="cid:logo@cci" alt="CCI Piedra Viva" width="90" style="display:inline-block;width:90px;height:auto">
  <div style="color:#ffffff;font-size:14px;letter-spacing:3px;padding-top:16px">CONFIRMACIÓN DE INSCRIPCIÓN</div>
  <div style="color:#ffffff;font-size:28px;line-height:1.15;font-weight:900;padding-top:8px">${esc(x.evento)}</div>
</td></tr>
<tr><td style="padding:28px 30px 8px;text-align:center;color:#222;font-size:17px;line-height:1.6">¡Paz de Dios${n ? ', ' + n : ''}! Recibimos tu inscripción como <b>${esc(x.rol)}</b>.</td></tr>
<tr><td style="padding:10px 30px 8px;text-align:center">
  <div style="font-size:13px;letter-spacing:2px;color:#666">TU CÓDIGO DE INSCRIPCIÓN</div>
  <div style="display:inline-block;margin-top:8px;background:#f1f4fb;border:2px dashed #1450c4;border-radius:12px;padding:14px 22px;font-size:30px;font-weight:900;letter-spacing:3px;color:#0a2a86">${esc(x.codigo)}</div>
  <div style="font-size:14px;color:#555;padding-top:10px;line-height:1.5">Guárdalo y preséntalo cuando se verifique tu pago.</div>
</td></tr>
<tr><td style="padding:18px 30px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:16px">
  ${filas}
  <tr><td style="padding:12px 0 4px;color:#111;font-weight:bold">Total abonado (confirmado)</td><td style="padding:12px 0 4px;text-align:right;font-weight:900;color:#0a2a86;font-size:20px">${usd(x.monto)}</td></tr>
  ${pendTotal ? `<tr><td style="padding:2px 0;color:#b45309">Efectivo por confirmar (lo habilita un pastor al recibirlo)</td><td style="padding:2px 0;text-align:right;color:#b45309">${usd(pendTotal)}</td></tr>` : ''}
  ${costo == null ? '' : `<tr><td style="padding:2px 0;color:#555">Costo del evento</td><td style="padding:2px 0;text-align:right;color:#555">${usd(costo)}</td></tr>`}
</table></td></tr>
<tr><td style="padding:12px 30px 28px;text-align:center"><div style="font-size:16px;font-weight:bold;color:${saldo === 0 ? '#1b8a3a' : '#0a2a86'};padding-bottom:14px">${esc(estado)}</div>
  ${saldo === 0 ? '' : `<a href="${link}" style="display:inline-block;background:#1450c4;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:1px;padding:15px 30px;border-radius:999px">AGREGAR UN PAGO</a>
  <div style="font-size:13px;color:#555;padding-top:12px;line-height:1.5">Este botón abre el formulario con tu código y tu cédula ya escritos.</div>`}
  <div style="margin-top:18px;background:#fff7e6;border:1px solid #f5c542;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5;color:#7a4b00;text-align:left"><b>⚠️ Aviso de seguridad:</b> este correo es personal y <b>no debe compartirse</b>. Contiene tu código de inscripción y un enlace que permite agregar pagos a tu registro. No lo reenvíes ni lo muestres a nadie.</div>
</td></tr>
<tr><td style="background:#0a2a86;color:#dbe6ff;text-align:center;padding:22px 24px;font-size:12px;line-height:1.7"><b style="color:#fff">Centro Cristiano Piedraviva</b><br>¿Dudas? Escríbenos a <a href="mailto:CCIPIDRAVIVA@gmail.com" style="color:#fff">CCIPIDRAVIVA@gmail.com</a></td></tr>
</table></div>`;
}

if (process.env.PREVIEW) {
  const fs = await import('fs');
  fs.writeFileSync(process.env.PREVIEW, plantilla({ nombre: 'maria lopez', rol: 'Participante', evento: 'Encuentro de Liberación · Abril 2027', codigo: 'PV-LG-47218-X7K2', k: 0, ci: '12345678', monto: 25, pagos: [{ m: 25, f: new Date().toISOString(), r: '123456', mt: 'Pago Móvil', e: 'ok' }, { m: 10, f: new Date().toISOString(), r: '', mt: 'Efectivo', e: 'pend' }] }, 50));
  process.exit(0);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const cfg = {}; (await db.collection('eventos_config').get()).forEach(d => { cfg[d.id] = d.data(); });
const costoDe = x => { const c = cfg[String(x.k)]; if (!c || c.costo == null) return null; return x.rol === 'Servidor' && c.costoServidor != null ? +c.costoServidor : +c.costo; };

const snap = await db.collection('inscritos_evento').get();
const firma = x => (x.pagos || []).map(g => g.m + (g.e || 'ok')).join(',');
const pend = snap.docs.filter(d => { const x = d.data(); return /^\S+@\S+\.\S+$/.test(x.email || '') && (x.sigEnv || '') !== firma(x); });
if (!pend.length) { console.log('No hay confirmaciones pendientes.'); process.exit(0); }

const attachments = [{ filename: 'logo.png', content: Buffer.from(IMG.logo, 'base64'), contentType: 'image/png', cid: 'logo@cci' }];
const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
let ok = 0;
for (const d of pend) {
  const x = d.data(); const costo = costoDe(x);
  const saldo = costo == null ? null : Math.max(0, costo - x.monto);
  const asunto = (x.pagos || []).length === 1 ? `Inscripción confirmada · ${x.evento} · Código ${x.codigo}` : `Pago recibido · ${x.evento} · ${saldo === 0 ? 'Pago total completo' : 'Código ' + x.codigo}`;
  try {
    await tr.sendMail({ from: `"CCI Piedra Viva" <${process.env.GMAIL_USER}>`, to: x.email, subject: asunto, text: `Paz de Dios. Inscripción: ${x.evento}. Tu código: ${x.codigo}. Total abonado: ${usd(x.monto)}${costo == null ? '' : ' de ' + usd(costo)}.`, html: plantilla(x, costo), attachments });
    await d.ref.update({ sigEnv: firma(x) });
    ok++;
  } catch (e) { console.log('No se pudo enviar a un inscrito:', e.message); }
}
console.log('Confirmaciones enviadas:', ok);
