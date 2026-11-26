// Suscripciones y pagos de cada mes, detectados solos (pagosDeCadaMes en logica.js): un apartado en Resumen con lo que
// suman al mes y al año, y la hoja de cada uno con sus cobros, para añadirlo a los movimientos fijos o quitarlo de la
// lista si no es un pago de cada mes.

import { ic } from '../iconos.js';
import { esc, fmt, fmt0, fechaCorta, infoCategoria, pagosDeCadaMes, estaEnFijos, hoyISO } from '../logica.js';
import { ficha } from '../componentes.js';
import { abrirHoja, cabeceraHoja, cerrarHoja, toast } from '../ui.js';
import { nuevoFijo } from './fijos.js';

// «No es un pago de cada mes» se recuerda por comercio en este dispositivo (si el navegador no deja guardarlo, vale hasta recargar)
const claveOcultos = E => `pj_pagos_ocultos_${E.usuario?.id || ''}`;
function ocultos(E) {
  if (!E.pagosOcultos) { try { E.pagosOcultos = new Set(JSON.parse(localStorage.getItem(claveOcultos(E))) || []); } catch { E.pagosOcultos = new Set(); } }
  return E.pagosOcultos;
}
function guardarOcultos(E, lista) {
  E.pagosOcultos = new Set(lista);
  try { localStorage.setItem(claveOcultos(E), JSON.stringify([...lista])); } catch { /* sin almacenamiento */ }
}

const redondo = n => Math.round(n * 100) / 100;
export function pagos(E) {
  const r = pagosDeCadaMes(E.txs), fuera = ocultos(E);
  const activas = r.activas.filter(s => !fuera.has(s.clave)), terminadas = r.terminadas.filter(s => !fuera.has(s.clave));
  const alMes = redondo(activas.reduce((s, x) => s + x.importe, 0));
  return { activas, terminadas, alMes, alAño: redondo(alMes * 12), ocultas: new Set([...r.activas, ...r.terminadas].filter(s => fuera.has(s.clave)).map(s => s.clave)).size };
}

const COMO = { tarjeta: 'con tarjeta', recibo: 'por recibo', transferencia: 'por transferencia', bizum: 'por Bizum', apple_pay: 'con Apple Pay' };
const cuando = s => s.proximo >= hoyISO() ? `el próximo, ${fechaCorta(s.proximo)}` : `el último, ${fechaCorta(s.ultimo)}`;

export function seccion(E) {
  if (!E.txs.some(t => t.cuenta !== 'previsto')) return '';
  const p = pagos(E);
  const filas = p.activas.map(s => {
    const c = infoCategoria(s.categoria);
    return `<button type="button" class="fila" data-accion="ver-pago" data-id="${esc(s.id)}">${ficha(c)}
      <span class="cuerpo"><span class="concepto">${esc(s.nombre)}</span><span class="detalle">Día ${s.dia} · ${cuando(s)}${estaEnFijos(E.fijos, s) ? ' · en tus fijos' : ''}</span></span>
      <span class="importe num">${s.variable ? '≈ ' : ''}${fmt(s.importe)}</span></button>`;
  }).join('');
  const terminadas = p.terminadas.map(s => `${esc(s.nombre)} (el último, ${fechaCorta(s.ultimo)})`).join(', ');
  return `<section class="tarjeta" aria-label="Suscripciones y pagos de cada mes">
    <h2 class="h2">Suscripciones y pagos de cada mes</h2>
    ${filas ? `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:-4px"><span class="cifra-m num">${fmt(p.alMes)}</span><span class="nota">al mes · unos ${fmt0(p.alAño)} al año</span></div>
    <div>${filas}</div>`
    : '<p class="vacio">Aún no hay pagos que se repitan cada mes. Cuando la app vea el mismo cobro 3 meses seguidos (Netflix, el gimnasio, el móvil…), aparecerá aquí.</p>'}
    ${terminadas ? `<p class="nota">Parece que ya no pagas: ${terminadas}.</p>` : ''}
    ${p.ocultas ? `<button type="button" class="enlace" style="align-self:flex-start;padding-left:0" data-accion="mostrar-pagos-ocultos">Volver a enseñar ${p.ocultas === 1 ? 'el que quitaste' : `los ${p.ocultas} que quitaste`}</button>` : ''}
    ${filas ? '<p class="nota">La app los encuentra sola: lo que se cobra cada mes en el mismo sitio, por el mismo importe y hacia el mismo día. Toca uno para ver sus cobros.</p>' : ''}
  </section>`;
}

function hojaPago(E, s) {
  const c = infoCategoria(s.categoria);
  const enFijos = estaEnFijos(E.fijos, s);
  const cobros = [...s.cobros].reverse().slice(0, 12);
  const subida = s.antes != null ? s.importe - s.antes : 0;
  const desde = s.antes != null ? [...s.cobros].reverse().find((t, k, l) => l[k + 1] && Math.abs(+l[k + 1].importe - s.antes) < 0.005)?.fecha : null;
  abrirHoja(`${cabeceraHoja(esc(s.nombre), `${s.variable ? '≈ ' : ''}${fmt(s.importe)} al mes · unos ${fmt0(s.importe * 12)} al año`)}
    <p class="texto-2" style="font-size:14px;line-height:1.5;margin-top:-6px">Se cobra cada mes hacia el día ${s.dia}${COMO[s.medio] ? `, ${COMO[s.medio]}` : ''} (${esc(c.nombre)}). ${s.activa ? `${cuando(s).charAt(0).toUpperCase() + cuando(s).slice(1)}.` : `Parece que ya no se cobra: el último fue el ${fechaCorta(s.ultimo)}.`}</p>
    ${s.antes != null ? `<p class="nota">Ha ${subida > 0 ? 'subido' : 'bajado'} de precio${desde ? ` el ${fechaCorta(desde)}` : ''}: antes eran ${fmt(s.antes)} (${fmt(Math.abs(subida) * 12)} ${subida > 0 ? 'más' : 'menos'} al año).</p>` : ''}
    ${s.variable ? '<p class="nota">Es un recibo y el importe cambia un poco de un mes a otro: se cuenta el último.</p>' : ''}
    <div>${cobros.map(t => `<div class="fila" style="padding:8px 0"><span class="cuerpo"><span class="concepto" style="font-size:14px">${fechaCorta(t.fecha)} ${t.fecha.slice(0, 4)}</span></span><span class="importe num" style="font-size:14px">${fmt(t.importe)}</span></div>`).join('')}</div>
    ${E.fijos && s.activa ? (enFijos ? '<p class="nota">Ya está en tus movimientos fijos: la previsión de fin de mes cuenta con él.</p>'
      : `<div style="display:flex;flex-direction:column;gap:8px;background:var(--fondo);border-radius:12px;padding:10px 12px">
      <span class="nota">Si lo añades a tus movimientos fijos, la previsión de fin de mes contará con él antes de que se cobre.</span>
      <button type="button" class="boton suave peq" data-accion="pago-a-fijos" data-id="${esc(s.id)}">${ic('mas')}Añadir a mis movimientos fijos</button></div>`) : ''}
    <button type="button" class="boton suave peq" data-accion="ocultar-pago" data-id="${esc(s.id)}">No es un pago de cada mes</button>`, s.nombre);
}

const buscar = (E, id) => { const p = pagosDeCadaMes(E.txs); return [...p.activas, ...p.terminadas].find(s => s.id === id); };

export const acciones = {
  'ver-pago': (ctx, el) => { const s = buscar(ctx.E, el.dataset.id); if (s) hojaPago(ctx.E, s); },
  'pago-a-fijos': (ctx, el) => {
    const s = buscar(ctx.E, el.dataset.id);
    if (s) nuevoFijo(ctx.E, { tipo: 'gasto', nombre: s.nombre, importe: s.importe, dia: s.dia, categoria: s.categoria, medio: s.medio });
  },
  'ocultar-pago': (ctx, el) => {
    const s = buscar(ctx.E, el.dataset.id);
    if (!s) return;
    guardarOcultos(ctx.E, [...ocultos(ctx.E), s.clave]);
    cerrarHoja();
    toast(`${s.nombre} ya no sale en tus pagos de cada mes`);
    ctx.pintar();
  },
  'mostrar-pagos-ocultos': (ctx) => { guardarOcultos(ctx.E, []); toast('Ya se ven todos otra vez'); ctx.pintar(); }
};
