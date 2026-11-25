// Movimientos: lista del mes con buscador y filtros; al tocar uno se puede cambiar su categoría, fecha o forma de pago

import { ic } from '../iconos.js';
import { esc, fmt, resumenMes, porRevisar, etiquetaDia, infoCategoria, CATEGORIAS, claveConcepto, MEDIOS, BD, esGasto, esBizum } from '../logica.js';
import { selectorMes, filaMovimiento, ficha, conceptoVisible, importeMovimiento } from '../componentes.js';
import { abrirHoja, cerrarHoja, cabeceraHoja, toast, confirmar } from '../ui.js';
import * as D from '../datos.js';

const FILTROS = [['todos', 'Todos'], ['gastos', 'Gastos'], ['ingresos', 'Ingresos'], ['revisar', 'Por revisar']];

function visibles(E) {
  const q = E.q.trim().toLowerCase();
  return resumenMes(E.txs, E.mes).movs.filter(t => {
    if (q && !String(t.descripcion).toLowerCase().includes(q)) return false;
    if (E.filtro === 'gastos') return t.tipo !== 'ingreso';
    if (E.filtro === 'ingresos') return t.tipo === 'ingreso';
    if (E.filtro === 'revisar') return porRevisar(t, E.reglas);
    return true;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function render(E) {
  const nRev = resumenMes(E.txs, E.mes).movs.filter(t => porRevisar(t, E.reglas)).length;
  return `
  <header class="cabecera">
    <h1 class="titulo num">Movimientos</h1>
    ${selectorMes(E, { peq: true })}
  </header>
  <label class="buscador">${ic('buscar')}<span class="solo-lector">Buscar movimientos</span>
    <input type="search" placeholder="Buscar comercio o concepto" value="${esc(E.q)}" data-entrada="buscar" autocomplete="off">
  </label>
  <div class="chips sin-scroll" role="group" aria-label="Filtrar">
    ${FILTROS.map(([k, t]) => `<button type="button" class="chip" data-accion="filtro" data-valor="${k}" aria-pressed="${E.filtro === k}">${k === 'revisar' ? `${t} (${nRev})` : t}</button>`).join('')}
  </div>
  <div id="lista-movs" style="display:flex;flex-direction:column;gap:12px">${renderLista(E)}</div>`;
}

export function renderLista(E) {
  const lista = visibles(E);
  const gastos = lista.filter(esGasto).reduce((s, t) => s + +t.importe, 0);
  const ingresos = lista.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + +t.importe, 0);
  const cab = `<div style="display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;color:var(--texto-2)">
    <span>${lista.length} ${lista.length === 1 ? 'movimiento' : 'movimientos'}</span>
    <span class="num" style="color:var(--texto)">${fmt(-gastos, true)}</span>
    <span class="num positivo">${fmt(ingresos, true)}</span></div>`;
  if (!lista.length) return cab + `<div class="tarjeta vacio">${E.filtro === 'revisar' ? 'Todo revisado. ¡Bien!' : 'No hay movimientos con este filtro'}</div>`;
  const grupos = [];
  lista.forEach(t => {
    const g = grupos[grupos.length - 1];
    if (g && g.fecha === t.fecha) g.txs.push(t); else grupos.push({ fecha: t.fecha, txs: [t] });
  });
  return cab + grupos.map(g => `<section style="display:flex;flex-direction:column;gap:6px">
    <h2 class="grupo-dia">${etiquetaDia(g.fecha, E.mes)}</h2>
    <div class="tarjeta lista">${g.txs.map(t => filaMovimiento(t, E)).join('')}</div>
  </section>`).join('');
}

// ─── HOJA DE EDICIÓN ───
// Las categorías genéricas de Bizum no se ofrecen: el Bizum es la forma de pago, no para qué era el dinero
function opcionesCategoria(t) {
  if (t.tipo === 'liquidacion_tarjeta') return [];
  return CATEGORIAS.filter(c => c.tipo === t.tipo && !c.generica);
}

function abrirEdicion(ctx, t) {
  const { E } = ctx;
  const actual = infoCategoria(t.categoria);
  const rev = porRevisar(t, E.reglas);
  const opciones = opcionesCategoria(t);
  const imp = importeMovimiento(t);
  const bizum = esBizum(t);
  const pregunta = !rev ? esc(actual.nombre) : bizum ? (t.tipo === 'ingreso' ? '¿De qué es este Bizum?' : '¿Para qué era este Bizum?') : '¿Qué es este movimiento?';
  abrirHoja(`${cabeceraHoja(esc(conceptoVisible(t)), pregunta)}
    <span class="num texto-2" style="font-size:15px;margin-top:-8px">${imp.texto}</span>
    ${opciones.length ? `<div class="rejilla-cats">${opciones.map(c => `<button type="button" data-accion="poner-categoria" data-id="${esc(t.id)}" data-cat="${esc(c.bd)}" aria-pressed="${!rev && c.bd === t.categoria}">${ficha(c)}${esc(c.nombre)}</button>`).join('')}</div>
    <label class="casilla"><input type="checkbox" id="recordar"${bizum ? '' : ' checked'}> ${bizum ? 'Usar esta categoría siempre para los Bizum de esta persona' : 'Recordar para los próximos movimientos de este comercio'}</label>` : '<p class="nota">Es el cargo mensual de la tarjeta: sus compras ya están contadas una a una.</p>'}
    <div class="par">
      <label class="campo">Fecha<input type="date" value="${t.fecha}" data-cambio="fecha-mov" data-id="${esc(t.id)}"></label>
      <label class="campo">Forma de pago<select data-cambio="medio-mov" data-id="${esc(t.id)}">
        ${Object.entries(MEDIOS).map(([k, v]) => `<option value="${k}"${(t.medio || 'transferencia') === k ? ' selected' : ''}>${v}</option>`).join('')}
      </select></label>
    </div>
    <button type="button" class="boton peligro peq" data-accion="borrar-mov" data-id="${esc(t.id)}">${ic('papelera')}Borrar movimiento</button>`, 'Editar movimiento');
}

const buscarTx = (E, id) => E.txs.find(t => String(t.id) === String(id));

export const acciones = {
  'filtro': (ctx, el) => { ctx.E.filtro = el.dataset.valor; ctx.pintar(); },
  'ir-revisar': (ctx) => { ctx.E.filtro = 'revisar'; },
  'editar-mov': (ctx, el) => { const t = buscarTx(ctx.E, el.dataset.id); if (t) abrirEdicion(ctx, t); },

  'poner-categoria': async (ctx, el) => {
    const { E } = ctx;
    const t = buscarTx(E, el.dataset.id);
    const nueva = el.dataset.cat;
    const recordar = document.getElementById('recordar')?.checked;
    // Si se recuerda, cambian también los del mismo concepto que estaban sin clasificar o en la misma categoría
    const clave = claveConcepto(t.descripcion);
    const iguales = recordar ? E.txs.filter(x => x !== t && x.tipo === t.tipo && (x.categoria === BD.OTROS || x.categoria === t.categoria) && claveConcepto(x.descripcion) === clave) : [];
    cerrarHoja();
    if (!await D.actualizarMovimientos([t.id, ...iguales.map(x => x.id)], { categoria: nueva }, 'cambiar la categoría')) return;
    [t, ...iguales].forEach(x => { x.categoria = nueva; });
    if (recordar && await D.guardarRegla(t.descripcion, nueva)) E.reglas[clave] = nueva;
    const nombre = infoCategoria(nueva).nombre;
    toast(iguales.length ? `${nombre}: ${iguales.length + 1} movimientos cambiados. Lo recordaremos.` : recordar ? `Guardado en ${nombre}. Lo recordaremos.` : `Guardado en ${nombre}`);
    ctx.pintar();
  },

  'borrar-mov': async (ctx, el) => {
    const { E } = ctx;
    const t = buscarTx(E, el.dataset.id);
    if (!await confirmar('¿Borrar este movimiento?', `«${esc(conceptoVisible(t))}», ${fmt(t.importe)}. No se puede deshacer.`)) return;
    if (!await D.borrarMovimiento(t.id)) return;
    E.txs.splice(E.txs.indexOf(t), 1);
    toast('Movimiento borrado');
    ctx.pintar();
  }
};

export const cambios = {
  'fecha-mov': async (ctx, el) => {
    const t = buscarTx(ctx.E, el.dataset.id);
    if (!el.value || !await D.actualizarMovimientos([t.id], { fecha: el.value }, 'cambiar la fecha')) { el.value = t.fecha; return; }
    t.fecha = el.value;
    ctx.E.txs.sort((a, b) => b.fecha.localeCompare(a.fecha));
    toast('Fecha cambiada');
    ctx.pintar();
  },
  'medio-mov': async (ctx, el) => {
    const t = buscarTx(ctx.E, el.dataset.id);
    if (!await D.actualizarMovimientos([t.id], { medio: el.value }, 'cambiar la forma de pago')) { el.value = t.medio || 'transferencia'; return; }
    t.medio = el.value;
    toast('Forma de pago cambiada');
    ctx.pintar();
  }
};

export const entradas = {
  'buscar': (ctx, el) => { ctx.E.q = el.value; document.getElementById('lista-movs').innerHTML = renderLista(ctx.E); }
};
