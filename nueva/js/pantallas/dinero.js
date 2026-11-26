// Tu dinero: añadir, cambiar o quitar cuentas (efectivo, ahorro…). El saldo no cuenta como ingreso de ningún mes.

import { ic } from '../iconos.js';
import { esc, fmt, hoyISO, fechaCorta, nombreCuenta, TIPOS_CUENTA, totalCuentas, cuentasBanco, saldoDisponible, movimientosSinExtracto, gemeloEnBanco, porRevisar, infoCategoria, cuentaPrincipal, sePuedeElegirPrincipal, numeroDeClave, claveCuentaBanco, BANCOS } from '../logica.js';
import { conceptoVisible } from '../componentes.js';
import { abrirHoja, cerrarHoja, cabeceraHoja, toast, confirmar } from '../ui.js';
import * as D from '../datos.js';
import { filaCuenta } from './inicio.js';

function hojaCuentas(E) {
  const filas = E.cuentas.map(c => filaCuenta(c, E.txs, true, E.cuentas)).join('');
  const total = totalCuentas(E.cuentas, E.txs);
  abrirHoja(`${cabeceraHoja('Tu dinero', `${total < 0 ? '−' : ''}${fmt(total)} en total`)}
    <div>${filas}</div>
    <button type="button" class="boton suave peq" data-accion="editar-cuenta" data-id="">${ic('mas')}Añadir una cuenta</button>
    <p class="nota">Efectivo, ahorro o una cuenta de banco nueva. El saldo del banco se pone solo al importar el extracto. Lo que apuntes a mano o con Apple Pay después se suma o se resta hasta que llegue el siguiente extracto. Estos saldos no cuentan como ingresos ni gastos de ningún mes.</p>`, 'Tu dinero');
}

const NOTA_BANCO_NUEVA = 'Cuando subas su extracto, la app la reconocerá por estas cifras y pondrá el saldo al día. Las ves en la app de tu banco, al final del número de cuenta (IBAN). Si no las tienes a mano, sube directamente el extracto: la cuenta se crea sola.';
const NOTA_MANO = 'Es lo que tienes ahora: no cuenta como ingreso de ningún mes. Cámbialo cuando quieras.';
const NOTA_EFECTIVO = 'Es lo que tienes ahora. Lo que apuntes como gastado o recibido en efectivo (en mano) se resta o se suma solo; si cuentas tu dinero y no coincide, cámbialo aquí.';

// Con varias cuentas de banco, cada una puede ser la principal: viene elegida al apuntar a mano y recibe lo de Apple Pay
function bloquePrincipal(E, c) {
  if (cuentasBanco(E.cuentas).length < 2 || !sePuedeElegirPrincipal(E.cuentas)) return '';
  const es = cuentaPrincipal(E.cuentas)?.id === c.id;
  const texto = 'Lo que apuntes a mano vendrá marcado en esta cuenta, y los pagos de Apple Pay irán a ella.';
  return es
    ? `<div style="background:var(--fondo);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:4px;font-size:13.5px"><b style="display:flex;align-items:center;gap:6px">${ic('ok', 'ic-s')}Es tu cuenta principal</b><span class="nota">${texto}${c.principal ? '' : ' Lo es porque es la primera que añadiste; puedes elegir otra desde su hoja.'}</span></div>`
    : `<button type="button" class="boton suave peq" data-accion="hacer-principal" data-id="${esc(c.id)}">${ic('ok')}Hacerla mi cuenta principal</button><p class="nota" style="margin-top:-6px">${texto}</p>`;
}

function hojaCuenta(E, id) {
  const c = E.cuentas.find(x => String(x.id) === String(id));
  const banco = c?.clave;
  const sinExtracto = banco && !E.txs.some(t => t.cuenta === banco);
  abrirHoja(`${cabeceraHoja(c ? esc(c.nombre) : 'Nueva cuenta', c ? `Saldo a ${fechaCorta(c.fecha_saldo)}` : 'Efectivo, ahorro, una cuenta de banco…')}
    ${banco ? desglose(E, c) : ''}
    <label class="campo">Nombre<input type="text" id="cuenta-nombre" maxlength="40" value="${esc(c?.nombre || '')}" placeholder="Efectivo ahorrado, hucha, cuenta de ahorro…"></label>
    <div class="par">
      <label class="campo">Tipo<select id="cuenta-tipo" data-cambio="tipo-cuenta"${banco ? ' disabled' : ''}>
        ${Object.entries(TIPOS_CUENTA).map(([k, [n]]) => `<option value="${k}"${(c?.tipo || 'efectivo') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="campo">Saldo hoy (€)<input type="number" id="cuenta-saldo" inputmode="decimal" step="0.01" value="${c ? parseFloat(c.saldo) : ''}" placeholder="0,00"></label>
    </div>
    ${c ? '' : `<div class="par" id="cuenta-banco" hidden>
      <label class="campo">Banco<select id="cuenta-entidad">${BANCOS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
      <label class="campo">4 últimas cifras<input type="text" id="cuenta-numero" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="1234"></label>
    </div>`}
    <p class="nota" id="cuenta-nota">${!banco && (c?.tipo || 'efectivo') === 'efectivo' ? NOTA_EFECTIVO : banco ? (sinExtracto ? `Cuenta ···${esc(numeroDeClave(banco) || '')}: cuando subas su extracto, la app la reconocerá por su número y pondrá el saldo al día.` : `Es el saldo contable del extracto de ${esc(nombreCuenta(banco))}; en «Tu dinero» se le resta lo retenido y se tiene en cuenta lo que apuntes después. Se actualiza solo cada vez que importas el extracto; si lo cambias aquí, valdrá hasta la próxima importación.`) : NOTA_MANO}</p>
    <button type="button" class="boton" data-accion="guardar-cuenta" data-id="${esc(c?.id || '')}">Guardar</button>
    ${banco ? bloquePrincipal(E, c) : ''}
    ${banco && cuentasBanco(E.cuentas).length > 1 ? `<button type="button" class="boton suave peq" data-accion="ver-movimientos-cuenta" data-clave="${esc(c.clave)}">${ic('lista')}Ver sus movimientos</button>` : ''}
    ${c ? `<button type="button" class="boton peligro peq" data-accion="borrar-cuenta" data-id="${esc(c.id)}">${ic('papelera')}Quitar esta cuenta</button>` : ''}`, c ? 'Cambiar cuenta' : 'Nueva cuenta');
}

// De dónde sale la cifra de una cuenta de banco en «Tu dinero»: saldo del último extracto, menos lo retenido, más lo
// apuntado después. Lo apuntado que ya estaba en el banco (repetido) se puede quitar desde aquí.
function desglose(E, c) {
  const s = saldoDisponible(c, E.txs, E.cuentas);
  const retenidos = E.txs.filter(t => t.pendiente && t.cuenta === c.clave);
  const apuntados = movimientosSinExtracto(c, E.cuentas, E.txs);
  const linea = (texto, valor, fuerte) => `<div style="display:flex;justify-content:space-between;gap:10px${fuerte ? ';font-weight:600;border-top:1px solid var(--linea);padding-top:8px' : ''}"><span>${texto}</span><b class="num" style="white-space:nowrap">${valor < 0 ? '−' : fuerte ? '' : '+'}${fmt(valor)}</b></div>`;
  const detalle = t => {
    const g = gemeloEnBanco(t, E.txs);
    return `<div style="display:flex;flex-direction:column;gap:2px;padding-left:10px;border-left:2px solid var(--linea);font-size:12.5px;color:var(--texto-2)">
      <div style="display:flex;justify-content:space-between;gap:8px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fechaCorta(t.fecha)} · ${esc(conceptoVisible(t))}</span><span class="num" style="white-space:nowrap">${fmt(t.tipo === 'ingreso' ? +t.importe : -t.importe, true)}</span></div>
      ${g ? `<span style="color:var(--critico-texto)">Parece repetido: el banco ya tiene «${esc(conceptoVisible(g))}» del ${fechaCorta(g.fecha)}.</span>
        <button type="button" class="enlace" style="align-self:flex-start;font-size:12.5px" data-accion="quitar-repetido" data-id="${esc(t.id)}" data-gemelo="${esc(g.id)}" data-cuenta="${esc(c.id)}">Es el mismo: quitar el apuntado</button>` : ''}
    </div>`;
  };
  return `<div style="background:var(--fondo);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13.5px">
    ${linea(`${E.txs.some(t => t.cuenta === c.clave) ? 'Saldo del extracto' : 'Saldo que apuntaste'} (${fechaCorta(c.fecha_saldo)})`, s.saldo)}
    ${retenidos.length ? linea('Retenido, aún sin cobrar', -s.retenido) + retenidos.map(detalle).join('') : ''}
    ${apuntados.length ? linea('Apuntado después del extracto', s.apuntado) + apuntados.map(detalle).join('') : ''}
    ${linea('En «Tu dinero»', s.disponible, true)}
  </div>`;
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
  const opciones = opcionesAjuste(cuentas, signo * parseFloat(t.importe), t.fecha);
  abrirHoja(`${cabeceraHoja(titulo, 'Traspaso entre tus cuentas')}
    <p class="texto-2" style="font-size:14px;line-height:1.45;margin-top:-6px">Elige la cuenta: ${signo < 0 ? 'se le restarán' : 'se le sumarán'} <b>${fmt(t.importe)}</b> en «Tu dinero». No cuenta como ${t.tipo === 'ingreso' ? 'ingreso' : 'gasto'} del mes.</p>
    <div>${opciones}</div>
    <button type="button" class="boton suave peq" data-accion="cerrar-hoja">No cambiar «Tu dinero»</button>
    <p class="nota">Elige «No cambiar» si el saldo de esa cuenta ya lo apuntaste contando con este movimiento.</p>`, 'Traspaso entre tus cuentas');
}

// Cuentas entre las que elegir al ajustar un saldo, con cómo quedaría cada una. `mantener`: el ajuste no cambia la fecha
// del saldo (la del último recuento), como en lo que entra o sale en efectivo.
function opcionesAjuste(cuentas, delta, fecha, mantener = false) {
  return cuentas.map(c => {
    const antes = parseFloat(c.saldo), despues = antes + delta;
    const tarde = c.fecha_saldo > fecha;
    return `<button type="button" class="fila" data-accion="aplicar-traspaso" data-cuenta="${esc(c.id)}" data-delta="${delta}"${mantener ? ' data-mantener="1"' : ''}>
      <span class="ficha">${ic((TIPOS_CUENTA[c.tipo] || TIPOS_CUENTA.efectivo)[1])}</span>
      <span class="cuerpo"><span class="concepto">${esc(c.nombre)}</span>
        <span class="detalle">${saldoTexto(antes)} → <b>${saldoTexto(despues)}</b>${tarde ? ` · saldo apuntado el ${fechaCorta(c.fecha_saldo)}, después de este movimiento` : ''}</span></span>
      ${ic('derecha', 'ic-s')}</button>`;
  }).join('');
}

// Lo que entra o sale en efectivo (en mano) cambia tu efectivo en «Tu dinero» (las cuentas de tipo Efectivo).
// Con una sola cuenta de efectivo se ajusta sola; con varias, o si el movimiento es de antes del último saldo que apuntaste
// (quizá ya contaba con él), se pregunta. `deshacer`: al borrarlo o pasarlo al banco. `aviso`: lo que se iba a decir.
export async function ajustarEfectivo(ctx, t, deshacer = false, aviso = '') {
  const { E } = ctx;
  const unir = (...x) => x.filter(Boolean).join(' · ');
  const cuentas = (E.cuentas || []).filter(c => !c.clave && c.tipo === 'efectivo');
  if (!cuentas.length || (t.tipo !== 'ingreso' && t.tipo !== 'gasto')) {
    const pista = E.cuentas && !deshacer && t.tipo === 'ingreso' ? 'Para que cuente en «Tu dinero», añade allí tu efectivo' : '';
    if (aviso || pista) toast(unir(aviso, pista));
    return;
  }
  const delta = Math.round((t.tipo === 'ingreso' ? 1 : -1) * (deshacer ? -1 : 1) * parseFloat(t.importe) * 100) / 100;
  if (cuentas.length === 1 && t.fecha >= cuentas[0].fecha_saldo) {
    const c = cuentas[0], saldo = Math.round((parseFloat(c.saldo) + delta) * 100) / 100;
    const fila = await D.guardarCuenta({ id: c.id, nombre: c.nombre, tipo: c.tipo, saldo, fecha_saldo: c.fecha_saldo });
    if (!fila) return;
    Object.assign(c, fila);
    toast(unir(aviso, `${c.nombre}: ${saldoTexto(saldo)}`));
    ctx.pintar();
    return;
  }
  if (aviso) toast(aviso);
  const titulo = deshacer ? (delta > 0 ? '¿Lo devolvemos a tu efectivo?' : '¿Lo quitamos de tu efectivo?')
    : t.tipo === 'ingreso' ? '¿Dónde has guardado este dinero?' : '¿De dónde has sacado este dinero?';
  abrirHoja(`${cabeceraHoja(titulo, 'Tu efectivo')}
    <p class="texto-2" style="font-size:14px;line-height:1.45;margin-top:-6px">Elige la cuenta: ${delta < 0 ? 'se le restarán' : 'se le sumarán'} <b>${fmt(t.importe)}</b> en «Tu dinero».</p>
    <div>${opcionesAjuste(cuentas, delta, t.fecha, true)}</div>
    <button type="button" class="boton suave peq" data-accion="cerrar-hoja">No cambiar «Tu dinero»</button>
    <p class="nota">Elige «No cambiar» si el saldo de esa cuenta ya lo apuntaste contando con este movimiento.</p>`, 'Tu efectivo');
}

export const acciones = {
  'aplicar-traspaso': async (ctx, el) => {
    const { E } = ctx;
    const c = E.cuentas.find(x => String(x.id) === el.dataset.cuenta);
    const saldo = Math.round((parseFloat(c.saldo) + parseFloat(el.dataset.delta)) * 100) / 100;
    const fila = await D.guardarCuenta({ id: c.id, nombre: c.nombre, tipo: c.tipo, saldo, fecha_saldo: el.dataset.mantener ? c.fecha_saldo : hoyISO() });
    if (!fila) return;
    Object.assign(c, fila);
    cerrarHoja();
    toast(`${c.nombre}: ${saldoTexto(saldo)}`);
    ctx.pintar();
  },
  'gestionar-cuentas': (ctx) => hojaCuentas(ctx.E),
  // Un apuntado a mano que ya estaba en el banco: se quita, y si el del banco estaba sin clasificar, toma su categoría
  'quitar-repetido': async (ctx, el) => {
    const { E } = ctx;
    const t = E.txs.find(x => String(x.id) === el.dataset.id), g = E.txs.find(x => String(x.id) === el.dataset.gemelo);
    if (!t || !g) return;
    if (!await confirmar('¿Quitar el apuntado a mano?', `«${esc(conceptoVisible(t))}» (${fmt(t.importe)}) ya está en el banco como «${esc(conceptoVisible(g))}». Se queda el del banco${porRevisar(g, E.reglas) && !porRevisar(t, E.reglas) ? `, con la categoría ${esc(infoCategoria(t.categoria).nombre)}` : ''}.`, 'Quitar')) { hojaCuenta(E, el.dataset.cuenta); return; }
    if (porRevisar(g, E.reglas) && !porRevisar(t, E.reglas) && await D.actualizarMovimientos([g.id], { categoria: t.categoria }, 'pasar la categoría al movimiento del banco')) g.categoria = t.categoria;
    if (!await D.borrarMovimiento(t.id)) return;
    E.txs.splice(E.txs.indexOf(t), 1);
    toast('Repetido quitado');
    ctx.pintar();
    hojaCuenta(E, el.dataset.cuenta);
  },
  'ver-movimientos-cuenta': (ctx, el) => {
    Object.assign(ctx.E, { filtroCuenta: el.dataset.clave, filtro: 'todos', q: '' });
    cerrarHoja();
    if (location.hash === '#/movimientos') ctx.pintar(); else location.hash = '#/movimientos';
  },
  'editar-cuenta': (ctx, el) => hojaCuenta(ctx.E, el.dataset.id),
  'hacer-principal': async (ctx, el) => {
    const { E } = ctx;
    const c = E.cuentas.find(x => String(x.id) === el.dataset.id);
    if (!c || !await D.marcarPrincipal(c.id)) return;
    E.cuentas.forEach(x => { x.principal = x === c; });
    toast(`${c.nombre} es ahora tu cuenta principal`);
    ctx.pintar();
    hojaCuenta(E, c.id);
  },
  'guardar-cuenta': async (ctx, el) => {
    const { E } = ctx;
    const id = el.dataset.id;
    const actual = E.cuentas.find(x => String(x.id) === id);
    const tipo = actual?.clave ? 'banco' : document.getElementById('cuenta-tipo').value;
    let nombre = document.getElementById('cuenta-nombre').value.trim(), clave = null;
    const saldo = parseFloat(document.getElementById('cuenta-saldo').value);
    // Cuenta de banco nueva, añadida a mano: se reconoce por el banco y sus 4 últimas cifras
    if (!actual && tipo === 'banco') {
      const campo = document.getElementById('cuenta-numero'), fin = campo.value.replace(/\D/g, '');
      if (fin.length !== 4) { campo.focus(); toast('Escribe las 4 últimas cifras de la cuenta'); return; }
      if (cuentasBanco(E.cuentas).some(x => numeroDeClave(x.clave) === fin)) { campo.focus(); toast(`Ya tienes una cuenta que acaba en ${fin}`); return; }
      const banco = document.getElementById('cuenta-entidad').value;
      clave = claveCuentaBanco(banco, fin);
      if (!nombre && banco !== 'generico') nombre = `${BANCOS.find(([k]) => k === banco)[1]} ···${fin}`;
    }
    if (!nombre) { document.getElementById('cuenta-nombre').focus(); toast('Ponle un nombre'); return; }
    if (isNaN(saldo)) { document.getElementById('cuenta-saldo').focus(); toast('Escribe el saldo'); return; }
    const fila = await D.guardarCuenta({ id, nombre, tipo, saldo, fecha_saldo: hoyISO(), clave });
    if (!fila) return;
    E.cuentas = [...E.cuentas.filter(x => String(x.id) !== id), { ...actual, ...fila }];
    cerrarHoja();
    toast(clave ? `${nombre} añadida. Cuando subas su extracto, se pondrá al día` : `${nombre}: ${fmt(saldo)}`);
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

export const cambios = {
  // Al elegir «Banco» en una cuenta nueva se piden el banco y las 4 últimas cifras
  'tipo-cuenta': (ctx, el) => {
    const banco = el.value === 'banco', caja = document.getElementById('cuenta-banco');
    if (!caja) return;
    caja.hidden = !banco;
    document.getElementById('cuenta-nota').textContent = banco ? NOTA_BANCO_NUEVA : el.value === 'efectivo' ? NOTA_EFECTIVO : NOTA_MANO;
    document.getElementById('cuenta-nombre').placeholder = banco ? 'Cuenta nómina, cuenta joven…' : 'Efectivo ahorrado, hucha, cuenta de ahorro…';
  }
};
