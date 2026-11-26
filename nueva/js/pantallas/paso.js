// Dinero de paso: para qué es cada uno («Ordenador», «Dentista y luz»…), lo que está en espera y «Me lo quedo».
// Lo que llega y lo que sale para lo mismo se compensan; lo que sale sin decir para qué es de tu dinero (resta).

import { ic } from '../iconos.js';
import { esc, fmt, hoyISO, mesActual, CATEGORIAS, CUENTA_LIBERADO, bolsasPaso, propositoPaso, fechaCorta } from '../logica.js';
import { conceptoVisible } from '../componentes.js';
import { abrirHoja, cerrarHoja, cabeceraHoja, toast } from '../ui.js';
import * as D from '../datos.js';

// Categorías en las que se puede quedar lo que sobra: las de ingreso de verdad (no Bizum genérico ni el propio dinero de paso)
const CATS = CATEGORIAS.filter(c => c.tipo === 'ingreso' && !c.generica);
const buscar = (E, id) => E.txs.find(t => String(t.id) === String(id));
const bolsasHoy = E => bolsasPaso(E.txs, mesActual());
const estadoBolsa = b => b.enEspera > 0 ? `${fmt(b.enEspera)} en espera` : b.tuDinero > 0 ? `pusiste ${fmt(b.tuDinero)} de tu dinero` : 'se compensan';

// Aviso para la previsión: lo que hay en espera no cuenta (el detalle y «Me lo quedo», en «Dinero de paso» de Resumen)
export function aviso(E) {
  const espera = bolsasHoy(E).enEspera;
  if (!(espera > 0)) return '';
  return `<p class="nota" style="display:flex;gap:8px;align-items:flex-start;background:var(--fondo);border-radius:12px;padding:10px 12px">${ic('paso', 'ic-s')}<span>Tienes <b>${fmt(espera)}</b> de dinero de paso en espera: no cuentan como tuyos. Cuando salgan para lo que eran, tampoco restarán. Lo tienes en «Dinero de paso», más abajo.</span></p>`;
}

// ¿Para qué es este dinero de paso? Al marcar algo como dinero de paso (y desde su hoja, para cambiarlo)
export function preguntarPaso(ctx, t) {
  const { E } = ctx;
  if (!E.conPaso) return;
  const llega = t.tipo === 'ingreso', actual = propositoPaso(t);
  // Propósitos que siguen abiertos (con algo en espera o puesto de tu dinero) o con movimientos de los últimos 2 meses
  const hace60 = hoyISO(-60);
  const bolsas = bolsasHoy(E).bolsas.filter(b => b.nombre && (b.nombre === actual || b.saldo !== 0 || E.txs.some(x => propositoPaso(x) === b.nombre && x.fecha >= hace60)))
    .sort((a, b) => b.enEspera - a.enEspera || a.nombre.localeCompare(b.nombre));
  const fila = (nombre, detalle, valor) => `<button type="button" class="fila" data-accion="poner-paso" data-id="${esc(t.id)}" data-paso="${esc(valor)}"${valor === (actual || '') ? ' aria-current="true"' : ''}>
      <span class="ficha">${ic(valor ? 'paso' : llega ? 'info' : 'cartera')}</span>
      <span class="cuerpo"><span class="concepto">${esc(nombre)}${valor === (actual || '') ? ' ✓' : ''}</span><span class="detalle">${esc(detalle)}</span></span>${ic('derecha', 'ic-s')}</button>`;
  abrirHoja(`${cabeceraHoja(llega ? '¿Para qué es este dinero?' : '¿Con qué dinero lo pagas?', `Dinero de paso · ${esc(conceptoVisible(t))} · ${fmt(llega ? +t.importe : -t.importe, true)}`)}
    <p class="texto-2" style="font-size:14px;line-height:1.5;margin-top:-6px">${llega
      ? 'Así, cuando salga lo que pagues con él, se compensarán. Mientras tanto queda en espera y no cuenta como tuyo.'
      : 'Elige el dinero de paso del que sale. Si sale de tu dinero (por ejemplo, la parte del alquiler que va dentro de tu mensualidad), elige «De mi dinero»: se restará de lo que te entra.'}</p>
    ${bolsas.length ? `<div>${bolsas.map(b => fila(b.nombre, estadoBolsa(b), b.nombre)).join('')}</div>` : ''}
    <div class="par" style="grid-template-columns:minmax(0,1fr) auto;align-items:end">
      <label class="campo">Para algo nuevo<input type="text" id="paso-nuevo" maxlength="60" placeholder="${llega ? 'Ordenador, dentista, viaje…' : 'Cena de cumpleaños, regalo…'}"></label>
      <button type="button" class="boton peq" style="width:auto;padding:0 18px" data-accion="poner-paso-nuevo" data-id="${esc(t.id)}">Guardar</button>
    </div>
    <div>${fila(llega ? 'Todavía no lo sé' : 'De mi dinero', llega ? 'Queda en espera sin decir para qué' : 'No me lo van a dar: se resta de lo que me entra', '')}</div>`, 'Dinero de paso');
}

async function ponerPaso(ctx, id, nombre) {
  const { E } = ctx, t = buscar(E, id);
  if (!t) return;
  const paso = String(nombre || '').trim().slice(0, 60) || null;
  if (!await D.actualizarMovimientos([t.id], { paso }, 'guardar para qué es el dinero de paso')) return;
  t.paso = paso;
  cerrarHoja();
  toast(paso ? `Dinero de paso para «${paso}»` : t.tipo === 'ingreso' ? 'Queda en espera, sin decir para qué' : 'Sale de tu dinero: se resta de lo que te entra');
  ctx.pintar();
}

// Resumen: cada propósito con lo que llegó, salió y queda; lo que salió de tu dinero, aparte
export function seccion(E, ym, abierto) {
  const B = bolsasPaso(E.txs, ym);
  const bolsas = B.bolsas.filter(b => b.movs.length || b.efecto || (abierto && b.enEspera > 0))
    .sort((a, b) => (a.nombre === null) - (b.nombre === null) || b.enEspera - a.enEspera || String(a.nombre).localeCompare(String(b.nombre)));
  if (!bolsas.length && !B.deTuDinero.length) return '';
  const filaMov = t => {
    const texto = `<span>${fechaCorta(t.fecha)} · ${esc(conceptoVisible(t))}</span><span class="num${t.tipo === 'ingreso' && t.cuenta !== CUENTA_LIBERADO ? ' positivo' : ''}">${t.cuenta === CUENTA_LIBERADO ? `Te lo quedaste · ${fmt(t.importe)}` : fmt(t.tipo === 'ingreso' ? +t.importe : -t.importe, true)}</span>`;
    return E.conPaso && t.cuenta !== CUENTA_LIBERADO ? `<button type="button" data-accion="elegir-paso" data-id="${esc(t.id)}">${texto}</button>` : `<div>${texto}</div>`;
  };
  const efecto = n => n ? fmt(-n, true) : fmt(0);
  const grupo = (titulo, detalle, importe, movs, extra = '') => `<details class="cat-fila"><summary><div class="fila" style="border:none">
      <span class="ficha">${ic('paso')}</span>
      <span class="cuerpo"><span class="concepto" style="font-size:14px">${titulo}</span><span class="detalle">${detalle}</span></span>
      <span class="importe num texto-2" style="font-size:14px">${importe}</span></div></summary>
      <div class="detalle">${movs.map(filaMov).join('')}</div>${extra}</details>`;
  const textoBolsa = b => {
    const partes = [];
    if (b.llega) partes.push(`llegaron ${fmt(b.llega)}`);
    if (b.sale) partes.push(`salieron ${fmt(b.sale)}`);
    if (b.efecto > 0) partes.push(`${fmt(b.efecto)} de tu dinero: se restan`);
    else if (b.efecto < 0) partes.push(`te devolvieron ${fmt(-b.efecto)} que pusiste: se suman`);
    if (b.enEspera > 0) partes.push(`${fmt(b.enEspera)} en espera`);
    else if (!b.efecto && !b.tuDinero) partes.push('se compensan');
    const t = partes.join(' · ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const meLoQuedo = b => abierto && b.enEspera > 0 ? `<div style="padding:2px 0 10px"><button type="button" class="boton suave peq" data-accion="me-lo-quedo" data-paso="${esc(b.nombre || '')}">Me lo quedo</button></div>` : '';
  const html = bolsas.map(b => grupo(b.nombre ? esc(b.nombre) : 'Sin decir para qué', esc(textoBolsa(b)), efecto(b.efecto), b.movs,
    (!b.nombre && E.conPaso && b.movs.length ? '<p class="nota" style="padding:0 0 8px">Toca cada uno para decir para qué es: así se compensará con lo que salga para lo mismo.</p>' : '') + meLoQuedo(b))).join('')
    + (B.deTuDinero.length ? grupo('De tu dinero', `Salieron ${fmt(B.salidoTuyo)} sin decir de qué dinero de paso: se restan de lo que te entra`, efecto(B.salidoTuyo), B.deTuDinero,
      E.conPaso ? '<p class="nota" style="padding:0 0 8px">Como la parte del alquiler que va dentro de la mensualidad. Si alguno se pagó con un dinero de paso, tócalo y elige cuál.</p>' : '') : '');
  return `<section class="tarjeta" aria-label="Dinero de paso" style="gap:4px">
    <div class="fila-titulo"><h2 class="h2">Dinero de paso</h2><span class="num texto-2" style="font-size:16px;font-weight:600">${efecto(B.totalPaso)}</span></div>
    <p class="nota" style="margin-bottom:6px">No cuenta como ingreso ni como gasto: lo que llega queda en espera hasta que sale para lo mismo. Solo resta lo que sale de tu dinero.</p>
    ${html}
    ${!E.conPaso && bolsas.some(b => b.enEspera > 0) ? '<p class="nota">Para decir para qué es cada dinero de paso, hay que ejecutar en Supabase el texto <b>sql/2026-11-paso.sql</b>.</p>' : ''}
  </section>`;
}

function hojaMeLoQuedo(E, nombre) {
  const b = bolsasHoy(E).bolsas.find(x => (x.nombre || '') === nombre);
  const espera = b?.enEspera || 0;
  if (!(espera > 0)) { toast('No queda dinero de paso en espera'); return; }
  const porDefecto = CATS.find(c => c.id === 'regalo_recibido') || CATS[0];
  abrirHoja(`${cabeceraHoja('Me lo quedo', `${nombre ? `${esc(nombre)} · ` : ''}${fmt(espera)} en espera`)}
    <p class="texto-2" style="font-size:14px;line-height:1.5;margin-top:-6px">Lo que te quedes contará como ingreso de este mes y dejará de estar en espera. El dinero ya está en tu cuenta, así que «Tu dinero» no cambia.</p>
    <label class="campo">¿Cuánto te quedas? (€)<input type="number" id="quedo-importe" inputmode="decimal" step="0.01" min="0.01" max="${espera}" value="${espera}"></label>
    <label class="campo">¿Qué es para ti?<select id="quedo-categoria">${CATS.map(c => `<option value="${esc(c.id)}"${c === porDefecto ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
    <button type="button" class="boton" data-accion="guardar-me-lo-quedo" data-paso="${esc(nombre)}">Me lo quedo</button>
    <p class="nota">Si te equivocas, borra el movimiento «Me lo quedo» en Movimientos: el dinero volverá a estar en espera.</p>`, 'Me lo quedo');
}

export const acciones = {
  'elegir-paso': (ctx, el) => { const t = buscar(ctx.E, el.dataset.id); if (t) preguntarPaso(ctx, t); },
  'poner-paso': (ctx, el) => ponerPaso(ctx, el.dataset.id, el.dataset.paso),
  'poner-paso-nuevo': (ctx, el) => {
    const nombre = document.getElementById('paso-nuevo').value.trim();
    if (!nombre) { document.getElementById('paso-nuevo').focus(); toast('Escribe para qué es'); return; }
    ponerPaso(ctx, el.dataset.id, nombre);
  },
  'me-lo-quedo': (ctx, el) => hojaMeLoQuedo(ctx.E, el.dataset.paso || ''),
  'guardar-me-lo-quedo': async (ctx, el) => {
    const { E } = ctx, nombre = el.dataset.paso || '';
    const espera = bolsasHoy(E).bolsas.find(x => (x.nombre || '') === nombre)?.enEspera || 0;
    const importe = Math.round(parseFloat(document.getElementById('quedo-importe').value) * 100) / 100;
    if (!(importe > 0)) { toast('Escribe cuánto te quedas'); return; }
    if (importe > espera + 0.005) { toast(`Como mucho, ${fmt(espera)}: es lo que hay en espera`); return; }
    const cat = CATS.find(c => c.id === document.getElementById('quedo-categoria').value);
    const tx = { fecha: hoyISO(), descripcion: `Me lo quedo (${nombre || 'dinero de paso'})`, importe, tipo: 'ingreso', categoria: cat.bd, medio: 'transferencia', cuenta: CUENTA_LIBERADO };
    if (E.conPaso && nombre) tx.paso = nombre;
    const fila = await D.insertarMovimiento(tx);
    if (!fila) return;
    E.txs.push(fila);
    E.txs.sort((a, b) => b.fecha.localeCompare(a.fecha));
    cerrarHoja();
    toast(`${fmt(importe)} pasan a ser tuyos (${cat.nombre})`);
    ctx.pintar();
  }
};
