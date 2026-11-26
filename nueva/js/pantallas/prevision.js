// ¿Llego a fin de mes? Una línea en el balance de Inicio (que lleva a Resumen) y el apartado completo, con el desglose,
// arriba del Resumen. Solo en el mes en curso y cuando hay datos para saber lo que sueles gastar.

import { ic } from '../iconos.js';
import { esc, fmt, fmt0, nombreMes } from '../logica.js';
import * as paso from './paso.js';

const ESTADOS = { bien: ['bien', 'Sí, con margen'], justo: ['justo', 'Muy justo'], no: ['critica', 'A este ritmo, no'] };
const conSigno = n => `${n < 0 ? '−' : ''}${fmt0(Math.abs(n))}`;

// Inicio: una sola línea dentro del balance, en lugar de «Has gastado el X % de lo que ha entrado»
export function lineaInicio(pv) {
  if (!pv || pv.final == null) return '';
  const color = { bien: 'var(--lima)', justo: 'var(--aviso)', no: 'var(--critico)' }[pv.estado];
  const texto = { bien: 'con margen', justo: 'muy justo', no: 'a este ritmo no llegas' }[pv.estado];
  return `<a href="#/resumen" class="linea-prevision" aria-label="Previsión a fin de mes: ${conSigno(pv.final)}, ${texto}. Ver el detalle en Resumen">
    <span class="punto" style="background:${color}"></span><span>A fin de mes: <b class="num">≈ ${conSigno(pv.final)}</b> · ${texto}</span>${ic('derecha', 'ic-s')}</a>`;
}

// Resumen: la cifra, el semáforo, qué hacer y de dónde sale
export function apartado(E, pv) {
  if (!pv || pv.final == null) return '';
  const [clase, texto] = ESTADOS[pv.estado];
  const mes = nombreMes(pv.mes, { año: false }).toLowerCase();
  const habitual = `Si sigues gastando como sueles (unos ${fmt0(pv.habitual.diario)} al día)`;
  const frase = pv.estado === 'bien' ? `${habitual}, te sobrará dinero.` : pv.estado === 'justo' ? `${habitual}, llegarás muy justo.` : `${habitual}, no llegas.`;
  const consejo = pv.base > 0 ? `Para acabar el mes sin quedarte en negativo, puedes gastar hasta <b>${fmt(pv.maxDiario)} al día</b> (hoy incluido).`
    : pv.llevas > 0 ? 'Con lo que falta por pagar, este mes ya no te queda margen: lo que gastes de más saldrá de tus ahorros.'
    : 'Este mes ya has gastado más de lo que ha entrado: lo que gastes de más saldrá de tus ahorros.';
  const linea = (txt, valor, fuerte) => `<div style="display:flex;justify-content:space-between;gap:10px${fuerte ? ';font-weight:600;border-top:1px solid var(--linea);padding-top:8px' : ''}"><span>${txt}</span><b class="num" style="white-space:nowrap">${valor < 0 ? '−' : fuerte ? '' : '+'}${fmt(Math.abs(valor))}</b></div>`;
  const fijos = pv.pendientes.map(t => linea(`${esc(t.descripcion)} · día ${Number(t.fecha.slice(8))}`, t.tipo === 'ingreso' ? +t.importe : -t.importe)).join('');
  const sinFijos = E.fijos && !E.fijos.length;
  return `<section class="tarjeta" aria-label="¿Llegas a fin de mes?" style="grid-column:1/-1">
    <div class="fila-titulo"><h2 class="h2">¿Llegas a fin de mes?</h2><span class="pastilla ${clase}">${texto}</span></div>
    <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:-4px"><span class="cifra-m num${pv.final < 0 ? ' negativo' : ''}">${conSigno(pv.final)}</span><span class="nota">al acabar ${mes}, más o menos</span></div>
    <p class="texto-2" style="font-size:14px;line-height:1.5">${frase} ${consejo}</p>
    <div style="background:var(--fondo);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13.5px">
      ${linea('Lo que llevas este mes (entrado − gastado)', pv.llevas)}
      ${fijos ? `<span class="nota" style="margin-bottom:-4px">Falta por llegar o pagar (tus movimientos fijos):</span>${fijos}` : ''}
      ${pv.restoDeHoy ? linea('Lo que sueles gastar y aún no has gastado hoy', -pv.restoDeHoy) : ''}
      ${pv.restantes ? linea(`Día a día hasta fin de mes: unos ${fmt(pv.habitual.diario)} × ${pv.restantes} ${pv.restantes === 1 ? 'día' : 'días'}`, -(pv.diaADia - pv.restoDeHoy)) : ''}
      ${linea(`Al acabar ${mes}, más o menos`, pv.final, true)}
    </div>
    ${paso.aviso(E)}
    <p class="nota">«Lo que sueles gastar» es tu semana típica de las últimas ${pv.habitual.semanas === 1 ? 'semana' : `${pv.habitual.semanas} semanas`} (la del medio, para que una compra grande o un pago de una vez al mes no la cambien), sin contar tus movimientos fijos, los traspasos ni el dinero de paso.</p>
    ${sinFijos ? `<div style="display:flex;flex-direction:column;gap:8px;background:var(--fondo);border-radius:12px;padding:10px 12px">
      <span class="nota">¿Te llega o pagas algo cada mes (mensualidad, nómina, alquiler…)? Apúntalo en tus movimientos fijos y la previsión contará con ello.</span>
      <button type="button" class="boton suave peq" data-accion="gestionar-fijos">Configurar movimientos fijos</button></div>` : ''}
  </section>`;
}
