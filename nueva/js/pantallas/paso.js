// Dinero de paso en espera: lo que ha llegado marcado como «Dinero de paso» y aún no ha salido no cuenta como ingreso.
// «Me lo quedo» pasa a ingreso la parte que al final es tuya (por ejemplo, lo que sobró de lo que te dieron para algo).

import { ic } from '../iconos.js';
import { esc, fmt, hoyISO, mesActual, resumenMes, CATEGORIAS, CUENTA_LIBERADO } from '../logica.js';
import { abrirHoja, cerrarHoja, cabeceraHoja, toast } from '../ui.js';
import * as D from '../datos.js';

// Categorías en las que se puede quedar: las de ingreso de verdad (no Bizum genérico ni el propio dinero de paso)
const CATS = CATEGORIAS.filter(c => c.tipo === 'ingreso' && !c.generica);
const enEspera = E => resumenMes(E.txs, mesActual()).enEspera;

// Aviso con el botón, para Resumen y la previsión
export function aviso(E, { conBoton = true } = {}) {
  const espera = enEspera(E);
  if (!(espera > 0)) return '';
  return `<div style="display:flex;flex-direction:column;gap:8px;background:var(--fondo);border-radius:12px;padding:10px 12px">
    <span class="nota" style="display:flex;gap:8px;align-items:flex-start">${ic('paso', 'ic-s')}<span>Tienes <b>${fmt(espera)}</b> de dinero de paso en espera. No cuentan como ingreso porque no son tuyos: cuando salgan (marcados como «Dinero de paso»), tampoco restarán. Si una parte es para ti, quédatela.</span></span>
    ${conBoton ? '<button type="button" class="boton suave peq" data-accion="me-lo-quedo">Me lo quedo</button>' : ''}
  </div>`;
}

function hoja(E) {
  const espera = enEspera(E);
  if (!(espera > 0)) { toast('No tienes dinero de paso en espera'); return; }
  const porDefecto = CATS.find(c => c.id === 'regalo_recibido') || CATS[0];
  abrirHoja(`${cabeceraHoja('Me lo quedo', `${fmt(espera)} de dinero de paso en espera`)}
    <p class="texto-2" style="font-size:14px;line-height:1.5;margin-top:-6px">Lo que te quedes contará como ingreso de este mes y dejará de estar en espera. El dinero ya está en tu cuenta, así que «Tu dinero» no cambia.</p>
    <label class="campo">¿Cuánto te quedas? (€)<input type="number" id="quedo-importe" inputmode="decimal" step="0.01" min="0.01" max="${espera}" value="${espera}"></label>
    <label class="campo">¿Qué es para ti?<select id="quedo-categoria">${CATS.map(c => `<option value="${esc(c.id)}"${c === porDefecto ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
    <button type="button" class="boton" data-accion="guardar-me-lo-quedo">Me lo quedo</button>
    <p class="nota">Si te equivocas, borra el movimiento «Me lo quedo» en Movimientos: el dinero volverá a estar en espera.</p>`, 'Me lo quedo');
}

export const acciones = {
  'me-lo-quedo': (ctx) => hoja(ctx.E),
  'guardar-me-lo-quedo': async (ctx) => {
    const { E } = ctx, espera = enEspera(E);
    const importe = Math.round(parseFloat(document.getElementById('quedo-importe').value) * 100) / 100;
    if (!(importe > 0)) { toast('Escribe cuánto te quedas'); return; }
    if (importe > espera + 0.005) { toast(`Como mucho, ${fmt(espera)}: es lo que hay en espera`); return; }
    const cat = CATS.find(c => c.id === document.getElementById('quedo-categoria').value);
    const fila = await D.insertarMovimiento({ fecha: hoyISO(), descripcion: 'Me lo quedo (dinero de paso)', importe, tipo: 'ingreso', categoria: cat.bd, medio: 'transferencia', cuenta: CUENTA_LIBERADO });
    if (!fila) return;
    E.txs.push(fila);
    E.txs.sort((a, b) => b.fecha.localeCompare(a.fecha));
    cerrarHoja();
    toast(`${fmt(importe)} pasan a ser tuyos (${cat.nombre})`);
    ctx.pintar();
  }
};
