// Movimientos fijos: lo que llega o sale cada mes más o menos igual (mensualidad, nómina, beca, alquiler…).
// Cada persona apunta los suyos; el día que toca, la app crea un movimiento «previsto» que se junta con el real al importar el extracto.

import { ic } from '../iconos.js';
import { esc, fmt, fechaCorta, CATEGORIAS, MEDIOS, infoCategoria, ultimaFechaFijo, proximaFechaFijo } from '../logica.js';
import { ficha } from '../componentes.js';
import { abrirHoja, cabeceraHoja, toast, confirmar } from '../ui.js';
import * as D from '../datos.js';

// Categorías que tiene sentido repetir cada mes (sin las genéricas, el dinero de paso ni los traspasos)
const categoriasFijo = tipo => CATEGORIAS.filter(c => c.tipo === tipo && !c.generica && c.id !== 'cargo_tarjeta');
const PORDEFECTO = { ingreso: { categoria: '💰 Mensualidad', nombre: 'Mensualidad, nómina, beca…' }, gasto: { categoria: '🏠 Alquiler', nombre: 'Alquiler, gimnasio, móvil…' } };

let borrador = null;

export function hojaFijos(E) {
  if (!E.fijos) {
    abrirHoja(`${cabeceraHoja('Falta un paso en la base de datos')}
      <p class="texto-2" style="font-size:14px;line-height:1.5">Para usar los movimientos fijos hay que ejecutar una vez en Supabase el texto <b>sql/2026-11-fijos.sql</b> del proyecto. Cuando esté, vuelve aquí.</p>`, 'Falta un paso');
    return;
  }
  const filas = E.fijos.map(f => {
    const c = infoCategoria(f.categoria);
    return `<button type="button" class="fila" data-accion="editar-fijo" data-id="${esc(f.id)}">${ficha(c)}
      <span class="cuerpo"><span class="concepto">${esc(f.nombre)}</span><span class="detalle">${esc(c.nombre)} · día ${f.dia} · el próximo, ${fechaCorta(proximaFechaFijo(f))}</span></span>
      <span class="importe num${f.tipo === 'ingreso' ? ' positivo' : ''}">${fmt(f.tipo === 'ingreso' ? +f.importe : -f.importe, true)}</span></button>`;
  }).join('');
  abrirHoja(`${cabeceraHoja('Movimientos fijos', 'Se apuntan solos cada mes')}
    ${filas ? `<div>${filas}</div>` : '<p class="texto-2" style="font-size:14px;line-height:1.5">Apunta lo que te llega o pagas cada mes más o menos igual: la mensualidad, la nómina, una beca, el alquiler… Así lo tendrás en cuenta desde el primer día, sin esperar al extracto.</p>'}
    <button type="button" class="boton${filas ? ' suave' : ''} peq" data-accion="editar-fijo" data-id="">${ic('mas')}Añadir movimiento fijo</button>
    <p class="nota">El día que toca se apunta como «previsto». Cuando subas el extracto del banco se juntará con el de verdad y se quedará con su importe, aunque haya cambiado un poco.</p>`, 'Movimientos fijos');
}

function hojaFijo(E) {
  const b = borrador, existe = !!b.id;
  const opciones = categoriasFijo(b.tipo);
  const boton = (k, t) => `<button type="button" data-accion="tipo-fijo" data-valor="${k}" aria-pressed="${b.tipo === k}">${t}</button>`;
  abrirHoja(`${cabeceraHoja(existe ? esc(b.nombre) : 'Nuevo movimiento fijo', existe ? 'Movimiento fijo' : 'Se apuntará solo cada mes')}
    <div class="tipo" role="group" aria-label="Tipo">${boton('ingreso', 'Me llega')}${boton('gasto', 'Pago')}</div>
    <label class="campo">Nombre<input type="text" id="fijo-nombre" maxlength="60" value="${esc(b.nombre)}" placeholder="${PORDEFECTO[b.tipo].nombre}"></label>
    <div class="par">
      <label class="campo">Importe (€)<input type="number" id="fijo-importe" inputmode="decimal" step="0.01" min="0" value="${b.importe || ''}" placeholder="0,00"></label>
      <label class="campo">Día del mes<input type="number" id="fijo-dia" inputmode="numeric" min="1" max="31" value="${b.dia || ''}" placeholder="1–31"></label>
    </div>
    <div class="par">
      <label class="campo">Categoría<select id="fijo-categoria">${opciones.map(c => `<option value="${esc(c.bd)}"${c.bd === b.categoria ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
      <label class="campo">Forma de pago<select id="fijo-medio">${Object.entries(MEDIOS).map(([k, v]) => `<option value="${k}"${(b.medio || 'transferencia') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <p class="nota">Si el mes no tiene ese día (por ejemplo, el 31), se apunta el último. Lo que llega en los 3 últimos días del mes cuenta para el siguiente, como la mensualidad.</p>
    <button type="button" class="boton" data-accion="guardar-fijo">Guardar</button>
    ${existe ? `<button type="button" class="boton peligro peq" data-accion="borrar-fijo">${ic('papelera')}Quitar este movimiento fijo</button>` : ''}`, existe ? 'Cambiar movimiento fijo' : 'Nuevo movimiento fijo');
}

// Lo escrito en el formulario, para no perderlo al cambiar entre «Me llega» y «Pago»
function leerFormulario() {
  const v = id => document.getElementById(id)?.value;
  Object.assign(borrador, { nombre: v('fijo-nombre').trim(), importe: v('fijo-importe'), dia: v('fijo-dia'), categoria: v('fijo-categoria'), medio: v('fijo-medio') });
}

export const acciones = {
  'gestionar-fijos': (ctx) => hojaFijos(ctx.E),
  'editar-fijo': (ctx, el) => {
    const f = ctx.E.fijos.find(x => String(x.id) === el.dataset.id);
    borrador = f ? { ...f } : { tipo: 'ingreso', nombre: '', importe: '', dia: '', categoria: PORDEFECTO.ingreso.categoria, medio: 'transferencia' };
    hojaFijo(ctx.E);
  },
  'tipo-fijo': (ctx, el) => {
    leerFormulario();
    if (borrador.tipo === el.dataset.valor) return;
    borrador.tipo = el.dataset.valor;
    if (!categoriasFijo(borrador.tipo).some(c => c.bd === borrador.categoria)) borrador.categoria = PORDEFECTO[borrador.tipo].categoria;
    hojaFijo(ctx.E);
  },
  'guardar-fijo': async (ctx) => {
    const { E } = ctx;
    leerFormulario();
    const b = borrador, importe = parseFloat(String(b.importe).replace(',', '.')), dia = parseInt(b.dia, 10);
    if (!b.nombre) { document.getElementById('fijo-nombre').focus(); toast('Ponle un nombre'); return; }
    if (!(importe > 0)) { document.getElementById('fijo-importe').focus(); toast('Escribe el importe'); return; }
    if (!(dia >= 1 && dia <= 31)) { document.getElementById('fijo-dia').focus(); toast('El día tiene que ser del 1 al 31'); return; }
    // Uno nuevo empieza a contar desde la última vez que tocaba: lo de antes ya está apuntado o llegará con el extracto
    const datos = { ...b, importe, dia, ultimo: b.ultimo || ultimaFechaFijo({ dia }) };
    const fila = await D.guardarFijo(datos);
    if (!fila) return;
    E.fijos = [...E.fijos.filter(x => String(x.id) !== String(b.id)), { ...datos, ...fila }];
    toast(`${b.nombre}: el próximo se apuntará el ${fechaCorta(proximaFechaFijo(fila))}`);
    hojaFijos(E);
  },
  'borrar-fijo': async (ctx) => {
    const { E } = ctx, b = borrador;
    if (!await confirmar('¿Quitar este movimiento fijo?', `«${esc(b.nombre)}» dejará de apuntarse cada mes. Lo que ya está apuntado no cambia.`, 'Quitar')) return;
    if (!await D.borrarFijo(b.id)) return;
    E.fijos = E.fijos.filter(x => String(x.id) !== String(b.id));
    toast('Movimiento fijo quitado');
    hojaFijos(E);
  }
};

