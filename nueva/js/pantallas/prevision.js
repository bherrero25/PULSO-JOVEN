// ¿Llego a fin de mes? Tarjeta de Inicio con la previsión del mes en curso y hoja que explica de dónde sale la cifra.

import { ic } from '../iconos.js';
import { esc, fmt, fmt0, nombreMes, prevision } from '../logica.js';
import { abrirHoja, cabeceraHoja } from '../ui.js';

const ESTADOS = { bien: ['bien', 'Sí, con margen'], justo: ['justo', 'Muy justo'], no: ['critica', 'A este ritmo, no'] };
const conSigno = n => `${n < 0 ? '−' : ''}${fmt0(Math.abs(n))}`;

export function tarjeta(E, pv) {
  if (!pv || pv.final == null) return '';
  const [clase, texto] = ESTADOS[pv.estado];
  const habitual = `Si sigues gastando como sueles (unos ${fmt0(pv.habitual.diario)} al día)`;
  const frase = pv.estado === 'bien' ? `${habitual}, te sobrará dinero.`
    : pv.estado === 'justo' ? `${habitual}, llegarás muy justo.`
    : pv.base > 0 ? `${habitual}, no llegas. Para llegar, gasta como mucho <b>${fmt(pv.maxDiario)} al día</b>.`
    : pv.pendientes.some(t => t.tipo === 'gasto') && pv.llevas > 0 ? 'Con lo que falta por pagar este mes, lo que gastes de más saldrá de tus ahorros.'
    : 'Este mes ya has gastado más de lo que ha entrado: lo que gastes de más saldrá de tus ahorros.';
  return `<button type="button" class="tarjeta tarjeta-boton" data-accion="ver-prevision" aria-label="¿Llegas a fin de mes? Ver cómo se calcula">
    <div class="fila-titulo"><h2 class="h2">¿Llegas a fin de mes?</h2><span class="pastilla ${clase}">${texto}</span></div>
    <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="cifra-m num${pv.final < 0 ? ' negativo' : ''}">${conSigno(pv.final)}</span><span class="nota">al acabar ${nombreMes(pv.mes, { año: false }).toLowerCase()}, más o menos</span></div>
    <span class="nota" style="font-size:13px">${frase}</span>
    <span class="enlace" style="padding:0;display:flex;align-items:center;gap:2px;font-size:13px">Ver cómo se calcula${ic('derecha', 'ic-s')}</span>
  </button>`;
}

function hoja(E) {
  const pv = prevision(E.txs, E.fijos);
  if (!pv || pv.final == null) return;
  const mes = nombreMes(pv.mes, { año: false }).toLowerCase();
  const linea = (texto, valor, fuerte) => `<div style="display:flex;justify-content:space-between;gap:10px${fuerte ? ';font-weight:600;border-top:1px solid var(--linea);padding-top:8px' : ''}"><span>${texto}</span><b class="num" style="white-space:nowrap">${valor < 0 ? '−' : fuerte ? '' : '+'}${fmt(Math.abs(valor))}</b></div>`;
  const fijos = pv.pendientes.map(t => linea(`${esc(t.descripcion)} · día ${Number(t.fecha.slice(8))}`, t.tipo === 'ingreso' ? +t.importe : -t.importe)).join('');
  const sinFijos = E.fijos && !E.fijos.length;
  abrirHoja(`${cabeceraHoja('¿Llegas a fin de mes?', `Previsión para ${mes}`)}
    <div style="background:var(--fondo);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13.5px">
      ${linea('Lo que llevas este mes (entrado − gastado)', pv.llevas)}
      ${fijos ? `<span class="nota" style="margin-bottom:-4px">Falta por llegar o pagar (tus movimientos fijos):</span>${fijos}` : ''}
      ${pv.restoDeHoy ? linea('Lo que sueles gastar y aún no has gastado hoy', -pv.restoDeHoy) : ''}
      ${pv.restantes ? linea(`Día a día hasta fin de mes: unos ${fmt(pv.habitual.diario)} × ${pv.restantes} ${pv.restantes === 1 ? 'día' : 'días'}`, -(pv.diaADia - pv.restoDeHoy)) : ''}
      ${linea(`Al acabar ${mes}, más o menos`, pv.final, true)}
    </div>
    <p class="texto-2" style="font-size:14px;line-height:1.5">${pv.base > 0
      ? `Para acabar el mes sin quedarte en negativo, puedes gastar hasta <b>${fmt(pv.maxDiario)} al día</b> (hoy incluido).`
      : pv.llevas > 0 ? 'Con lo que falta por pagar, este mes ya no te queda margen: cualquier gasto más saldrá de tus ahorros.'
      : 'Este mes ya has gastado más de lo que ha entrado: cualquier gasto más saldrá de tus ahorros.'}</p>
    <p class="nota">«Lo que sueles gastar» es tu semana típica de las últimas ${pv.habitual.semanas === 1 ? 'semana' : `${pv.habitual.semanas} semanas`} (la del medio, para que una compra grande o un pago de una vez al mes no la cambien), sin contar tus movimientos fijos, los traspasos ni el dinero de paso. Hoy solo cuenta lo que te quede por gastar.</p>
    ${sinFijos ? `<p class="nota" style="background:var(--fondo);border-radius:12px;padding:10px 12px">¿Te llega o pagas algo cada mes (mensualidad, nómina, alquiler…)? Apúntalo en tus movimientos fijos y la previsión contará con ello.</p>
      <button type="button" class="boton suave peq" data-accion="gestionar-fijos">Configurar movimientos fijos</button>` : ''}`, 'Previsión a fin de mes');
}

export const acciones = {
  'ver-prevision': (ctx) => hoja(ctx.E)
};
