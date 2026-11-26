// Piezas que se repiten en varias pantallas

import { ic } from './iconos.js';
import { esc, fmt, infoCategoria, tinteCategoria, porRevisar, esPaso, esTraspaso, formaDePago, nombreMes, mesActual, cuentasBanco, esManual, destinoManual, nombreLimpio, partesDe, esDevolucion } from './logica.js';

const ENLACES = [
  ['inicio', 'Inicio', 'inicio'],
  ['movimientos', 'Movimientos', 'lista'],
  ['resumen', 'Resumen', 'grafico'],
  ['presupuesto', 'Presupuesto', 'quesito'],
  ['metas', 'Metas', 'bandera'],
  ['inversion', 'Inversión', 'tendencia']
];
const PLANES = ['presupuesto', 'metas', 'inversion'];
const actual = (E, p) => E.pantalla === p ? ' aria-current="page"' : '';

export function barraInferior(E) {
  const planes = PLANES.includes(E.pantalla) ? ' aria-current="page"' : '';
  return `<nav class="barra" aria-label="Principal">
    <a href="#/inicio"${actual(E, 'inicio')}>${ic('inicio')}Inicio</a>
    <a href="#/movimientos"${actual(E, 'movimientos')}>${ic('lista')}Movimientos</a>
    <a href="#/anadir" class="mas" aria-label="Añadir movimiento">${ic('mas')}</a>
    <a href="#/resumen"${actual(E, 'resumen')}>${ic('grafico')}Resumen</a>
    <a href="#/presupuesto"${planes}>${ic('diana')}Planes</a>
  </nav>`;
}

export function menuLateral(E, nRevisar) {
  return `<aside class="lateral">
    ${marca()}
    <a href="#/anadir" class="boton lima peq">${ic('mas')}Añadir movimiento</a>
    <nav aria-label="Principal">
      ${ENLACES.map(([p, t, i]) => `<a href="#/${p}"${actual(E, p)}>${ic(i)}${t}${p === 'movimientos' && nRevisar ? `<span class="contador">${nRevisar}</span>` : ''}</a>`).join('')}
    </nav>
    <div class="pie">
      <button type="button" class="avatar" data-accion="cuenta" aria-label="Tu cuenta">${esc(inicial(E))}</button>
      <span style="font-size:14px;font-weight:500">${esc(E.nombre)}</span>
    </div>
  </aside>`;
}

export const marca = () => `<div class="marca"><span class="logo"><i></i></span><b>Pulso Joven</b></div>`;
export const inicial = E => (E.nombre || '?').charAt(0).toUpperCase();

export function selectorMes(E, { peq = false } = {}) {
  const primero = E.meses[0];
  return `<div class="selector-mes${peq ? ' peq' : ''}">
    <button type="button" data-accion="mes-anterior" aria-label="Mes anterior"${E.mes <= primero ? ' disabled' : ''}>${ic('izquierda')}</button>
    <span class="num">${nombreMes(E.mes)}</span>
    <button type="button" data-accion="mes-siguiente" aria-label="Mes siguiente"${E.mes >= mesActual() ? ' disabled' : ''}>${ic('derecha')}</button>
  </div>`;
}

export const ficha = (cat, clase = '') => `<span class="ficha ${clase}" style="background:${tinteCategoria(cat)}">${ic(cat.icono, clase.includes('peq') ? 'ic-s' : '')}</span>`;

// Lo que se enseña de un movimiento: el nombre limpio (el concepto original del banco se ve al abrirlo)
export const conceptoVisible = t => nombreLimpio(t);

export function importeMovimiento(t) {
  if (t.tipo === 'liquidacion_tarjeta') return { texto: '≈ ' + fmt(t.importe), clase: '' };
  if (esPaso(t)) return { texto: '↩ ' + fmt(t.importe), clase: '' };
  if (esTraspaso(t)) return { texto: '⇄ ' + fmt(t.importe), clase: '' };
  return t.tipo === 'ingreso' ? { texto: fmt(t.importe, true), clase: 'positivo' } : { texto: fmt(-t.importe, true), clase: '' };
}

// Con varias cuentas de banco, el nombre de la cuenta del movimiento
export function cuentaDeMovimiento(t, E) {
  const bancos = cuentasBanco(E.cuentas);
  if (bancos.length < 2) return '';
  const clave = esManual(t) ? destinoManual(t) : t.cuenta;
  return bancos.find(c => c.clave === clave)?.nombre || '';
}

export function filaMovimiento(t, E, detalle) {
  const cat = infoCategoria(t.categoria);
  const cuenta = cuentaDeMovimiento(t, E);
  const rev = porRevisar(t, E.reglas);
  const imp = importeMovimiento(t);
  return `<button type="button" class="fila" data-accion="editar-mov" data-id="${esc(t.id)}">
    ${rev ? `<span class="ficha revisar">${ic('alerta')}</span>` : ficha(cat)}
    <span class="cuerpo"><span class="concepto">${esc(conceptoVisible(t))}</span>
      <span class="detalle${rev ? ' revisar' : ''}">${rev ? `Sin categoría · toca para elegir${cuenta ? ` · ${esc(cuenta)}` : ''}` : esc(detalle ?? `${esDevolucion(t) ? `Devolución · ${cat.nombre}` : cat.nombre}${partesDe(t).length ? ' y más (dividido)' : ''} · ${formaDePago(t)}${cuenta ? ` · ${cuenta}` : ''}`)}${t.pendiente ? ' <span class="retenido">Retenido</span>' : ''}${t.cuenta === 'previsto' ? ' <span class="retenido">Previsto</span>' : ''}</span></span>
    <span class="importe num ${imp.clase}">${imp.texto}</span>
  </button>`;
}

export function barraPresupuesto(p, ritmo) {
  const color = p.estado === 'superado' ? 'var(--critico)' : p.estado === 'cuidado' ? 'var(--aviso)' : 'var(--tinta)';
  return `<div class="progreso"><i style="width:${Math.min(p.pct, 100)}%;background:${color}"></i>${ritmo.abierto ? `<span class="marca-ritmo" style="left:${ritmo.dia / ritmo.dias * 100}%" title="Dónde deberías ir hoy"></span>` : ''}</div>`;
}
export const textoEstado = p => p.estado === 'superado' ? `Superado · ${p.pct} %` : p.estado === 'cuidado' ? `Cuidado · ${p.pct} %` : `${p.pct} %`;

export function segmentoPlanes(E) {
  return `<nav class="segmentado" aria-label="Planes">
    <a href="#/presupuesto"${actual(E, 'presupuesto')}>Presupuesto</a>
    <a href="#/metas"${actual(E, 'metas')}>Metas</a>
    <a href="#/inversion"${actual(E, 'inversion')}>Inversión</a>
  </nav>`;
}
