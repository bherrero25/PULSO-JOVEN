// Gráficos hechos con HTML: barras apiladas por categoría y mes

import { esc, fmt, fmt0, nombreMes, resumenMes, SERIES_GRAFICO, GRIS, infoCategoria } from './logica.js';

// Escala con valores redondos: como mucho 4 líneas de referencia
function escala(max) {
  const paso = [25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].find(p => max / p <= 4) || 10000;
  return { paso, tope: Math.max(paso, Math.ceil(max / paso) * paso) };
}

// Gasto de cada mes repartido en las 7 categorías con color propio y «Resto» en gris
export function datosBarras(txs, meses) {
  return meses.map(ym => {
    const fila = Object.fromEntries([...SERIES_GRAFICO.map(c => [c.bd, 0]), ['resto', 0]]);
    resumenMes(txs, ym).gastos.forEach(t => {
      const c = infoCategoria(t.categoria);
      fila[c.color ? c.bd : 'resto'] += parseFloat(t.importe);
    });
    return { ym, fila, total: Object.values(fila).reduce((s, n) => s + n, 0) };
  });
}

export function graficoBarras(datos, seleccionado) {
  const { paso, tope } = escala(Math.max(1, ...datos.map(d => d.total)));
  const lineas = [];
  for (let v = 0; v <= tope; v += paso) lineas.push(v);
  const series = [...SERIES_GRAFICO.map(c => ({ clave: c.bd, nombre: c.nombre, color: c.color })), { clave: 'resto', nombre: 'Resto', color: GRIS }];
  return `<div class="grafico-barras">
    <div class="rejilla" aria-hidden="true">${lineas.map(v => `<div class="${v === 0 ? 'base' : ''}" style="bottom:${v / tope * 100}%"></div><span style="bottom:${v / tope * 100}%">${fmt0(v)}</span>`).join('')}</div>
    <div class="columnas">${datos.map(d => `
      <button type="button" class="col" data-accion="elegir-mes" data-valor="${d.ym}" aria-pressed="${d.ym === seleccionado}" aria-label="${nombreMes(d.ym)}: ${fmt(d.total)}">
        <span class="pila">${series.filter(s => d.fila[s.clave] > 0).map(s =>
          `<span style="height:calc(${(d.fila[s.clave] / tope * 100).toFixed(2)}% - 2px);background:${s.color}" title="${esc(s.nombre)}: ${fmt(d.fila[s.clave])}"></span>`).join('')}</span>
        <span class="mes">${nombreMes(d.ym, { corto: true })}</span>
      </button>`).join('')}
    </div>
  </div>
  <div class="leyenda">${series.map(s => `<span><i class="cuadro" style="background:${s.color}"></i>${esc(s.nombre)}</span>`).join('')}</div>`;
}
