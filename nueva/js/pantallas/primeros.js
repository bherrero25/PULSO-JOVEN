// Primeros pasos: lo que conviene hacer al empezar con la app. Cada paso se marca solo cuando ya está hecho.
// Con la cuenta vacía, Inicio enseña la bienvenida en lugar del balance; después, una tarjeta con lo que falta (se puede ocultar).

import { ic } from '../iconos.js';
import { esc } from '../logica.js';
import * as D from '../datos.js';

// Ocultar la tarjeta es una preferencia de este dispositivo (si el navegador no deja guardarla, simplemente vuelve a salir)
const clave = E => `pj_primeros_pasos_oculto_${E.usuario?.id || ''}`;
const oculto = E => { if (E.primerosOcultos) return true; try { return localStorage.getItem(clave(E)) === '1'; } catch { return false; } };

export const conMovimientos = E => E.txs.some(t => t.cuenta !== 'previsto');

export function pasos(E) {
  const lista = [{ titulo: 'Trae tus movimientos', hecho: conMovimientos(E), texto: 'Sube el extracto de tu banco (Excel o CSV) o apunta a mano lo que gastas.',
    botones: [{ href: '#/anadir?pestana=extracto', texto: 'Subir extracto' }, { href: '#/anadir?pestana=mano', texto: 'Apuntar a mano' }] }];
  if (E.cuentas) lista.push({ titulo: 'Cuánto tienes', hecho: E.cuentas.length > 0, texto: 'Añade lo que tienes en efectivo o ahorrado. El saldo del banco se pone solo al subir el extracto.',
    botones: [{ accion: 'editar-cuenta', texto: 'Añadir una cuenta' }] });
  if (E.fijos) lista.push({ titulo: 'Lo que llega o pagas cada mes', hecho: E.fijos.length > 0, texto: 'La mensualidad, la nómina, una beca, el alquiler… Se apuntarán solos cada mes.',
    botones: [{ accion: 'gestionar-fijos', texto: 'Configurar' }] });
  lista.push({ titulo: 'Un presupuesto', hecho: E.presupuestos.length > 0, texto: 'Pon un límite a lo que más te importa controlar: comida, ocio, ropa…',
    botones: [{ href: '#/presupuesto', texto: 'Poner un límite' }] });
  lista.push({ titulo: 'Una meta de ahorro', hecho: E.metas.length > 0, texto: 'Un viaje, el carné, un portátil… La app te dice cuánto apartar cada mes.',
    botones: [{ href: '#/metas', texto: 'Crear una meta' }] });
  return lista;
}

const boton = (b, i) => {
  const clase = `boton ${i ? 'suave ' : ''}peq`;
  return b.href ? `<a href="${b.href}" class="${clase}">${esc(b.texto)}</a>`
    : `<button type="button" class="${clase}" data-accion="${b.accion}" data-id="">${esc(b.texto)}</button>`;
};

function lista(E) {
  return `<ol class="primeros">${pasos(E).map((p, n) => `<li${p.hecho ? ' class="hecho"' : ''}>
    <span class="primeros-num" aria-hidden="true">${p.hecho ? ic('ok', 'ic-s') : n + 1}</span>
    <div class="primeros-cuerpo"><span class="primeros-titulo">${esc(p.titulo)}${p.hecho ? '<span class="solo-lector"> (hecho)</span>' : ''}</span>
      ${p.hecho ? '' : `<span class="nota">${esc(p.texto)}</span><div class="primeros-botones">${p.botones.map(boton).join('')}</div>`}</div>
  </li>`).join('')}</ol>`;
}

// Con la cuenta vacía: bienvenida con todos los pasos (sustituye al balance, que aún sería cero)
export function bienvenida(E) {
  return `<section class="tarjeta" aria-label="Primeros pasos" style="gap:14px">
    <div style="display:flex;flex-direction:column;gap:4px"><span class="sub">Te damos la bienvenida a Pulso Joven</span>
      <h2 class="h2" style="font-size:20px">Vamos a dejar tu dinero a punto</h2>
      <span class="nota">Son unos minutos y puedes hacerlo en el orden que quieras.</span></div>
    ${lista(E)}
  </section>`;
}

// Después: lo que falta, hasta que esté todo o se oculte. Nunca en la demo.
export function tarjeta(E) {
  const todos = pasos(E), hechos = todos.filter(p => p.hecho).length;
  if (D.enDemo() || hechos === todos.length || oculto(E)) return '';
  return `<section class="tarjeta" aria-label="Primeros pasos" style="gap:12px">
    <div class="fila-titulo"><h2 class="h2">Primeros pasos · ${hechos} de ${todos.length}</h2><button type="button" class="enlace" data-accion="ocultar-primeros">Ocultar</button></div>
    <div class="progreso"><i style="width:${Math.round(hechos / todos.length * 100)}%"></i></div>
    ${lista(E)}
  </section>`;
}

export const acciones = {
  'ocultar-primeros': (ctx) => {
    try { localStorage.setItem(clave(ctx.E), '1'); } catch { /* sin almacenamiento: se oculta solo hasta recargar */ }
    ctx.E.primerosOcultos = true;
    ctx.pintar();
  }
};
