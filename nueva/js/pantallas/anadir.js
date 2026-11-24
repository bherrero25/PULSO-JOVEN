// Añadir: a mano con teclado, subiendo el extracto del banco o (más adelante) de forma automática

import { ic } from '../iconos.js';
import { esc, fmt, hoyISO, fechaCorta, RAPIDAS_GASTO, RAPIDAS_INGRESO, categoriaPorId, MEDIOS, nombreCuenta, infoCategoria } from '../logica.js';
import { ficha } from '../componentes.js';
import { toast } from '../ui.js';
import * as D from '../datos.js';
import { leerFilas, analizarExtracto } from '../importar.js';

export const nuevoMovimiento = () => ({ tipo: 'gasto', importe: '', cat: 'comida', fecha: hoyISO(), medio: 'tarjeta', concepto: '' });

export function render(E) {
  const tab = E.tabAnadir;
  const pestaña = (k, t) => `<button type="button" role="tab" aria-selected="${tab === k}" data-accion="tab-anadir" data-valor="${k}">${t}</button>`;
  return `<div class="pantalla-anadir">
    <header>
      <a href="#/inicio" class="boton-redondo" aria-label="Cerrar">${ic('cerrar')}</a>
      <h1>Nuevo movimiento</h1>
      <span style="width:44px"></span>
    </header>
    <div class="segmentado" role="tablist" aria-label="Cómo añadirlo" style="margin:0 16px">${pestaña('mano', 'A mano')}${pestaña('extracto', 'Extracto')}${pestaña('auto', 'Automático')}</div>
    <div class="anadir-cuerpo">${tab === 'mano' ? aMano(E) : tab === 'extracto' ? extracto(E) : automatico()}</div>
  </div>`;
}

function aMano(E) {
  const n = E.nuevo;
  const ids = n.tipo === 'gasto' ? RAPIDAS_GASTO : RAPIDAS_INGRESO;
  const boton = (k, t) => `<button type="button" data-accion="tipo-nuevo" data-valor="${k}" aria-pressed="${n.tipo === k}">${t}</button>`;
  return `
    <div class="tipo" role="group" aria-label="Tipo">${boton('gasto', 'Gasto')}${boton('ingreso', 'Ingreso')}</div>
    <div class="pantalla-importe num${n.importe ? '' : ' vacio-imp'}${n.tipo === 'ingreso' && n.importe ? ' positivo' : ''}" aria-live="polite">${n.importe ? (n.tipo === 'gasto' ? '−' : '+') + n.importe : '0'} €</div>
    <div class="chips sin-scroll" role="group" aria-label="Categoría">
      ${ids.map(id => { const c = categoriaPorId(id); return `<button type="button" class="cat-chip" data-accion="cat-nuevo" data-valor="${id}" aria-pressed="${n.cat === id}">${ficha(c, 'peq')}${esc(c.nombre)}</button>`; }).join('')}
    </div>
    <div class="par">
      <label class="campo"><span class="solo-lector">Fecha</span><input type="date" value="${n.fecha}" max="${hoyISO()}" data-entrada="fecha-nuevo"></label>
      <label class="campo"><span class="solo-lector">Forma de pago</span><select data-entrada="medio-nuevo">
        ${Object.entries(MEDIOS).map(([k, v]) => `<option value="${k}"${n.medio === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <label class="campo"><span class="solo-lector">Concepto</span><input type="text" placeholder="¿Qué es? (opcional)" value="${esc(n.concepto)}" data-entrada="concepto-nuevo" maxlength="80"></label>
    <div class="teclado" role="group" aria-label="Teclado">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0'].map(k => `<button type="button" class="num" data-accion="tecla" data-valor="${k}">${k}</button>`).join('')}
      <button type="button" data-accion="tecla" data-valor="borrar" aria-label="Borrar">${ic('borrar', 'ic-l')}</button>
    </div>
    <button type="button" class="boton" data-accion="guardar-nuevo">${n.tipo === 'gasto' ? 'Guardar gasto' : 'Guardar ingreso'}</button>`;
}

function extracto(E) {
  const imp = E.importacion;
  if (imp && imp.txs) {
    const fechas = imp.txs.map(t => t.fecha).sort();
    return `<section class="tarjeta" style="border:1px solid var(--linea-2)">
        <div style="display:flex;align-items:center;gap:10px">${'<span class="ficha">' + ic('banco') + '</span>'}
          <div style="display:flex;flex-direction:column;gap:2px"><b style="font-size:16px">${esc(nombreCuenta(imp.banco))} · ${imp.tipo === 'tarjeta' ? 'tarjeta' : imp.tipo === 'efectivo' ? 'efectivo' : 'cuenta'}</b>
          <span class="nota">${imp.txs.length} movimientos del ${fechaCorta(fechas[0])} al ${fechaCorta(fechas[fechas.length - 1])}</span></div></div>
        <div class="dos-col">
          <div class="dato"><small style="color:var(--texto-3)">Nuevos</small><b class="num">${imp.nuevas.length}</b></div>
          <div class="dato"><small style="color:var(--texto-3)">Ya estaban</small><b class="num">${imp.txs.length - imp.nuevas.length}</b></div>
        </div>
        ${imp.nuevas.length ? `<div>${imp.nuevas.slice(0, 6).map(t => { const c = infoCategoria(t.categoria); return `<div class="fila">${ficha(c, 'peq')}<span class="cuerpo"><span class="concepto" style="font-size:14px">${esc(t.descripcion)}</span><span class="detalle">${fechaCorta(t.fecha)} · ${esc(c.nombre)}</span></span><span class="importe num${t.tipo === 'ingreso' ? ' positivo' : ''}" style="font-size:14px">${fmt(t.tipo === 'ingreso' ? +t.importe : -t.importe, true)}</span></div>`; }).join('')}
          ${imp.nuevas.length > 6 ? `<p class="nota" style="padding-top:8px">y ${imp.nuevas.length - 6} más</p>` : ''}</div>` : '<p class="nota">Todos los movimientos de este archivo ya estaban guardados.</p>'}
      </section>
      ${imp.nuevas.length ? `<button type="button" class="boton" data-accion="confirmar-importacion"${imp.guardando ? ' disabled' : ''}>${imp.guardando ? 'Guardando…' : `Importar ${imp.nuevas.length} ${imp.nuevas.length === 1 ? 'movimiento' : 'movimientos'}`}</button>` : ''}
      <button type="button" class="boton suave" data-accion="cancelar-importacion">${imp.nuevas.length ? 'Cancelar' : 'Elegir otro archivo'}</button>
      <p class="nota">Después podrás cambiar la categoría de cualquiera; la app aprenderá de tus cambios.</p>`;
  }
  return `<label class="zona-subir">
      <span class="ficha">${ic('subir', 'ic-l')}</span>
      <b style="font-size:16px">Sube el extracto de tu banco</b>
      <span class="nota">Excel o CSV · cuenta, tarjeta o efectivo</span>
      <input type="file" accept=".xlsx,.xls,.csv" class="solo-lector" data-cambio="archivo">
    </label>
    ${imp && imp.error ? `<p class="aviso-revisar" role="alert">${ic('alerta')}<span>${esc(imp.error)}</span></p>` : ''}
    ${imp && imp.leyendo ? '<p class="nota" style="text-align:center">Leyendo el archivo…</p>' : ''}
    <div class="pasos">
      <div><b>1</b><span>Descarga los movimientos desde la web o la app de tu banco (en Excel).</span></div>
      <div><b>2</b><span>Súbelo aquí. Reconocemos el formato solos.</span></div>
      <div><b>3</b><span>Revisa lo que hemos encontrado y confirma. Lo repetido no se duplica.</span></div>
    </div>
    <p class="nota">Probado con Bankinter. BBVA, Santander, CaixaBank, ING, Revolut y N26 se reconocen por el formato de su archivo. Para el efectivo, <a href="../plantilla-efectivo-pulso.xlsx" style="text-decoration:underline">descarga la plantilla</a>.</p>`;
}

function automatico() {
  const opcion = (icono, titulo, plataforma, texto) => `<div class="opcion futura">
    <div class="cab"><span class="ficha">${ic(icono)}</span><b>${titulo}</b><span class="pastilla gris">PRÓXIMAMENTE</span></div>
    <p>${texto}</p><span class="nota">${plataforma}</span></div>`;
  return `<p class="texto-2" style="font-size:14px;line-height:1.45">Estamos preparando formas de que tus movimientos lleguen solos. Pulso Joven nunca te pedirá las claves de tu banco.</p>
    ${opcion('correo', 'Reenvía los avisos de tu banco', 'Cualquier móvil', 'Activa en tu banco el aviso por email de cada pago y reenvíalo a tu dirección de Pulso Joven. Los apuntaremos solos.')}
    ${opcion('movil', 'Pagos con Apple Pay', 'iPhone', 'Activa un atajo una vez y cada pago con el móvil en tienda se apuntará solo.')}
    ${opcion('campana', 'Avisos de tu banco', 'App de Android', 'Pulso Joven leerá el aviso de compra que te manda tu banco y lo apuntará.')}
    ${opcion('banco', 'Conectar tu banco', 'Plan Pro', 'Tus movimientos llegarán solos cada día, con una conexión regulada y de solo lectura: nunca podremos mover tu dinero.')}`;
}

export const acciones = {
  'tab-anadir': (ctx, el) => { ctx.E.tabAnadir = el.dataset.valor; ctx.pintar(); },
  'tipo-nuevo': (ctx, el) => {
    const n = ctx.E.nuevo;
    n.tipo = el.dataset.valor;
    n.cat = n.tipo === 'gasto' ? 'comida' : 'mensualidad';
    n.medio = n.tipo === 'gasto' ? 'tarjeta' : 'transferencia';
    ctx.pintar();
  },
  'cat-nuevo': (ctx, el) => { ctx.E.nuevo.cat = el.dataset.valor; ctx.pintar(); },
  'tecla': (ctx, el) => {
    const n = ctx.E.nuevo, k = el.dataset.valor;
    let a = n.importe;
    if (k === 'borrar') a = a.slice(0, -1);
    else if (k === ',') { if (!a.includes(',')) a = (a || '0') + ','; }
    else {
      const dec = a.split(',')[1];
      if ((dec !== undefined && dec.length >= 2) || a.replace(',', '').length >= 6) return;
      a = (a === '0' ? '' : a) + k;
    }
    n.importe = a;
    ctx.pintar();
  },
  'guardar-nuevo': async (ctx) => {
    const { E } = ctx, n = E.nuevo;
    const importe = parseFloat(n.importe.replace(',', '.'));
    if (!importe) { toast('Escribe el importe con el teclado'); return; }
    const cat = categoriaPorId(n.cat);
    const cuenta = n.medio === 'efectivo' ? 'efectivo' : cuentaHabitual(E.txs);
    const tx = { fecha: n.fecha || hoyISO(), descripcion: n.concepto.trim() || cat.nombre, importe, tipo: n.tipo, categoria: cat.bd, medio: n.medio, cuenta };
    const fila = await D.insertarMovimiento(tx);
    if (!fila) return;
    E.txs.push(fila);
    E.txs.sort((a, b) => b.fecha.localeCompare(a.fecha));
    E.nuevo = nuevoMovimiento();
    toast(n.tipo === 'gasto' ? `Gasto de ${fmt(importe)} guardado` : `Ingreso de ${fmt(importe)} guardado`);
    location.hash = '#/inicio';
  },
  'cancelar-importacion': (ctx) => { ctx.E.importacion = null; ctx.pintar(); },
  'confirmar-importacion': async (ctx) => {
    const { E } = ctx, imp = E.importacion;
    imp.guardando = true; ctx.pintar();
    // Se vuelve a comprobar contra lo guardado por si se ha importado algo mientras tanto (por ejemplo, desde otra pestaña)
    let claves;
    try { claves = await D.clavesGuardadas(E.txs); } catch (error) { D.avisarError(error, 'comprobar qué movimientos tenías ya'); imp.guardando = false; ctx.pintar(); return; }
    const nuevas = imp.nuevas.filter(t => !claves.has(D.claveMovimiento(t)));
    const { guardadas, error } = await D.insertarMovimientos(nuevas);
    E.txs.push(...guardadas);
    E.txs.sort((a, b) => b.fecha.localeCompare(a.fecha));
    E.importacion = null;
    if (error) {
      E.importacion = { error: `Solo se guardaron ${guardadas.length} de ${nuevas.length} movimientos. Vuelve a subir el archivo: los que ya se guardaron no se duplicarán.` };
      ctx.pintar();
      return;
    }
    toast(`${guardadas.length} movimientos importados`);
    location.hash = '#/movimientos';
  }
};

export const entradas = {
  'fecha-nuevo': (ctx, el) => { ctx.E.nuevo.fecha = el.value; },
  'medio-nuevo': (ctx, el) => { ctx.E.nuevo.medio = el.value; },
  'concepto-nuevo': (ctx, el) => { ctx.E.nuevo.concepto = el.value; }
};

export const cambios = {
  'archivo': async (ctx, el) => {
    const { E } = ctx;
    const archivo = el.files[0];
    if (!archivo) return;
    E.importacion = { leyendo: true }; ctx.pintar();
    try {
      const filas = await leerFilas(archivo);
      const r = analizarExtracto(filas, { reglas: E.reglas, hayTarjeta: E.txs.some(t => String(t.cuenta || '').endsWith('_tarjeta')) });
      if (r.error) E.importacion = { error: r.error };
      else if (!r.txs.length) E.importacion = { error: 'No hemos encontrado movimientos en este archivo.' };
      else {
        const guardadas = new Set(E.txs.map(D.claveMovimiento));
        E.importacion = { ...r, nuevas: r.txs.filter(t => !guardadas.has(D.claveMovimiento(t))) };
      }
    } catch (e) {
      console.error(e);
      E.importacion = { error: 'No se ha podido leer el archivo. ¿Es un Excel o un CSV?' };
    }
    ctx.pintar();
  }
};

// La cuenta que más aparece en los movimientos (para lo que se apunta a mano con tarjeta)
function cuentaHabitual(txs) {
  const n = {};
  txs.forEach(t => { if (t.cuenta && t.cuenta !== 'efectivo') n[t.cuenta] = (n[t.cuenta] || 0) + 1; });
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || 'efectivo';
}
