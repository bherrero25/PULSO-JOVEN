// Resumen: gasto de los últimos meses, en qué se va, de dónde viene el dinero y la comparación con el mes anterior

import { ic } from '../iconos.js';
import { esc, fmt, fmt0, nombreMes, resumenMes, ritmoDelMes, porCategoria, gastoHastaDia, sumarMeses, mesActual, colorCategoria, fechaCorta, infoCategoria, sumar, prevision } from '../logica.js';
import * as finDeMes from './prevision.js';
import * as paso from './paso.js';
import { ficha, conceptoVisible } from '../componentes.js';
import { datosBarras, graficoBarras } from '../graficos.js';

// Los 6 meses que se ven en el gráfico: hasta el actual, o hasta el elegido si es más antiguo
function ventana(E) {
  const actual = mesActual();
  const fin = E.mes < sumarMeses(actual, -5) ? sumarMeses(E.mes, 5) : actual;
  return [5, 4, 3, 2, 1, 0].map(i => sumarMeses(fin, -i)).filter(m => m >= E.meses[0]);
}

export function render(E) {
  const R = resumenMes(E.txs, E.mes);
  const ritmo = ritmoDelMes(E.mes);
  const mes = nombreMes(E.mes, { año: false }).toLowerCase();
  const cats = porCategoria(R.gastos);
  const fuentes = porCategoria(R.ingresos);
  const anterior = sumarMeses(E.mes, -1);
  const mesAnt = nombreMes(anterior, { año: false }).toLowerCase();
  // Ingresos que se descuentan de una categoría de gasto para ver lo que de verdad ha costado (coche compartido → gasolina)
  const compensan = cat => R.ingresos.filter(t => infoCategoria(t.categoria).compensa === cat.id);

  // ¿Llego a fin de mes? (solo en el mes en curso): si hay previsión, la comparación ya no hace la suya, más simple
  const pv = ritmo.abierto ? prevision(E.txs, E.fijos) : null;
  let comparacion;
  if (ritmo.abierto) {
    const antHastaHoy = gastoHastaDia(E.txs, anterior, ritmo.dia);
    const dif = R.totalGastos - antHastaHoy;
    const aEsteRitmo = R.totalGastos / ritmo.dia * ritmo.dias;
    comparacion = (antHastaHoy > 0 ? `Vas ${fmt(Math.abs(dif))} ${dif <= 0 ? 'por debajo' : 'por encima'} de ${mesAnt} a estas alturas del mes.` : '')
      + (pv?.final != null ? '' : `${antHastaHoy > 0 ? ' ' : ''}A este ritmo acabarás ${mes} con unos ${fmt0(aEsteRitmo)} gastados.`);
  } else {
    const totalAnt = resumenMes(E.txs, anterior).totalGastos;
    const dif = R.totalGastos - totalAnt;
    comparacion = totalAnt > 0 ? `En ${mes} gastaste ${fmt(Math.abs(dif))} ${dif > 0 ? 'más' : 'menos'} que en ${mesAnt}.` : `${nombreMes(E.mes)} es el primer mes con datos.`;
  }

  return `
  <header class="cabecera"><h1 class="titulo num">Resumen</h1><span class="sub">Últimos 6 meses</span></header>
  <div class="rejilla-auto">
  ${finDeMes.apartado(E, pv)}
  <section class="tarjeta" aria-label="Gasto por mes" style="grid-column:1/-1">
    <div style="display:flex;flex-direction:column;gap:2px">
      <span class="sub">Gastado en ${mes}</span>
      <span class="cifra-m num">${fmt(R.totalGastos)}</span>
      <span class="nota">${ritmo.abierto ? `Mes en curso · hasta el día ${ritmo.dia}` : 'Mes completo'} · toca un mes para verlo</span>
    </div>
    ${graficoBarras(datosBarras(E.txs, ventana(E)), E.mes)}
  </section>

  <section class="tarjeta" aria-label="En qué se va">
    <h2 class="h2">En qué se va · ${mes}</h2>
    ${cats.length ? cats.map(g => {
      const pct = R.totalGastos ? Math.round(g.total / R.totalGastos * 100) : 0;
      const rec = compensan(g.cat), recuperado = sumar(rec), neto = g.total - recuperado;
      const devuelto = -sumar(g.txs.filter(t => t.devolucion));
      const con = [...new Set(rec.map(t => infoCategoria(t.categoria).nombre.toLowerCase()))].join(' y ');
      const movs = [...g.txs, ...rec].sort((a, b) => b.fecha.localeCompare(a.fecha));
      return `<details class="cat-fila"><summary>
        <div class="cab"><i class="cuadro" style="background:${colorCategoria(g.cat)}"></i><span class="nombre">${esc(g.cat.nombre)}</span><span class="pct">${pct} %</span><span class="imp num">${fmt(g.total)}</span></div>
        <div class="progreso" style="height:4px"><i style="width:${cats[0].total > 0 ? Math.max(0, g.total / cats[0].total * 100) : 0}%;background:${colorCategoria(g.cat)}"></i></div>
        ${devuelto ? `<span class="nota" style="display:block;margin-top:2px">Te devolvieron <b class="num positivo">${fmt(devuelto, true)}</b>: ya está descontado</span>` : ''}
        ${recuperado ? `<span class="nota" style="display:block;margin-top:2px">Recuperado con ${esc(con)} <b class="num positivo">${fmt(recuperado, true)}</b> · ${neto > 0 ? `te ha costado <b class="num" style="color:var(--texto)">${fmt(neto)}</b>` : `has recuperado ${neto < 0 ? `<b class="num positivo">${fmt(-neto)}</b> más de lo que gastaste` : 'todo lo que gastaste'}`}</span>` : ''}
      </summary>
      <div class="detalle">${movs.map(t => t.tipo === 'ingreso'
        ? `<div><span>${fechaCorta(t.fecha)} · ${esc(conceptoVisible(t))}${t.devolucion ? ' (devolución)' : ''}</span><span class="num positivo">${fmt(Math.abs(+t.importe), true)}</span></div>`
        : `<div><span>${fechaCorta(t.fecha)} · ${esc(conceptoVisible(t))}</span><span class="num">${fmt(t.importe)}</span></div>`).join('')}</div>
      </details>`;
    }).join('') : `<p class="vacio">Aún no hay gastos en ${mes}</p>`}
  </section>

  <section class="tarjeta" aria-label="De dónde viene" style="gap:4px">
    <div class="fila-titulo" style="margin-bottom:6px"><h2 class="h2">De dónde viene</h2><span class="num positivo" style="font-size:16px;font-weight:600">${fmt(R.ingresado, true)}</span></div>
    ${fuentes.length ? fuentes.map(g => `<details class="cat-fila"><summary><div class="fila" style="border:none">${ficha(g.cat)}<span class="cuerpo"><span class="concepto" style="font-size:14px">${esc(g.cat.nombre)}</span></span><span class="importe num" style="font-size:14px">${fmt(g.total)}</span></div></summary>
      <div class="detalle">${g.txs.map(t => `<div><span>${fechaCorta(t.fecha)} · ${esc(conceptoVisible(t))}</span><span class="num">${fmt(t.importe)}</span></div>`).join('')}</div></details>`).join('')
      : `<p class="vacio">Aún no ha entrado dinero en ${mes}</p>`}
    ${R.devuelto > 0 ? `<p class="nota" style="padding-top:6px">Las devoluciones (${fmt(R.devuelto)}) no cuentan aquí: restan de lo que gastaste en su categoría.</p>` : ''}
    ${R.deAhorros > 0 ? `<p class="nota" style="padding-top:6px">Además, ${ritmo.abierto ? 'has usado' : 'usaste'} ${fmt(R.deAhorros)} de tus ahorros (traspasos a tu cuenta): no cuentan como ingreso porque ya eran tuyos.</p>` : ''}
    ${R.totalPaso ? `<p class="nota" style="padding-top:6px">Ya está descontado el dinero de paso que salió de tu dinero (${fmt(-R.totalPaso, true)}): lo tienes en «Dinero de paso».</p>` : ''}
  </section>

  ${paso.seccion(E, E.mes, ritmo.abierto)}

  ${comparacion ? `<section class="tarjeta-tinta" aria-label="Comparación" style="flex-direction:row;align-items:flex-start;gap:12px;padding:16px">
    <span class="ficha" style="background:var(--tinta-2);color:var(--lima)">${ic('tendencia')}</span>
    <span style="font-size:14px;line-height:1.45">${comparacion}</span>
  </section>` : ''}
  </div>`;
}

// Qué ha pasado con el dinero de paso del mes: lo que llega espera a salir; solo cuenta lo que sale con tu dinero
// (se resta) o lo que te devuelven de eso (se suma)
function textoPaso(R) {
  const partes = [];
  if (R.pasoLlega) partes.push(`llegaron ${fmt(R.pasoLlega)}`);
  if (R.pasoSale) partes.push(`salieron ${fmt(R.pasoSale)}`);
  if (R.totalPaso > 0) partes.push(`${fmt(R.totalPaso)} con tu dinero: se restan`);
  else if (R.totalPaso < 0) partes.push(`te devolvieron ${fmt(-R.totalPaso)} que pusiste: se suman`);
  if (R.enEspera > 0) partes.push(`${fmt(R.enEspera)} en espera`);
  else if (!R.totalPaso && R.pasoLlega + R.pasoSale > 0) partes.push('se compensan');
  const t = partes.join(' · ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const acciones = {
  'elegir-mes': (ctx, el) => { ctx.E.mes = el.dataset.valor; ctx.pintar(); }
};
