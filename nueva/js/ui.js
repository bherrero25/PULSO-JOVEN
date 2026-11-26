// Piezas de interfaz compartidas: avisos, hojas (diálogos desde abajo) y confirmaciones

import { ic } from './iconos.js';

export function mostrarAviso(texto) {
  const el = document.getElementById('aviso-error');
  el.innerHTML = ic('alerta') + '<span></span>';
  el.lastElementChild.textContent = texto; // siempre como texto, nunca como HTML
  el.classList.add('visible');
  el.onclick = () => el.classList.remove('visible');
  clearTimeout(mostrarAviso.t);
  mostrarAviso.t = setTimeout(() => el.classList.remove('visible'), 8000);
}

export function toast(texto) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span class="lima">${ic('ok')}</span><span></span>`;
  el.lastElementChild.textContent = texto; // siempre como texto: puede llevar nombres de cuentas, metas o movimientos
  el.classList.add('visible');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('visible'), 2800);
}

// La hoja se cierra al tocar fuera o con Escape
export function abrirHoja(html, etiqueta) {
  const cont = document.getElementById('hoja');
  cont.innerHTML = `<div class="hoja-fondo"><div class="hoja-panel" role="dialog" aria-modal="true" aria-label="${etiqueta}">${html}</div></div>`;
  const fondo = cont.firstElementChild;
  fondo.addEventListener('click', e => { if (e.target === fondo) cerrarHoja(); });
  const primero = fondo.querySelector('input, select, button:not(.boton-redondo)');
  if (primero && primero.tagName !== 'BUTTON') primero.focus();
}
export function cerrarHoja() { document.getElementById('hoja').innerHTML = ''; }
export const hojaAbierta = () => !!document.getElementById('hoja').firstElementChild;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && hojaAbierta()) cerrarHoja(); });

export const cabeceraHoja = (titulo, sub = '') => `<div class="hoja-cab"><div style="display:flex;flex-direction:column;gap:4px;min-width:0">
  ${sub ? `<span class="sub">${sub}</span>` : ''}<h2>${titulo}</h2></div>
  <button type="button" class="boton-redondo" data-accion="cerrar-hoja" aria-label="Cerrar">${ic('cerrar')}</button></div>`;

// Pregunta de sí o no con botones propios (en vez del cuadro del navegador)
export function confirmar(titulo, texto, boton = 'Borrar') {
  return new Promise(resolver => {
    abrirHoja(`${cabeceraHoja(titulo)}<p class="texto-2" style="font-size:14px;line-height:1.5">${texto}</p>
      <button type="button" class="boton peligro" id="conf-si">${boton}</button>
      <button type="button" class="boton suave" id="conf-no">Cancelar</button>`, titulo);
    const fin = v => { cerrarHoja(); resolver(v); };
    document.getElementById('conf-si').onclick = () => fin(true);
    document.getElementById('conf-no').onclick = () => fin(false);
    document.querySelector('#hoja [data-accion="cerrar-hoja"]').onclick = e => { e.stopPropagation(); fin(false); };
  });
}
