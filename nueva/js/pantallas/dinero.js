// Tu dinero: añadir, cambiar o quitar cuentas (efectivo, ahorro…). El saldo no cuenta como ingreso de ningún mes.

import { ic } from '../iconos.js';
import { esc, fmt, hoyISO, fechaCorta, nombreCuenta, TIPOS_CUENTA, totalCuentas } from '../logica.js';
import { abrirHoja, cerrarHoja, cabeceraHoja, toast, confirmar } from '../ui.js';
import * as D from '../datos.js';
import { filaCuenta } from './inicio.js';

function hojaCuentas(E) {
  const filas = E.cuentas.map(c => filaCuenta(c, E.txs, true)).join('');
  const total = totalCuentas(E.cuentas, E.txs);
  abrirHoja(`${cabeceraHoja('Tu dinero', `${total < 0 ? '−' : ''}${fmt(total)} en total`)}
    <div>${filas}</div>
    <button type="button" class="boton suave peq" data-accion="editar-cuenta" data-id="">${ic('mas')}Añadir efectivo, ahorro u otra cuenta</button>
    <p class="nota">El saldo del banco se pone solo al importar el extracto. Estos saldos no cuentan como ingresos ni gastos de ningún mes.</p>`, 'Tu dinero');
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
    <p class="nota">${banco ? `Es el saldo contable del extracto de ${esc(nombreCuenta(banco))}; en «Tu dinero» se le resta lo retenido. Se actualiza solo cada vez que importas el extracto; si lo cambias aquí, valdrá hasta la próxima importación.` : 'Es lo que tienes ahora: no cuenta como ingreso de ningún mes. Cámbialo cuando quieras.'}</p>
    <button type="button" class="boton" data-accion="guardar-cuenta" data-id="${esc(c?.id || '')}">Guardar</button>
    ${c ? `<button type="button" class="boton peligro peq" data-accion="borrar-cuenta" data-id="${esc(c.id)}">${ic('papelera')}Quitar esta cuenta</button>` : ''}`, c ? 'Cambiar cuenta' : 'Nueva cuenta');
}

export const acciones = {
  'gestionar-cuentas': (ctx) => hojaCuentas(ctx.E),
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
