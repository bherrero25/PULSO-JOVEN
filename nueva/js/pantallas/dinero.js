// Tu dinero: añadir, cambiar o quitar cuentas (efectivo, ahorro…). El saldo no cuenta como ingreso de ningún mes.

import { ic } from '../iconos.js';
import { esc, fmt, hoyISO, fechaCorta, nombreCuenta, TIPOS_CUENTA, totalCuentas, cuentasBanco } from '../logica.js';
import { abrirHoja, cerrarHoja, cabeceraHoja, toast, confirmar } from '../ui.js';
import * as D from '../datos.js';
import { filaCuenta } from './inicio.js';

function hojaCuentas(E) {
  const filas = E.cuentas.map(c => filaCuenta(c, E.txs, true, E.cuentas)).join('');
  const total = totalCuentas(E.cuentas, E.txs);
  abrirHoja(`${cabeceraHoja('Tu dinero', `${total < 0 ? '−' : ''}${fmt(total)} en total`)}
    <div>${filas}</div>
    <button type="button" class="boton suave peq" data-accion="editar-cuenta" data-id="">${ic('mas')}Añadir efectivo, ahorro u otra cuenta</button>
    <p class="nota">El saldo del banco se pone solo al importar el extracto. Lo que apuntes a mano o con Apple Pay después se suma o se resta hasta que llegue el siguiente extracto. Estos saldos no cuentan como ingresos ni gastos de ningún mes.</p>`, 'Tu dinero');
}

function hojaCuenta(E, id) {
  const c = E.cuentas.find(x => String(x.id) === String(id));
  const banco = c?.clave;
  abrirHoja(`${cabeceraHoja(c ? esc(c.nombre) : 'Nueva cuenta', c ? `Saldo a ${fechaCorta(c.fecha_saldo)}` : 'Efectivo, ahorro, otra cuenta…')}
    <label class="campo">Nombre<input type="text" id="cuenta-nombre" maxlength="40" value="${esc(c?.nombre || '')}" placeholder="Efectivo ahorrado, hucha, cuenta de ahorro…"></label>
    <div class="par">
      <label class="campo">Tipo<select id="cuenta-tipo"${banco ? ' disabled' : ''}>
        ${Object.entries(TIPOS_CUENTA).map(([k, [n]]) => `<option value="${k}"${(c?.tipo || 'efectivo') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="campo">Saldo hoy (€)<input type="number" id="cuenta-saldo" inputmode="decimal" step="0.01" value="${c ? parseFloat(c.saldo) : ''}" placeholder="0,00"></label>
    </div>
    <p class="nota">${banco ? `Es el saldo contable del extracto de ${esc(nombreCuenta(banco))}; en «Tu dinero» se le resta lo retenido y se tiene en cuenta lo que apuntes después. Se actualiza solo cada vez que importas el extracto; si lo cambias aquí, valdrá hasta la próxima importación.` : 'Es lo que tienes ahora: no cuenta como ingreso de ningún mes. Cámbialo cuando quieras.'}</p>
    <button type="button" class="boton" data-accion="guardar-cuenta" data-id="${esc(c?.id || '')}">Guardar</button>
    ${banco && cuentasBanco(E.cuentas).length > 1 ? `<button type="button" class="boton suave peq" data-accion="ver-movimientos-cuenta" data-clave="${esc(c.clave)}">${ic('lista')}Ver sus movimientos</button>` : ''}
    ${c ? `<button type="button" class="boton peligro peq" data-accion="borrar-cuenta" data-id="${esc(c.id)}">${ic('papelera')}Quitar esta cuenta</button>` : ''}`, c ? 'Cambiar cuenta' : 'Nueva cuenta');
}

// Traspaso entre tus cuentas: pregunta de qué cuenta sale el dinero (o a cuál va) y ajusta su saldo en «Tu dinero».
// Un ingreso en el banco sale de otra cuenta (se le resta); un gasto del banco va a otra cuenta (se le suma).
// Al quitar la categoría de traspaso (deshacer) se hace lo contrario. Las cuentas de banco no se tocan: las pone al día el extracto.
const saldoTexto = n => (n < 0 ? '−' : '') + fmt(n);

export function preguntarTraspaso(ctx, t, deshacer = false) {
  const { E } = ctx;
  const cuentas = (E.cuentas || []).filter(c => !c.clave);
  if (!cuentas.length) {
    if (!deshacer) toast(E.cuentas ? 'Guardado como traspaso. Para que cuente en «Tu dinero», añade esa cuenta (por ejemplo, Efectivo ahorrado)' : 'Guardado como traspaso');
    return;
  }
  const signo = (t.tipo === 'ingreso' ? -1 : 1) * (deshacer ? -1 : 1);
  const titulo = deshacer ? (signo > 0 ? '¿Devolvemos este dinero a alguna cuenta?' : '¿Lo quitamos de alguna cuenta?')
    : t.tipo === 'ingreso' ? '¿De dónde salía este dinero?' : '¿A dónde ha ido este dinero?';
  const opciones = cuentas.map(c => {
    const antes = parseFloat(c.saldo), despues = antes + signo * parseFloat(t.importe);
    const tarde = c.fecha_saldo > t.fecha;
    return `<button type="button" class="fila" data-accion="aplicar-traspaso" data-cuenta="${esc(c.id)}" data-delta="${signo * parseFloat(t.importe)}">
      <span class="ficha">${ic((TIPOS_CUENTA[c.tipo] || TIPOS_CUENTA.efectivo)[1])}</span>
      <span class="cuerpo"><span class="concepto">${esc(c.nombre)}</span>
        <span class="detalle">${saldoTexto(antes)} → <b>${saldoTexto(despues)}</b>${tarde ? ` · saldo apuntado el ${fechaCorta(c.fecha_saldo)}, después de este movimiento` : ''}</span></span>
      ${ic('derecha', 'ic-s')}</button>`;
  }).join('');
  abrirHoja(`${cabeceraHoja(titulo, 'Traspaso entre tus cuentas')}
    <p class="texto-2" style="font-size:14px;line-height:1.45;margin-top:-6px">Elige la cuenta: ${signo < 0 ? 'se le restarán' : 'se le sumarán'} <b>${fmt(t.importe)}</b> en «Tu dinero». No cuenta como ${t.tipo === 'ingreso' ? 'ingreso' : 'gasto'} del mes.</p>
    <div>${opciones}</div>
    <button type="button" class="boton suave peq" data-accion="cerrar-hoja">No cambiar «Tu dinero»</button>
    <p class="nota">Elige «No cambiar» si el saldo de esa cuenta ya lo apuntaste contando con este movimiento.</p>`, 'Traspaso entre tus cuentas');
}

export const acciones = {
  'aplicar-traspaso': async (ctx, el) => {
    const { E } = ctx;
    const c = E.cuentas.find(x => String(x.id) === el.dataset.cuenta);
    const saldo = Math.round((parseFloat(c.saldo) + parseFloat(el.dataset.delta)) * 100) / 100;
    const fila = await D.guardarCuenta({ id: c.id, nombre: c.nombre, tipo: c.tipo, saldo, fecha_saldo: hoyISO() });
    if (!fila) return;
    Object.assign(c, fila);
    cerrarHoja();
    toast(`${c.nombre}: ${saldoTexto(saldo)}`);
    ctx.pintar();
  },
  'gestionar-cuentas': (ctx) => hojaCuentas(ctx.E),
  'ver-movimientos-cuenta': (ctx, el) => {
    Object.assign(ctx.E, { filtroCuenta: el.dataset.clave, filtro: 'todos', q: '' });
    cerrarHoja();
    if (location.hash === '#/movimientos') ctx.pintar(); else location.hash = '#/movimientos';
  },
  'editar-cuenta': (ctx, el) => hojaCuenta(ctx.E, el.dataset.id),
  'guardar-cuenta': async (ctx, el) => {
    const { E } = ctx;
    const nombre = document.getElementById('cuenta-nombre').value.trim();
    const saldo = parseFloat(document.getElementById('cuenta-saldo').value);
    if (!nombre) { document.getElementById('cuenta-nombre').focus(); toast('Ponle un nombre'); return; }
    if (isNaN(saldo)) { document.getElementById('cuenta-saldo').focus(); toast('Escribe el saldo'); return; }
    const id = el.dataset.id;
    const actual = E.cuentas.find(x => String(x.id) === id);
    const fila = await D.guardarCuenta({ id, nombre, tipo: actual?.clave ? 'banco' : document.getElementById('cuenta-tipo').value, saldo, fecha_saldo: hoyISO() });
    if (!fila) return;
    E.cuentas = [...E.cuentas.filter(x => String(x.id) !== id), { ...actual, ...fila }];
    cerrarHoja();
    toast(`${nombre}: ${fmt(saldo)}`);
    ctx.pintar();
  },
  'borrar-cuenta': async (ctx, el) => {
    const { E } = ctx;
    const c = E.cuentas.find(x => String(x.id) === el.dataset.id);
    if (!await confirmar('¿Quitar esta cuenta?', `«${esc(c.nombre)}» dejará de contar en tu dinero. Tus movimientos no cambian.`, 'Quitar')) return;
    if (!await D.borrarCuenta(c.id)) return;
    E.cuentas = E.cuentas.filter(x => x !== c);
    toast('Cuenta quitada');
    ctx.pintar();
  }
};
