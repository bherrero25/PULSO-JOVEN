// Dividir un movimiento en partes con otra categoría (por ejemplo, el alquiler que viene dentro de la mensualidad, como
// dinero de paso). En la base de datos sigue siendo uno, como en el banco; las cuentas usan sus partes.

import { ic } from '../iconos.js';
import { esc, fmt, CATEGORIAS, BD, infoCategoria, partesDe, sumar, claveConcepto, propositoPaso, CUENTA_LIBERADO, CUENTA_PREVISTO } from '../logica.js';
import { ficha, conceptoVisible } from '../componentes.js';
import { abrirHoja, toast, confirmar } from '../ui.js';
import * as D from '../datos.js';

const buscar = (E, id) => E.txs.find(t => String(t.id) === String(id));
const redondo = n => Math.round(n * 100) / 100;
export const sePuedeDividir = (E, t) => E.conPartes && (t.tipo === 'gasto' || t.tipo === 'ingreso') && t.cuenta !== CUENTA_LIBERADO && t.cuenta !== CUENTA_PREVISTO && t.categoria !== BD.TRASPASO;
// Categorías para una parte: las del mismo tipo y el dinero de paso (no traspasos ni las genéricas)
const categoriasPara = t => CATEGORIAS.filter(c => (c.tipo === t.tipo || c.tipo === 'ambos') && c.bd !== BD.TRASPASO && !c.generica);
const textoParte = p => `${infoCategoria(p.categoria).nombre}${p.paso ? ` · para «${p.paso}»` : ''}`;
export const resumenPartes = t => partesDe(t).map(p => `${fmt(p.importe)} ${textoParte(p)}`).join(' + ');

// La última vez que se dividió un movimiento con el mismo concepto (la mensualidad del mes pasado), para repetirlo
const ultimaDivision = (E, t) => E.txs.filter(x => x !== t && partesDe(x).length && x.tipo === t.tipo && claveConcepto(x.descripcion) === claveConcepto(t.descripcion))
  .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

export function hojaDividir(E, t) {
  const partes = partesDe(t), total = parseFloat(t.importe), resto = redondo(total - sumar(partes));
  const cats = categoriasPara(t), porDefecto = cats.find(c => c.bd === BD.REENVIO) || cats[0];
  const propositos = [...new Set(E.txs.map(propositoPaso).filter(Boolean))].sort();
  const anterior = !partes.length && ultimaDivision(E, t);
  const repetir = anterior && sumar(partesDe(anterior)) < total + 0.005 ? anterior : null;
  const fila = (cat, texto, importe, quitar) => `<div class="fila" style="padding:8px 0">${ficha(cat, 'peq')}<span class="cuerpo"><span class="concepto" style="font-size:14px">${texto}</span></span>
      <span class="importe num" style="font-size:14px">${fmt(importe)}</span>${quitar != null ? `<button type="button" class="boton-redondo" style="width:36px;height:36px" data-accion="quitar-parte" data-id="${esc(t.id)}" data-i="${quitar}" aria-label="Quitar esta parte">${ic('cerrar', 'ic-s')}</button>` : ''}</div>`;
  abrirHoja(`<div class="hoja-cab"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="sub">${esc(conceptoVisible(t))} · ${fmt(total)}</span><h2 class="h2" style="font-size:20px">Dividir</h2></div>
      <button type="button" class="boton-redondo" data-accion="cerrar-hoja" aria-label="Cerrar">${ic('cerrar')}</button></div>
    <p class="texto-2" style="font-size:14px;line-height:1.5;margin-top:-6px">Separa una parte con otra categoría: por ejemplo, el alquiler que viene dentro de tu mensualidad, como dinero de paso. En el banco sigue siendo un solo movimiento.</p>
    ${repetir ? `<button type="button" class="boton suave peq" data-accion="repetir-division" data-id="${esc(t.id)}" data-de="${esc(repetir.id)}">${ic('ok')}Igual que la última vez: ${esc(resumenPartes(repetir))}</button>` : ''}
    <div>
      ${partes.map((p, i) => fila(infoCategoria(p.categoria), esc(textoParte(p)), p.importe, i)).join('')}
      ${fila(infoCategoria(t.categoria), `${partes.length ? 'El resto' : 'Todo'}: ${esc(infoCategoria(t.categoria).nombre)}`, resto)}
    </div>
    ${resto > 0.005 ? `<div style="display:flex;flex-direction:column;gap:10px;background:var(--fondo);border-radius:14px;padding:12px">
      <b style="font-size:14px">Separar una parte</b>
      <div class="par">
        <label class="campo">Importe (€)<input type="number" id="parte-importe" inputmode="decimal" step="0.01" min="0.01" max="${resto}" placeholder="0,00"></label>
        <label class="campo">Categoría<select id="parte-cat" data-cambio="parte-cat">${cats.map(c => `<option value="${esc(c.bd)}"${c === porDefecto ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
      </div>
      <label class="campo" id="parte-paso-campo"${porDefecto.bd === BD.REENVIO ? '' : ' hidden'}>¿Para qué es este dinero de paso?<input type="text" id="parte-paso" maxlength="60" list="propositos-paso" placeholder="Alquiler, ordenador…">
        <datalist id="propositos-paso">${propositos.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <button type="button" class="boton peq" data-accion="anadir-parte" data-id="${esc(t.id)}">Separar esta parte</button>
    </div>` : ''}
    ${partes.length ? `<button type="button" class="boton peligro peq" data-accion="quitar-division" data-id="${esc(t.id)}">${ic('papelera')}Quitar la división</button>` : ''}
    <p class="nota">Si una parte es dinero de paso, lo que salga para lo mismo (por ejemplo, el Bizum del alquiler) se compensará con ella: elige el mismo «para qué» en ese movimiento.</p>`, 'Dividir');
}

async function guardar(ctx, t, partes, aviso) {
  const nuevas = partes.length ? partes : null;
  if (!await D.actualizarMovimientos([t.id], { partes: nuevas }, 'dividir el movimiento')) return;
  t.partes = nuevas;
  toast(aviso);
  ctx.pintar();
  hojaDividir(ctx.E, t);
}

export const acciones = {
  'dividir-mov': (ctx, el) => { const t = buscar(ctx.E, el.dataset.id); if (t) hojaDividir(ctx.E, t); },
  'anadir-parte': (ctx, el) => {
    const t = buscar(ctx.E, el.dataset.id);
    const partes = partesDe(t), resto = redondo(parseFloat(t.importe) - sumar(partes));
    const importe = redondo(parseFloat(document.getElementById('parte-importe').value));
    if (!(importe > 0)) { document.getElementById('parte-importe').focus(); toast('Escribe el importe de la parte'); return; }
    if (importe > resto + 0.005) { toast(`Como mucho, ${fmt(resto)}: es lo que queda sin separar`); return; }
    const categoria = document.getElementById('parte-cat').value;
    const paso = categoria === BD.REENVIO ? document.getElementById('parte-paso').value.trim().slice(0, 60) || null : null;
    guardar(ctx, t, [...partes, { importe, categoria, paso }], `Separados ${fmt(importe)}: ${textoParte({ categoria, paso })}`);
  },
  'repetir-division': (ctx, el) => {
    const t = buscar(ctx.E, el.dataset.id), de = buscar(ctx.E, el.dataset.de);
    if (t && de) guardar(ctx, t, partesDe(de).map(p => ({ ...p })), 'Dividido igual que la última vez');
  },
  'quitar-parte': (ctx, el) => {
    const t = buscar(ctx.E, el.dataset.id);
    guardar(ctx, t, partesDe(t).filter((_, i) => i !== +el.dataset.i), 'Parte quitada');
  },
  'quitar-division': async (ctx, el) => {
    const t = buscar(ctx.E, el.dataset.id);
    if (!await confirmar('¿Quitar la división?', 'El movimiento volverá a contar entero en su categoría.', 'Quitar')) { hojaDividir(ctx.E, t); return; }
    guardar(ctx, t, [], 'División quitada');
  }
};

export const cambios = {
  // Para qué es: solo si la parte es dinero de paso
  'parte-cat': (ctx, el) => { const campo = document.getElementById('parte-paso-campo'); if (campo) campo.hidden = el.value !== BD.REENVIO; }
};
