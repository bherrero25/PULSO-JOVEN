// Movimientos: lista del mes con buscador y filtros; al tocar uno se puede cambiar su categoría, fecha o forma de pago

import { ic } from '../iconos.js';
import { esc, fmt, resumenMes, porRevisar, etiquetaDia, infoCategoria, CATEGORIAS, claveConcepto, MEDIOS, BD, esGasto, esIngreso, esBizum, CUENTA_MANUAL, esManual, cuentasBanco, cuentaManual, cuentaPrincipal, gemeloEnBanco, medioDe, propositoPaso, desglosar, partesDe } from '../logica.js';
import { preguntarTraspaso, ajustarEfectivo } from './dinero.js';
import { preguntarPaso } from './paso.js';
import { sePuedeDividir, resumenPartes } from './dividir.js';
import { selectorMes, filaMovimiento, ficha, conceptoVisible, importeMovimiento } from '../componentes.js';
import { abrirHoja, cerrarHoja, cabeceraHoja, toast, confirmar } from '../ui.js';
import * as D from '../datos.js';

const FILTROS = [['todos', 'Todos'], ['gastos', 'Gastos'], ['ingresos', 'Ingresos'], ['revisar', 'Por revisar']];

// Filtro por cuenta (con varias cuentas de banco): lo de esa cuenta y lo apuntado para ella; a la principal va también
// lo apuntado sin cuenta y lo de Apple Pay, como en «Tu dinero»
function deLaCuenta(E, t) {
  const f = E.filtroCuenta;
  if (!f) return true;
  if (f === 'efectivo') return t.cuenta === 'efectivo';
  if (t.cuenta === f || t.cuenta === cuentaManual(f)) return true;
  return cuentaPrincipal(E.cuentas)?.clave === f && (t.cuenta === CUENTA_MANUAL || t.cuenta === 'apple_pay');
}

function visibles(E) {
  const q = E.q.trim().toLowerCase();
  return resumenMes(E.txs, E.mes).movs.filter(t => {
    if (q && !String(t.descripcion).toLowerCase().includes(q) && !conceptoVisible(t).toLowerCase().includes(q)) return false;
    if (!deLaCuenta(E, t)) return false;
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
  ${filtroCuentas(E)}
  <div id="lista-movs" style="display:flex;flex-direction:column;gap:12px">${renderLista(E)}</div>`;
}

function filtroCuentas(E) {
  const bancos = cuentasBanco(E.cuentas);
  if (bancos.length < 2 && !E.filtroCuenta) return '';
  const op = (v, t) => `<option value="${esc(v)}"${E.filtroCuenta === v ? ' selected' : ''}>${esc(t)}</option>`;
  return `<label class="campo" style="gap:0"><span class="solo-lector">Cuenta</span><select data-cambio="filtro-cuenta" aria-label="Cuenta">
    ${op('', 'Todas las cuentas')}${bancos.map(c => op(c.clave, c.nombre)).join('')}${op('efectivo', 'Efectivo')}</select></label>`;
}

export function renderLista(E) {
  const lista = visibles(E);
  const partes = desglosar(lista); // los divididos cuentan por partes
  const gastos = partes.filter(esGasto).reduce((s, t) => s + +t.importe, 0);
  const ingresos = partes.filter(esIngreso).reduce((s, t) => s + +t.importe, 0);
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
  return CATEGORIAS.filter(c => (c.tipo === t.tipo || c.tipo === 'ambos') && !c.generica);
}

function abrirEdicion(ctx, t) {
  const { E } = ctx;
  const actual = infoCategoria(t.categoria);
  const rev = porRevisar(t, E.reglas);
  const opciones = opcionesCategoria(t);
  const imp = importeMovimiento(t);
  const bizum = esBizum(t);
  const otros = iguales(E, t).length;
  // Al clasificar algo por revisar se recuerda por defecto. Al cambiar uno que ya tenía categoría (p. ej. una transferencia
  // de casa que esta vez es dinero de paso) solo cambia ese, salvo que se marque la casilla.
  const recordarMarcado = rev && !bizum;
  const textoRecordar = bizum ? 'Usar esta categoría siempre para los Bizum de esta persona'
    : rev ? 'Recordar para los próximos movimientos de este comercio'
    : `Cambiar también ${otros ? `${otros === 1 ? 'el otro igual' : `los otros ${otros} iguales`} y ` : ''}los próximos de este concepto`;
  const pregunta = !rev ? esc(actual.nombre) : bizum ? (t.tipo === 'ingreso' ? '¿De qué es este Bizum?' : '¿Para qué era este Bizum?') : '¿Qué es este movimiento?';
  abrirHoja(`${cabeceraHoja(esc(conceptoVisible(t)), pregunta)}
    <span class="num texto-2" style="font-size:15px;margin-top:-8px">${imp.texto}</span>
    ${conceptoVisible(t) !== String(t.descripcion || '').trim() ? `<span class="nota" style="margin-top:-10px;word-break:break-word">Concepto original: ${esc(t.descripcion)}</span>` : ''}
    ${esManual(t) ? (gemeloEnBanco(t, E.txs) ? `<p class="nota" style="background:var(--fondo);border-radius:12px;padding:10px 12px"><b>¿Repetido?</b> El banco ya tiene «${esc(conceptoVisible(gemeloEnBanco(t, E.txs)))}» del ${etiquetaDia(gemeloEnBanco(t, E.txs).fecha, E.mes).toLowerCase()} con el mismo importe. Si es el mismo, borra este.</p>` : '<p class="nota">Lo apuntaste a mano. Cuando importes el extracto del banco, se juntará con su movimiento sin repetirse.</p>') : ''}
    ${t.cuenta === 'previsto' ? '<p class="nota" style="background:var(--fondo);border-radius:12px;padding:10px 12px"><b>Previsto:</b> lo ha apuntado la app por tus movimientos fijos. Cuando importes el extracto se juntará con el de verdad y se quedará con su importe. Si este mes no llega, bórralo.</p>' : ''}
    ${t.pendiente ? '<p class="nota" style="background:var(--fondo);border-radius:12px;padding:10px 12px"><b>Retenido:</b> el banco aún no lo ha cobrado del todo. Ya cuenta en tus gastos; cuando lo cobre, al importar el siguiente extracto se convertirá en el movimiento definitivo.</p>' : ''}
    ${opciones.length ? `<div class="rejilla-cats">${opciones.map(c => `<button type="button" data-accion="poner-categoria" data-id="${esc(t.id)}" data-cat="${esc(c.bd)}" aria-pressed="${!rev && c.bd === t.categoria}">${ficha(c)}${esc(c.nombre)}</button>`).join('')}</div>
    <label class="casilla"><input type="checkbox" id="recordar"${recordarMarcado ? ' checked' : ''}> <span>${esc(textoRecordar)}</span></label>
    ${!rev && !bizum ? '<p class="nota" style="margin-top:-10px">Si no la marcas, solo cambia este movimiento.</p>' : ''}` : '<p class="nota">Es el cargo mensual de la tarjeta: sus compras ya están contadas una a una.</p>'}
    <div class="par">
      <label class="campo">Fecha<input type="date" value="${t.fecha}" data-cambio="fecha-mov" data-id="${esc(t.id)}"></label>
      <label class="campo">Forma de pago<select data-cambio="medio-mov" data-id="${esc(t.id)}">
        ${Object.entries(MEDIOS).map(([k, v]) => `<option value="${k}"${medioDe(t) === k ? ' selected' : ''}>${v}</option>`).join('')}
      </select></label>
    </div>
    ${paraQue(E, t)}
    ${dondeEsta(E, t)}
    ${sePuedeDividir(E, t) ? (partesDe(t).length
      ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--fondo);border-radius:12px;padding:10px 12px;font-size:14px">
          <span><span class="nota" style="display:block">Dividido</span>${esc(resumenPartes(t))} · el resto, ${esc(infoCategoria(t.categoria).nombre)}</span>
          <button type="button" class="enlace" data-accion="dividir-mov" data-id="${esc(t.id)}">Cambiar</button></div>`
      : `<button type="button" class="boton suave peq" data-accion="dividir-mov" data-id="${esc(t.id)}">${ic('lista')}Dividir en partes</button>`) : ''}
    <button type="button" class="boton peligro peq" data-accion="borrar-mov" data-id="${esc(t.id)}">${ic('papelera')}Borrar movimiento</button>`, 'Editar movimiento');
}

// Dinero de paso: para qué es (o si sale de tu dinero), con un botón para cambiarlo
function paraQue(E, t) {
  if (!E.conPaso || t.categoria !== BD.REENVIO) return '';
  const p = propositoPaso(t);
  const texto = p ? `Para «${esc(p)}»` : t.tipo === 'gasto' ? 'De tu dinero (se resta de lo que te entra)' : 'Sin decir para qué (en espera)';
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--fondo);border-radius:12px;padding:10px 12px;font-size:14px">
    <span><span class="nota" style="display:block">Dinero de paso</span>${texto}</span>
    <button type="button" class="enlace" data-accion="elegir-paso" data-id="${esc(t.id)}">Cambiar</button></div>`;
}

// Un ingreso en efectivo apuntado a mano: ¿se quedó en mano o se metió en el banco? Si está en el banco, cuenta en
// «Tu dinero» y se junta con su movimiento al importar el extracto.
function dondeEsta(E, t) {
  if (t.tipo !== 'ingreso' || medioDe(t) !== 'efectivo' || t.categoria === BD.TRASPASO || !(t.cuenta === 'efectivo' || esManual(t))) return '';
  const bancos = cuentasBanco(E.cuentas);
  // Lo apuntado sin cuenta va a la principal; con una sola cuenta de banco no hace falta decir cuál
  const actual = t.cuenta === 'efectivo' ? 'efectivo' : bancos.length < 2 ? CUENTA_MANUAL : t.cuenta === CUENTA_MANUAL ? cuentaManual(cuentaPrincipal(bancos).clave) : t.cuenta;
  const op = (v, texto) => `<option value="${esc(v)}"${actual === v ? ' selected' : ''}>${esc(texto)}</option>`;
  const enBanco = bancos.length < 2 ? op(CUENTA_MANUAL, 'Lo metí en el banco') : bancos.map(c => op(cuentaManual(c.clave), `Lo metí en ${c.nombre}`)).join('');
  return `<label class="campo">¿Dónde está este dinero?<select data-cambio="donde-mov" data-id="${esc(t.id)}">${op('efectivo', 'Lo tengo en mano')}${enBanco}</select></label>`;
}

const buscarTx = (E, id) => E.txs.find(t => String(t.id) === String(id));
// Otros movimientos del mismo concepto que cambiarían con él si se recuerda: los que estaban sin clasificar o en su misma categoría
const iguales = (E, t) => {
  const clave = claveConcepto(t.descripcion);
  return E.txs.filter(x => x !== t && x.tipo === t.tipo && (x.categoria === BD.OTROS || x.categoria === t.categoria) && claveConcepto(x.descripcion) === clave);
};

export const acciones = {
  'filtro': (ctx, el) => { ctx.E.filtro = el.dataset.valor; ctx.pintar(); },
  'ir-revisar': (ctx) => { ctx.E.filtro = 'revisar'; },
  'editar-mov': (ctx, el) => { const t = buscarTx(ctx.E, el.dataset.id); if (t) abrirEdicion(ctx, t); },

  'poner-categoria': async (ctx, el) => {
    const { E } = ctx;
    const t = buscarTx(E, el.dataset.id);
    const nueva = el.dataset.cat;
    const anterior = t.categoria;
    // Los traspasos no se recuerdan: cada uno pregunta de qué cuenta sale el dinero
    const recordar = document.getElementById('recordar')?.checked && nueva !== BD.TRASPASO;
    // Si se recuerda, cambian también los del mismo concepto que estaban sin clasificar o en la misma categoría
    const clave = claveConcepto(t.descripcion);
    const mismos = recordar ? iguales(E, t) : [];
    cerrarHoja();
    if (!await D.actualizarMovimientos([t.id, ...mismos.map(x => x.id)], { categoria: nueva }, 'cambiar la categoría')) return;
    [t, ...mismos].forEach(x => { x.categoria = nueva; });
    if (recordar && await D.guardarRegla(t.descripcion, nueva)) E.reglas[clave] = nueva;
    const nombre = infoCategoria(nueva).nombre;
    toast(mismos.length ? `${nombre}: ${mismos.length + 1} movimientos cambiados. Lo recordaremos.` : recordar ? `Guardado en ${nombre}. Lo recordaremos.` : `Guardado en ${nombre} (solo este)`);
    ctx.pintar();
    if (nueva === BD.TRASPASO && anterior !== BD.TRASPASO) preguntarTraspaso(ctx, t);
    else if (anterior === BD.TRASPASO && nueva !== BD.TRASPASO) preguntarTraspaso(ctx, t, true);
    // Dinero de paso: para qué es (lo que llega y lo que sale para lo mismo se compensan)
    else if (nueva === BD.REENVIO && anterior !== BD.REENVIO) preguntarPaso(ctx, t);
  },

  'borrar-mov': async (ctx, el) => {
    const { E } = ctx;
    const t = buscarTx(E, el.dataset.id);
    if (!await confirmar('¿Borrar este movimiento?', `«${esc(conceptoVisible(t))}», ${fmt(t.importe)}. No se puede deshacer.`)) return;
    if (!await D.borrarMovimiento(t.id)) return;
    E.txs.splice(E.txs.indexOf(t), 1);
    ctx.pintar();
    if (t.cuenta === 'efectivo') ajustarEfectivo(ctx, t, true, 'Movimiento borrado'); // deja tu efectivo como estaba
    else toast('Movimiento borrado');
  }
};

export const cambios = {
  'filtro-cuenta': (ctx, el) => { ctx.E.filtroCuenta = el.value; ctx.pintar(); },
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
    // Lo apuntado a mano en efectivo no sale en el banco; con otra forma de pago sí, y se juntará con el extracto
    const cambios = { medio: el.value };
    if (esManual(t) && el.value === 'efectivo' && t.categoria !== BD.TRASPASO) cambios.cuenta = 'efectivo';
    else if (t.cuenta === 'efectivo' && el.value !== 'efectivo') cambios.cuenta = CUENTA_MANUAL;
    if (!await D.actualizarMovimientos([t.id], cambios, 'cambiar la forma de pago')) { el.value = t.medio || 'transferencia'; return; }
    const antes = t.cuenta;
    Object.assign(t, cambios);
    ctx.pintar();
    if (t.tipo === 'ingreso' && 'cuenta' in cambios) abrirEdicion(ctx, t); // para que aparezca (o no) «¿Dónde está este dinero?»
    // Pasar a efectivo o dejar de serlo cambia tu efectivo en «Tu dinero»
    if (antes !== t.cuenta && (antes === 'efectivo' || t.cuenta === 'efectivo')) ajustarEfectivo(ctx, t, antes === 'efectivo', 'Forma de pago cambiada');
    else toast('Forma de pago cambiada');
  },
  'donde-mov': async (ctx, el) => {
    const t = buscarTx(ctx.E, el.dataset.id);
    if (!await D.actualizarMovimientos([t.id], { cuenta: el.value }, 'cambiar dónde está el dinero')) { el.value = t.cuenta; return; }
    const antes = t.cuenta;
    t.cuenta = el.value;
    ctx.pintar();
    const aviso = el.value === 'efectivo' ? 'Cuenta como efectivo en mano' : 'Cuenta en el banco: se juntará con el extracto';
    // Del banco a la mano se suma a tu efectivo; de la mano al banco, se quita
    if (antes === 'efectivo' || el.value === 'efectivo') ajustarEfectivo(ctx, t, antes === 'efectivo', aviso);
    else toast(aviso);
  }
};

export const entradas = {
  'buscar': (ctx, el) => { ctx.E.q = el.value; document.getElementById('lista-movs').innerHTML = renderLista(ctx.E); }
};
