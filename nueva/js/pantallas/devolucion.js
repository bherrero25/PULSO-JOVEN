// Devoluciones: un ingreso que te devuelve un gasto (tu parte de la cena, una devolución en una tienda) se guarda con la
// categoría de ese gasto y resta de lo gastado en ella, en vez de contar como ingreso.

import { esc, fmt, CATEGORIAS, BD, infoCategoria } from '../logica.js';
import { ficha, conceptoVisible } from '../componentes.js';
import { abrirHoja, cabeceraHoja } from '../ui.js';

export const DEVOLUCION = '🤝 Devolución';
// Categorías de gasto de las que puede ser una devolución (no Otros ni las genéricas)
const CATS = CATEGORIAS.filter(c => c.tipo === 'gasto' && !c.generica && c.bd !== BD.OTROS && c.id !== 'cargo_tarjeta');

// ¿De qué gasto es esta devolución? Los botones guardan con «poner-categoria» (la misma acción que la hoja del movimiento)
export function preguntarDevolucion(ctx, t, recordar = false) {
  abrirHoja(`${cabeceraHoja('¿De qué gasto es la devolución?', `${esc(conceptoVisible(t))} · ${fmt(+t.importe, true)}`)}
    <p class="texto-2" style="font-size:14px;line-height:1.5;margin-top:-6px">No contará como ingreso: se restará de lo que gastaste en esa categoría (por ejemplo, tu parte de la cena que te devuelve un amigo, en Ocio).</p>
    <div class="rejilla-cats">${CATS.map(c => `<button type="button" data-accion="poner-categoria" data-id="${esc(t.id)}" data-cat="${esc(c.bd)}" data-sub="1" aria-pressed="${c.bd === t.categoria}">${ficha(c)}${esc(c.nombre)}</button>`).join('')}</div>
    <label class="casilla"><input type="checkbox" id="recordar"${recordar ? ' checked' : ''}> <span>Recordar para los próximos movimientos de este concepto</span></label>
    <button type="button" class="boton suave peq" data-accion="poner-categoria" data-id="${esc(t.id)}" data-cat="${esc(DEVOLUCION)}" data-sub="1">No sé de qué gasto es (contará como ingreso)</button>`, 'Devolución');
}

// Texto de la categoría de un movimiento: «Devolución · Ocio» si es una devolución
export const nombreDevolucion = t => `Devolución · ${infoCategoria(t.categoria).nombre}`;
