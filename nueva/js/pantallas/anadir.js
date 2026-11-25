// Añadir: a mano con teclado, subiendo el extracto del banco o (más adelante) de forma automática

import { ic } from '../iconos.js';
import { esc, fmt, hoyISO, fechaCorta, RAPIDAS_GASTO, RAPIDAS_INGRESO, categoriaPorId, MEDIOS, nombreCuenta, infoCategoria, separarYaApuntados, conciliarRetenidos, porRevisar, emparejarApuntados, CUENTA_MANUAL, BD } from '../logica.js';
import { ficha, conceptoVisible } from '../componentes.js';
import { toast, abrirHoja, cabeceraHoja, confirmar } from '../ui.js';
import * as D from '../datos.js';
import { leerFilas, analizarExtracto } from '../importar.js';
import { preguntarTraspaso } from './dinero.js';

// ─── A MANO ───
// La forma de pago se elige con botones; con Bizum o transferencia los textos hablan de enviar y recibir, y la categoría
// se puede dejar para luego (queda «por revisar»). Se puede abrir ya preparado con #/anadir?tipo=gasto&medio=bizum.
const LUEGO = 'luego';
const FORMAS = [['tarjeta', 'Tarjeta'], ['efectivo', 'Efectivo'], ['bizum', 'Bizum'], ['transferencia', 'Transferencia']];
const conPersona = medio => medio === 'bizum' || medio === 'transferencia';
const catPorDefecto = (tipo, medio) => conPersona(medio) ? LUEGO : tipo === 'gasto' ? 'comida' : 'mensualidad';
export function nuevoMovimiento({ tipo, medio } = {}) {
  const t = tipo === 'ingreso' ? 'ingreso' : 'gasto';
  const m = MEDIOS[medio] ? medio : t === 'gasto' ? 'tarjeta' : 'transferencia';
  return { tipo: t, importe: '', cat: catPorDefecto(t, m), catElegida: false, fecha: hoyISO(), medio: m, concepto: '' };
}
function textosNuevo(n) {
  const g = n.tipo === 'gasto';
  if (n.medio === 'bizum') return { tipos: ['Enviado', 'Recibido'], concepto: g ? '¿A quién?' : '¿De quién?', guardar: g ? 'Guardar Bizum enviado' : 'Guardar Bizum recibido', nombre: g ? 'Bizum enviado' : 'Bizum recibido' };
  if (n.medio === 'transferencia') return { tipos: ['Enviada', 'Recibida'], concepto: g ? '¿A quién o para qué?' : '¿De quién o de qué?', guardar: g ? 'Guardar transferencia' : 'Guardar transferencia recibida', nombre: g ? 'Transferencia enviada' : 'Transferencia recibida' };
  return { tipos: ['Gasto', 'Ingreso'], concepto: '¿Qué es? (opcional)', guardar: g ? 'Guardar gasto' : 'Guardar ingreso', nombre: g ? 'Gasto' : 'Ingreso' };
}

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
    <div class="anadir-cuerpo">${tab === 'mano' ? aMano(E) : tab === 'extracto' ? extracto(E) : automatico(E)}</div>
  </div>`;
}

function aMano(E) {
  const n = E.nuevo;
  const ids = n.tipo === 'gasto' ? RAPIDAS_GASTO : RAPIDAS_INGRESO;
  const tx = textosNuevo(n);
  const boton = (k, t) => `<button type="button" data-accion="tipo-nuevo" data-valor="${k}" aria-pressed="${n.tipo === k}">${t}</button>`;
  const luego = `<button type="button" class="cat-chip" data-accion="cat-nuevo" data-valor="${LUEGO}" aria-pressed="${n.cat === LUEGO}">${ficha({ icono: 'otros', tipo: 'gasto' }, 'peq')}Lo decido luego</button>`;
  return `
    <div class="tipo" role="group" aria-label="Tipo">${boton('gasto', tx.tipos[0])}${boton('ingreso', tx.tipos[1])}</div>
    <div class="formas" role="group" aria-label="Forma de pago">${FORMAS.map(([k, t]) => `<button type="button" data-accion="forma-nuevo" data-valor="${k}" aria-pressed="${n.medio === k}">${t}</button>`).join('')}</div>
    <div class="pantalla-importe num${n.importe ? '' : ' vacio-imp'}${n.tipo === 'ingreso' && n.importe ? ' positivo' : ''}" aria-live="polite">${n.importe ? (n.tipo === 'gasto' ? '−' : '+') + n.importe : '0'} €</div>
    <div class="chips sin-scroll" role="group" aria-label="Categoría">
      ${conPersona(n.medio) ? luego : ''}${ids.map(id => { const c = categoriaPorId(id); return `<button type="button" class="cat-chip" data-accion="cat-nuevo" data-valor="${id}" aria-pressed="${n.cat === id}">${ficha(c, 'peq')}${esc(c.nombre)}</button>`; }).join('')}${conPersona(n.medio) ? '' : luego}
    </div>
    <div class="par" style="grid-template-columns:minmax(0,1fr) 150px">
      <label class="campo"><span class="solo-lector">Concepto</span><input type="text" placeholder="${tx.concepto}" value="${esc(n.concepto)}" data-entrada="concepto-nuevo" maxlength="80"></label>
      <label class="campo"><span class="solo-lector">Fecha</span><input type="date" value="${n.fecha}" max="${hoyISO()}" data-entrada="fecha-nuevo"></label>
    </div>
    <div class="teclado" role="group" aria-label="Teclado">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0'].map(k => `<button type="button" class="num" data-accion="tecla" data-valor="${k}">${k}</button>`).join('')}
      <button type="button" data-accion="tecla" data-valor="borrar" aria-label="Borrar">${ic('borrar', 'ic-l')}</button>
    </div>
    <button type="button" class="boton" data-accion="guardar-nuevo">${tx.guardar}</button>`;
}

function extracto(E) {
  const imp = E.importacion;
  if (imp && imp.txs) {
    const fechas = [...imp.txs, ...imp.retenidosNuevos].map(t => t.fecha).sort();
    const pares = imp.pares || [];
    const separados = pares.filter(x => !x.unir).map(x => x.banco), unir = pares.filter(x => x.unir);
    const aImportar = [...imp.nuevas, ...separados.filter(t => !t.pendiente), ...imp.retenidosNuevos, ...separados.filter(t => t.pendiente)];
    const nNuevos = imp.nuevas.length + separados.filter(t => !t.pendiente).length;
    const listaNuevos = [...imp.nuevas, ...imp.retenidosNuevos];
    const hayCambios = aImportar.length || unir.length || imp.cobrados.length || imp.caducados.length || (imp.saldo && E.cuentas);
    return `<section class="tarjeta" style="border:1px solid var(--linea-2)">
        <div style="display:flex;align-items:center;gap:10px">${'<span class="ficha">' + ic('banco') + '</span>'}
          <div style="display:flex;flex-direction:column;gap:2px"><b style="font-size:16px">${esc(nombreCuenta(imp.banco))} · ${imp.tipo === 'tarjeta' ? 'tarjeta' : imp.tipo === 'efectivo' ? 'efectivo' : 'cuenta'}</b>
          <span class="nota">${imp.txs.length} movimientos${imp.retenidos?.length ? ` y ${imp.retenidos.length} ${imp.retenidos.length === 1 ? 'retenido' : 'retenidos'}` : ''} del ${fechaCorta(fechas[0])} al ${fechaCorta(fechas[fechas.length - 1])}</span></div></div>
        <div class="dos-col">
          <div class="dato"><small style="color:var(--texto-3)">Nuevos</small><b class="num">${nNuevos}</b></div>
          <div class="dato"><small style="color:var(--texto-3)">Ya estaban</small><b class="num">${imp.yaEstaban}</b></div>
        </div>
        ${imp.retenidosNuevos.length || imp.cobrados.length || imp.caducados.length ? `<div style="background:var(--fondo);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:1.45;color:#33393F">
          ${imp.retenidosNuevos.length ? `<span><b>${imp.retenidosNuevos.length} ${imp.retenidosNuevos.length === 1 ? 'retenido' : 'retenidos'}</b> (el banco aún no ${imp.retenidosNuevos.length === 1 ? 'lo ha' : 'los ha'} cobrado): ya ${imp.retenidosNuevos.length === 1 ? 'cuenta' : 'cuentan'} en tus gastos.</span>` : ''}
          ${imp.cobrados.length ? `<span><b>${imp.cobrados.length} ${imp.cobrados.length === 1 ? 'retenido ya cobrado' : 'retenidos ya cobrados'}</b>: se ${imp.cobrados.length === 1 ? 'convierte' : 'convierten'} en el movimiento definitivo, con la categoría que tenía.</span>` : ''}
          ${imp.caducados.length ? `<span><b>${imp.caducados.length} ${imp.caducados.length === 1 ? 'retenido que ya no aparece' : 'retenidos que ya no aparecen'}</b> (${imp.caducados.length === 1 ? 'anulado' : 'anulados'} o con otro importe): se ${imp.caducados.length === 1 ? 'quita' : 'quitan'}.</span>` : ''}
        </div>` : ''}
        ${bloquePares(pares, true)}${bloquePares(pares, false)}
        ${imp.retenidosSinColumna ? `<p class="nota">Este extracto trae ${imp.retenidosSinColumna} ${imp.retenidosSinColumna === 1 ? 'movimiento retenido' : 'movimientos retenidos'}. Para incluirlos, hay que ejecutar en Supabase el texto <b>sql/2026-11-retenidos.sql</b>.</p>` : ''}
        ${imp.deApplePay ? `<p class="nota">De los que ya estaban, ${imp.deApplePay} ${imp.deApplePay === 1 ? 'entró' : 'entraron'} con Apple Pay (mismo importe y fecha cercana), así que no se repiten.</p>` : ''}
        ${imp.saldo ? `<div style="display:flex;justify-content:space-between;gap:10px;background:var(--fondo);border-radius:12px;padding:10px 12px;font-size:14px">
          <span>Saldo de ${esc(nombreCuenta(imp.banco))} el ${fechaCorta(imp.saldo.fecha)}</span><b class="num">${imp.saldo.valor < 0 ? '−' : ''}${fmt(imp.saldo.valor)}</b></div>` : ''}
        ${listaNuevos.length ? `<div>${listaNuevos.slice(0, 6).map(t => { const c = infoCategoria(t.categoria); return `<div class="fila">${ficha(c, 'peq')}<span class="cuerpo"><span class="concepto" style="font-size:14px">${esc(t.descripcion)}</span><span class="detalle">${fechaCorta(t.fecha)} · ${esc(c.nombre)}${t.pendiente ? ' <span class="retenido">Retenido</span>' : ''}</span></span><span class="importe num${t.tipo === 'ingreso' ? ' positivo' : ''}" style="font-size:14px">${fmt(t.tipo === 'ingreso' ? +t.importe : -t.importe, true)}</span></div>`; }).join('')}
          ${listaNuevos.length > 6 ? `<p class="nota" style="padding-top:8px">y ${listaNuevos.length - 6} más</p>` : ''}</div>` : `<p class="nota">${pares.length ? 'No hay más movimientos nuevos en este archivo.' : 'Todos los movimientos de este archivo ya estaban guardados.'}</p>`}
      </section>
      ${hayCambios ? `<button type="button" class="boton" data-accion="confirmar-importacion"${imp.guardando ? ' disabled' : ''}>${imp.guardando ? 'Guardando…'
        : aImportar.length ? `Importar ${aImportar.length} ${aImportar.length === 1 ? 'movimiento' : 'movimientos'}`
        : unir.length ? `Juntar ${unir.length === 1 ? 'el movimiento' : `los ${unir.length} movimientos`} con lo que ya tenías`
        : imp.cobrados.length || imp.caducados.length ? 'Actualizar los retenidos' : `Actualizar el saldo de ${esc(nombreCuenta(imp.banco))}`}</button>` : ''}
      <button type="button" class="boton suave" data-accion="cancelar-importacion">${hayCambios ? 'Cancelar' : 'Elegir otro archivo'}</button>
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

// Movimientos del extracto que coinciden con algo que ya habías apuntado.
// Seguros (apuntados a mano): se juntan salvo que digas que no. Dudosos (posibles repetidos): solo si lo marcas.
function bloquePares(pares, seguros) {
  const lista = pares.map((x, i) => ({ ...x, i })).filter(x => x.seguro === seguros);
  if (!lista.length) return '';
  const n = lista.length;
  const intro = seguros
    ? `<b>${n === 1 ? 'Ya lo tenías apuntado' : `${n} ya los tenías apuntados`}</b>: no se ${n === 1 ? 'repite' : 'repiten'}. ${n === 1 ? 'Se queda' : 'Se quedan'} con tu categoría y ${n === 1 ? 'toma' : 'toman'} la fecha, el concepto y el importe del banco.`
    : `<b>${n === 1 ? '¿Ya lo tenías?' : `${n} posibles repetidos`}</b> Se ${n === 1 ? 'parece' : 'parecen'} a algo que ya tenías guardado (importe y fecha parecidos). ${n === 1 ? 'Márcalo si es' : 'Marca los que sean'} lo mismo y no se ${n === 1 ? 'repetirá' : 'repetirán'}; si no, ${n === 1 ? 'entra' : 'entran'} como ${n === 1 ? 'nuevo' : 'nuevos'}.`;
  return `<div style="background:var(--fondo);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:4px;font-size:13px;line-height:1.45;color:#33393F">
    <span>${intro}</span>
    ${lista.map(x => { const { guardado: g, banco: b, unir, i } = x; return `<div style="border-top:1px solid var(--linea);margin-top:6px;padding-top:6px">
      <div class="fila" style="padding:4px 0">${ficha(infoCategoria(g.categoria), 'peq')}<span class="cuerpo"><span class="concepto" style="font-size:14px">${esc(b.descripcion)}</span><span class="detalle">${fechaCorta(b.fecha)} · en el banco${b.pendiente ? ' <span class="retenido">Retenido</span>' : ''}</span></span>
        <span class="importe num${b.tipo === 'ingreso' ? ' positivo' : ''}" style="font-size:14px">${fmt(b.tipo === 'ingreso' ? +b.importe : -b.importe, true)}</span></div>
      <label class="casilla" style="min-height:36px;font-size:13px"><input type="checkbox" data-cambio="par-unir" data-i="${i}"${unir ? ' checked' : ''}> <span>${x.previsto ? `Es lo previsto el ${fechaCorta(g.fecha)}: «${esc(conceptoVisible(g))}»${Math.abs(g.importe - b.importe) >= 0.005 ? ` (${fmt(g.importe)}; se queda el importe del banco)` : ''}` : `Es «${esc(conceptoVisible(g))}», ${seguros ? 'que apuntaste' : 'que ya tenías,'} el ${fechaCorta(g.fecha)}`}</span></label>
    </div>`; }).join('')}
  </div>`;
}

function automatico(E) {
  const opcion = (icono, titulo, plataforma, texto) => `<div class="opcion futura">
    <div class="cab"><span class="ficha">${ic(icono)}</span><b>${titulo}</b><span class="pastilla gris">PRÓXIMAMENTE</span></div>
    <p>${texto}</p><span class="nota">${plataforma}</span></div>`;
  return `<p class="texto-2" style="font-size:14px;line-height:1.45">Formas de que tus movimientos lleguen solos. Pulso Joven nunca te pedirá las claves de tu banco.</p>
    <div class="opcion">
      <div class="cab"><span class="ficha" style="background:var(--tinta);color:var(--lima)">${ic('calendario')}</span><b>Movimientos fijos</b><span class="nota">Cualquier móvil</span></div>
      <p>La mensualidad, la nómina, una beca, el alquiler… Apúntalos una vez y cada mes aparecerán solos el día que tocan, como «previstos».</p>
      <span class="nota">Al subir el extracto se juntan con el de verdad, aunque el importe cambie un poco.</span>
      <button type="button" class="boton peq" data-accion="gestionar-fijos">${E.fijos?.length ? `Ver tus movimientos fijos (${E.fijos.length})` : 'Configurar'}</button>
    </div>
    <div class="opcion">
      <div class="cab"><span class="ficha" style="background:var(--tinta);color:var(--lima)">${ic('movil')}</span><b>Pagos con Apple Pay</b><span class="nota">iPhone</span></div>
      <p>Configura un atajo una vez y cada pago con el iPhone o el Apple Watch en una tienda se apuntará solo, sin abrir nada.</p>
      <span class="nota">No capta compras por internet, pagos con la tarjeta física ni Bizum.</span>
      <button type="button" class="boton peq" data-accion="configurar-applepay">Configurar el atajo</button>
    </div>
    ${opcion('correo', 'Reenvía los avisos de tu banco', 'Cualquier móvil', 'Activa en tu banco el aviso por email de cada pago y reenvíalo a tu dirección de Pulso Joven. Los apuntaremos solos.')}
    ${opcion('campana', 'Avisos de tu banco', 'App de Android', 'Pulso Joven leerá el aviso de compra que te manda tu banco y lo apuntará.')}
    ${opcion('banco', 'Conectar tu banco', 'Plan Pro', 'Tus movimientos llegarán solos cada día, con una conexión regulada y de solo lectura: nunca podremos mover tu dinero.')}`;
}

export const acciones = {
  'tab-anadir': (ctx, el) => { ctx.E.tabAnadir = el.dataset.valor; ctx.pintar(); },
  'tipo-nuevo': (ctx, el) => {
    const n = ctx.E.nuevo;
    if (n.tipo === el.dataset.valor) return;
    n.tipo = el.dataset.valor;
    if (n.tipo === 'ingreso' && n.medio === 'tarjeta') n.medio = 'transferencia';
    // La categoría elegida no vale para el otro tipo (salvo «luego»): vuelve a la de por defecto
    if (n.cat !== LUEGO || !n.catElegida) { n.cat = catPorDefecto(n.tipo, n.medio); n.catElegida = false; }
    ctx.pintar();
  },
  'forma-nuevo': (ctx, el) => {
    const n = ctx.E.nuevo;
    n.medio = el.dataset.valor;
    if (!n.catElegida) n.cat = catPorDefecto(n.tipo, n.medio);
    ctx.pintar();
  },
  'cat-nuevo': (ctx, el) => { Object.assign(ctx.E.nuevo, { cat: el.dataset.valor, catElegida: true }); ctx.pintar(); },
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
    // «Lo decido luego»: queda por revisar (los Bizum, como «Bizum enviado/recibido»)
    const luego = n.cat === LUEGO, cat = luego ? null : categoriaPorId(n.cat), textos = textosNuevo(n);
    const categoria = !luego ? cat.bd : n.medio === 'bizum' ? (n.tipo === 'gasto' ? '📱 Bizum enviado' : '📱 Bizum recibido') : BD.OTROS;
    // Lo pagado en efectivo no sale en el banco; lo demás (y meter efectivo en el banco) se juntará con el extracto
    const cuenta = n.medio === 'efectivo' && n.cat !== 'traspaso' ? 'efectivo' : CUENTA_MANUAL;
    const descripcion = n.concepto.trim() || (conPersona(n.medio) || luego ? textos.nombre : cat.nombre);
    const tx = { fecha: n.fecha || hoyISO(), descripcion, importe, tipo: n.tipo, categoria, medio: n.medio, cuenta };
    const fila = await D.insertarMovimiento(tx);
    if (!fila) return;
    E.txs.push(fila);
    E.txs.sort((a, b) => b.fecha.localeCompare(a.fecha));
    E.nuevo = nuevoMovimiento();
    // Un traspaso pregunta de qué cuenta sale el dinero, ya en Inicio (al cambiar de pantalla se cierran las hojas)
    if (n.cat === 'traspaso') window.addEventListener('hashchange', () => preguntarTraspaso(ctx, fila), { once: true });
    else toast(`${textos.nombre} de ${fmt(importe)} ${n.medio === 'transferencia' ? 'guardada' : 'guardado'}${luego ? '. Ponle categoría cuando quieras en «Por revisar».' : ''}`);
    location.hash = '#/inicio';
  },
  'cancelar-importacion': (ctx) => { ctx.E.importacion = null; ctx.pintar(); },
  'configurar-applepay': async () => {
    const r = await D.codigoAtajo();
    if (!r) return;
    if (r.falta) {
      abrirHoja(`${cabeceraHoja('Falta un paso en la base de datos')}
        <p class="texto-2" style="font-size:14px;line-height:1.5">Para usar el atajo hay que ejecutar una vez en Supabase el texto <b>sql/2026-11-atajo-apple-pay.sql</b> del proyecto. Cuando esté, vuelve aquí.</p>`, 'Falta un paso');
      return;
    }
    hojaApplePay(r.codigo);
  },
  'copiar': async (ctx, el) => {
    try { await navigator.clipboard.writeText(el.dataset.texto); toast(`${el.dataset.que} copiado`); }
    catch { toast('No se ha podido copiar: mantén pulsado el texto para copiarlo'); }
  },
  'cambiar-codigo': async () => {
    if (!await confirmar('¿Cambiar tu código?', 'El atajo dejará de funcionar hasta que pongas el código nuevo en él. Hazlo solo si crees que alguien más lo tiene.', 'Cambiar código')) return;
    const codigo = await D.cambiarCodigoAtajo();
    if (codigo) { hojaApplePay(codigo); toast('Código cambiado'); }
  },
  'confirmar-importacion': async (ctx) => {
    const { E } = ctx, imp = E.importacion;
    imp.guardando = true; ctx.pintar();
    // Se vuelve a comprobar contra lo guardado por si se ha importado algo mientras tanto (por ejemplo, desde otra pestaña)
    let claves;
    try { claves = await D.clavesGuardadas(E.txs); } catch (error) { D.avisarError(error, 'comprobar qué movimientos tenías ya'); imp.guardando = false; ctx.pintar(); return; }
    const pares = imp.pares || [];
    const separados = pares.filter(x => !x.unir).map(x => x.banco);
    const nuevas = [...imp.nuevas, ...imp.retenidosNuevos, ...separados].filter(t => !claves.has(D.claveMovimiento(t)));
    const { guardadas, error } = await D.insertarMovimientos(nuevas);
    E.txs.push(...guardadas);
    E.txs.sort((a, b) => b.fecha.localeCompare(a.fecha));
    E.importacion = null;
    if (error) {
      E.importacion = { error: `Solo se guardaron ${guardadas.length} de ${nuevas.length} movimientos. Vuelve a subir el archivo: los que ya se guardaron no se duplicarán.` };
      ctx.pintar();
      return;
    }
    // Retenidos ya cobrados: pasan a ser el movimiento definitivo y conservan la categoría que se les hubiera dado
    let cobrados = 0;
    for (const { retenido, definitivo } of imp.cobrados) {
      const cambios = { fecha: definitivo.fecha, descripcion: definitivo.descripcion, medio: definitivo.medio, pendiente: false };
      if (porRevisar(retenido, E.reglas) && !porRevisar(definitivo, E.reglas)) cambios.categoria = definitivo.categoria;
      if (await D.actualizarMovimientos([retenido.id], cambios, 'actualizar un movimiento retenido')) { Object.assign(retenido, cambios); cobrados++; }
    }
    // Lo apuntado a mano toma la fecha, el concepto y la cuenta del banco (así la próxima importación ya lo reconoce)
    // y conserva su categoría y su forma de pago
    let unidos = 0;
    for (const { guardado, banco } of pares.filter(x => x.unir)) {
      const cambios = { fecha: banco.fecha, descripcion: banco.descripcion, cuenta: banco.cuenta, importe: banco.importe };
      if (E.conRetenidos) cambios.pendiente = !!banco.pendiente;
      if (porRevisar(guardado, E.reglas) && !porRevisar(banco, E.reglas)) cambios.categoria = banco.categoria;
      if (await D.actualizarMovimientos([guardado.id], cambios, 'juntar lo que apuntaste con el movimiento del banco')) { Object.assign(guardado, cambios); unidos++; }
    }
    let quitados = 0;
    if (imp.caducados.length && await D.borrarMovimientos(imp.caducados.map(t => t.id), 'quitar los retenidos que ya no aparecen')) {
      E.txs = E.txs.filter(t => !imp.caducados.includes(t));
      quitados = imp.caducados.length;
    }
    E.txs.sort((a, b) => b.fecha.localeCompare(a.fecha));
    const saldoNuevo = imp.saldo && await actualizarSaldo(E, imp.banco, imp.saldo);
    const partes = [];
    if (guardadas.length) partes.push(`${guardadas.length} movimientos importados`);
    if (unidos) partes.push(`${unidos} ${unidos === 1 ? 'apuntado a mano juntado' : 'apuntados a mano juntados'} con el banco`);
    if (cobrados) partes.push(`${cobrados} ${cobrados === 1 ? 'retenido actualizado' : 'retenidos actualizados'}`);
    if (quitados) partes.push(`${quitados} ${quitados === 1 ? 'retenido quitado' : 'retenidos quitados'}`);
    if (saldoNuevo) partes.push(`saldo de ${nombreCuenta(imp.banco)} actualizado`);
    toast(partes.length ? partes.join(' · ') : 'No había nada nuevo');
    location.hash = guardadas.length || cobrados || unidos ? '#/movimientos' : '#/inicio';
  }
};

export const entradas = {
  'fecha-nuevo': (ctx, el) => { ctx.E.nuevo.fecha = el.value; },
  'concepto-nuevo': (ctx, el) => { ctx.E.nuevo.concepto = el.value; }
};

export const cambios = {
  'par-unir': (ctx, el) => {
    const x = ctx.E.importacion?.pares?.[+el.dataset.i];
    if (x) { x.unir = el.checked; ctx.pintar(); }
  },
  'archivo': async (ctx, el) => {
    const { E } = ctx;
    const archivo = el.files[0];
    if (!archivo) return;
    E.importacion = { leyendo: true }; ctx.pintar();
    try {
      const filas = await leerFilas(archivo);
      const r = analizarExtracto(filas, { reglas: E.reglas, hayTarjeta: E.txs.some(t => String(t.cuenta || '').endsWith('_tarjeta')) });
      // Los retenidos solo se incluyen si la base de datos tiene la columna «pendiente»
      const retenidos = E.conRetenidos ? (r.retenidos || []) : [];
      if (r.error) E.importacion = { error: r.error };
      else if (!r.txs.length && !retenidos.length) E.importacion = { error: 'No hemos encontrado movimientos en este archivo.' };
      else {
        const c = conciliarRetenidos(r.txs, retenidos, E.txs, r.banco);
        const guardadas = new Set(E.txs.map(D.claveMovimiento));
        const def = separarYaApuntados(c.definitivos.filter(t => !guardadas.has(D.claveMovimiento(t))), E.txs);
        const ret = separarYaApuntados(c.retenidosNuevos.filter(t => !guardadas.has(D.claveMovimiento(t))), E.txs);
        // Lo apuntado a mano que ahora sale en el extracto se junta con su movimiento del banco
        const m = r.tipo === 'efectivo' ? { quedan: [...def.quedan, ...ret.quedan], pares: [] }
          : emparejarApuntados([...def.quedan, ...ret.quedan], E.txs, [...r.txs, ...retenidos]);
        const nuevas = m.quedan.filter(t => !t.pendiente);
        E.importacion = {
          ...r, nuevas, retenidosNuevos: m.quedan.filter(t => t.pendiente), cobrados: c.cobrados, caducados: c.caducados,
          pares: m.pares.map(x => ({ ...x, unir: x.seguro })),
          deApplePay: def.repetidos.length + ret.repetidos.length,
          yaEstaban: r.txs.length - def.quedan.length - c.cobrados.length,
          retenidosSinColumna: E.conRetenidos ? 0 : (r.retenidos || []).length
        };
      }
    } catch (e) {
      console.error(e);
      E.importacion = { error: 'No se ha podido leer el archivo. ¿Es un Excel o un CSV?' };
    }
    ctx.pintar();
  }
};

// Instrucciones para crear en la app Atajos la automatización que manda cada pago a Pulso Joven
function hojaApplePay(codigo) {
  const url = `${D.SUPABASE_URL}/rest/v1/rpc/pj_apuntar_pago`;
  const dato = (titulo, valor, que) => `<div style="display:flex;flex-direction:column;gap:4px;margin:8px 0">
    <span class="nota">${titulo}</span>
    <div style="display:flex;align-items:center;gap:8px;background:var(--fondo);border-radius:12px;padding:6px 6px 6px 12px">
      <code style="flex:1;min-width:0;font-size:12px;word-break:break-all;user-select:all">${esc(valor)}</code>
      <button type="button" class="boton peq" style="height:36px;font-size:13px;padding:0 12px;flex-shrink:0" data-accion="copiar" data-texto="${esc(valor)}" data-que="${que}">Copiar</button>
    </div></div>`;
  const paso = (n, html) => `<div style="display:flex;gap:10px"><b class="num" style="width:24px;height:24px;border-radius:12px;background:var(--tinta);color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${n}</b><div style="font-size:14px;line-height:1.5;min-width:0;flex:1">${html}</div></div>`;
  abrirHoja(`${cabeceraHoja('Atajo de Apple Pay', 'Se configura una sola vez · iOS 17 o posterior')}
    ${paso(1, 'Abre la app <b>Atajos</b>, ve a la pestaña <b>Automatización</b> y pulsa <b>+</b> (Nueva automatización).')}
    ${paso(2, 'Elige <b>Wallet</b> (en versiones anteriores, <b>Transacción</b>). Marca tus tarjetas, elige <b>Ejecutar inmediatamente</b> y pulsa <b>Siguiente</b>.')}
    ${paso(3, 'Pulsa <b>Nuevo atajo en blanco</b> y añade la acción <b>Obtener contenido de URL</b>. Donde pone <b>URL</b>, pega esta dirección:' + dato('Dirección', url, 'Dirección'))}
    ${paso(4, 'Toca la flecha de la acción para ver más opciones:<br>· <b>Método</b>: POST<br>· <b>Cabeceras</b>: añade una con clave <code>apikey</code> y este valor:' + dato('Valor de apikey', D.SUPABASE_KEY, 'Clave'))}
    ${paso(5, '· <b>Cuerpo de la solicitud</b>: JSON. Añade tres campos de tipo <b>Texto</b>:<br>— <code>codigo</code> con tu código personal:' + dato('Tu código personal (no lo compartas)', codigo, 'Código') +
      '— <code>importe</code>: toca el valor y elige la variable <b>Entrada del atajo</b>; después tócala otra vez y elige <b>Importe</b>.<br>— <code>comercio</code>: igual, pero eligiendo <b>Comercio</b>.')}
    ${paso(6, 'Opcional: añade la acción <b>Mostrar notificación</b> con la variable <b>Contenido de la URL</b>. Así verás «Apuntado en Pulso Joven: 12,50 €» al pagar.')}
    ${paso(7, 'Pulsa <b>OK</b>. Paga con Apple Pay en una tienda y el gasto aparecerá en Movimientos. La primera vez en cada comercio puede salir «Sin categoría»: dásela y la app la recordará.')}
    <p class="nota">Si algún nombre no coincide en tu iPhone, haz una captura y pregunta. Tu código solo sirve para apuntar gastos en tu cuenta, no para ver nada.</p>
    <button type="button" class="boton suave peq" data-accion="cambiar-codigo">Cambiar mi código</button>`, 'Atajo de Apple Pay');
}

// Guarda el saldo del banco que trae el extracto, salvo que ya hubiera uno más reciente (de otro extracto posterior)
async function actualizarSaldo(E, banco, saldo) {
  if (!E.cuentas || banco === 'generico') return false;
  const actual = E.cuentas.find(c => c.clave === banco);
  if (actual && actual.fecha_saldo > saldo.fecha) return false;
  const fila = await D.guardarSaldoBanco(banco, actual?.nombre || nombreCuenta(banco), saldo.valor, saldo.fecha);
  if (!fila) return false;
  E.cuentas = [...E.cuentas.filter(c => c.clave !== banco), fila];
  return true;
}
