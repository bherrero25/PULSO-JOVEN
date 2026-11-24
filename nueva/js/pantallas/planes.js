// Planes: Presupuesto, Metas e Inversión

import { ic } from '../iconos.js';
import { esc, fmt, fmt0, nombreMes, mesActual, ritmoDelMes, estadoPresupuestos, resumenMes, sumarMeses, CATEGORIAS, categoriaPorId, infoCategoria, hoyISO } from '../logica.js';
import { ficha, barraPresupuesto, textoEstado, segmentoPlanes, selectorMes } from '../componentes.js';
import { planMeta } from './inicio.js';
import { abrirHoja, cerrarHoja, cabeceraHoja, toast, confirmar } from '../ui.js';
import * as D from '../datos.js';

const cabecera = (E, sub) => `<header class="cabecera"><h1 class="titulo num">Planes</h1>${sub}</header>${segmentoPlanes(E)}`;

// ─── PRESUPUESTO ───
export function presupuesto(E) {
  const pres = estadoPresupuestos(E.presupuestos, E.txs, E.mes);
  const ritmo = ritmoDelMes(E.mes);
  const usado = pres.reduce((s, p) => s + p.gastado, 0), total = pres.reduce((s, p) => s + p.limite, 0);
  const queda = total - usado;
  const consejo = !ritmo.abierto ? (queda >= 0 ? `Mes cerrado: te sobraron ${fmt(queda)} del total` : `Mes cerrado: te pasaste ${fmt(-queda)} del total`)
    : queda >= 0 ? `Te quedan ${fmt(queda)} para ${ritmo.quedan} ${ritmo.quedan === 1 ? 'día' : 'días'}: unos ${fmt(queda / ritmo.quedan)} al día` : `Te has pasado ${fmt(-queda)} del total`;
  return `${cabecera(E, selectorMes(E, { peq: true }))}
  ${pres.length ? `<section class="tarjeta-tinta" aria-label="Total presupuestado">
    <span class="etiqueta">${ritmo.abierto ? `Día ${ritmo.dia} de ${ritmo.dias} · llevas usado` : 'Usado en el mes'}</span>
    <div style="display:flex;align-items:baseline;gap:8px"><span class="num" style="font-size:34px;font-weight:600">${fmt(usado)}</span><span class="num" style="font-size:15px;color:var(--texto-claro-2)">de ${fmt0(total)}</span></div>
    <div class="progreso gruesa tinta"><i style="width:${Math.min(100, usado / total * 100)}%"></i>${ritmo.abierto ? `<span class="marca-ritmo" style="left:${ritmo.dia / ritmo.dias * 100}%"></span>` : ''}</div>
    <span class="lima" style="font-size:13px;font-weight:500">${consejo}</span>
  </section>` : ''}
  <section class="tarjeta lista" aria-label="Por categoría">
    ${pres.map(p => `<div class="presu fila" style="flex-direction:column;align-items:stretch;gap:8px;padding:12px 0">
      <div class="cab">${ficha(p.cat)}
        <div style="flex:1;display:flex;flex-direction:column;gap:1px"><span style="font-size:15px;font-weight:500">${esc(p.cat.nombre)}</span><span class="estado ${p.estado}">${p.estado === 'bien' ? `Bien · ${p.pct} %` : textoEstado(p)}</span></div>
        <span class="cifras num">${fmt0(p.gastado)} / ${fmt0(p.limite)}</span>
        <button type="button" class="boton-redondo" style="width:40px;height:40px;border-radius:12px" data-accion="editar-presupuesto" data-cat="${esc(p.categoria)}" aria-label="Cambiar límite de ${esc(p.cat.nombre)}">${ic('editar', 'ic-s')}</button>
      </div>
      ${barraPresupuesto(p, ritmo)}
    </div>`).join('')}
    ${pres.length ? '' : '<p class="vacio">Aún no tienes presupuestos. Pon un límite a lo que más te importa controlar.</p>'}
    <button type="button" class="boton suave peq" style="border:none;margin:4px 0" data-accion="editar-presupuesto" data-cat="">${ic('mas')}Nuevo presupuesto</button>
  </section>
  <p class="nota" style="margin:0 4px">Los límites se mantienen cada mes hasta que los cambies.${ritmo.abierto && pres.length ? ' La marca gris de cada barra indica dónde deberías ir hoy.' : ''}</p>`;
}

function hojaPresupuesto(E, categoria) {
  const p = estadoPresupuestos(E.presupuestos, E.txs, mesActual()).find(x => x.categoria === categoria);
  const usadas = new Set(estadoPresupuestos(E.presupuestos, E.txs, mesActual()).map(x => x.categoria));
  const libres = CATEGORIAS.filter(c => c.tipo === 'gasto' && c.id !== 'reenviado' && !usadas.has(c.bd));
  // Gasto medio de los 3 meses completos anteriores, como referencia
  const media = cat => [1, 2, 3].reduce((s, i) => s + resumenMes(E.txs, sumarMeses(mesActual(), -i)).gastos.filter(t => t.categoria === cat).reduce((a, t) => a + +t.importe, 0), 0) / 3;
  abrirHoja(`${cabeceraHoja(p ? `Límite de ${esc(p.cat.nombre.toLowerCase())}` : 'Nuevo presupuesto')}
    ${p ? '' : `<label class="campo">Categoría<select id="pres-cat">${libres.map(c => `<option value="${esc(c.bd)}">${esc(c.nombre)}</option>`).join('')}</select></label>`}
    <label class="campo">Límite al mes (€)<input type="number" id="pres-limite" inputmode="decimal" min="1" step="5" value="${p ? p.limite : ''}" placeholder="Por ejemplo, 150"></label>
    <span class="nota">Se aplica desde ${nombreMes(mesActual()).toLowerCase()} en adelante; los meses anteriores conservan su límite.</span>
    ${p ? `<span class="nota">Tu gasto medio en ${esc(p.cat.nombre.toLowerCase())} los últimos 3 meses: ${fmt0(media(categoria))} al mes</span>` : ''}
    <button type="button" class="boton" data-accion="guardar-presupuesto" data-cat="${esc(categoria)}">Guardar</button>
    ${p ? `<button type="button" class="boton peligro peq" data-accion="quitar-presupuesto" data-cat="${esc(categoria)}">${ic('papelera')}Quitar este presupuesto</button>` : ''}`,
  p ? 'Cambiar límite' : 'Nuevo presupuesto');
}

// ─── METAS ───
export function metas(E) {
  const anterior = sumarMeses(mesActual(), -1);
  const sobro = resumenMes(E.txs, anterior).queda;
  const total = E.metas.reduce((s, m) => s + +m.ahorrado, 0);
  return `${cabecera(E, `<span class="sub">Ahorrado: ${fmt0(total)}</span>`)}
  ${sobro > 0 && E.metas.some(m => +m.ahorrado < +m.objetivo) ? `<section class="tarjeta-tinta" style="padding:16px">
    <div style="display:flex;gap:12px;align-items:flex-start"><span class="ficha" style="background:var(--tinta-2);color:var(--lima)">${ic('tendencia')}</span>
      <span style="font-size:14px;line-height:1.45">En ${nombreMes(anterior, { año: false }).toLowerCase()} te sobraron <b class="num lima">${fmt(sobro)}</b>. ¿Los pasas a una meta?</span></div>
    <button type="button" class="boton lima peq" data-accion="aportar" data-id="" data-cantidad="${sobro.toFixed(2)}">Pasar a una meta</button>
  </section>` : ''}
  <div class="rejilla-auto">
  ${E.metas.map(m => {
    const plan = planMeta(m);
    const hecha = +m.ahorrado >= +m.objetivo;
    return `<article class="tarjeta">
      <div style="display:flex;align-items:center;gap:12px">
        <span class="ficha grande" style="font-size:22px">${esc(m.emoji || '🎯')}</span>
        <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:16px;font-weight:600">${esc(m.nombre)}</span><span class="nota">${m.fecha_limite ? `${fechaLarga(m.fecha_limite)} · ${plan.cuando}` : 'Sin fecha límite'}</span></div>
        <span class="num" style="font-size:20px;font-weight:600">${plan.pct} %</span>
      </div>
      <div class="progreso gruesa" style="height:10px;border-radius:5px"><i style="width:${plan.pct}%${hecha ? ';background:#7FA80F' : ''}"></i></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--texto-2)"><span class="num">${fmt0(m.ahorrado)} ahorrados</span><span class="num">Meta: ${fmt0(m.objetivo)}</span></div>
      ${hecha ? `<div style="display:flex;align-items:center;gap:8px;height:44px;padding:0 12px;border-radius:12px;background:#F1FAD6;font-size:14px;font-weight:600">${ic('ok')}¡Conseguida!</div>` : `
        ${plan.plan ? `<span style="font-size:13px;color:#33393F">${plan.plan}</span>` : ''}
        <div style="display:flex;gap:8px">
          <button type="button" class="boton suave peq" style="flex:1;font-size:14px" data-accion="aportar-rapido" data-id="${esc(m.id)}" data-cantidad="10">+ 10 €</button>
          <button type="button" class="boton suave peq" style="flex:1;font-size:14px" data-accion="aportar-rapido" data-id="${esc(m.id)}" data-cantidad="50">+ 50 €</button>
          <button type="button" class="boton suave peq" style="flex:1;font-size:14px" data-accion="aportar" data-id="${esc(m.id)}">Otra</button>
        </div>`}
      <button type="button" class="enlace" style="align-self:flex-start;padding:4px 0;color:var(--texto-3);font-weight:500" data-accion="borrar-meta" data-id="${esc(m.id)}">Eliminar meta</button>
    </article>`;
  }).join('')}
  </div>
  <button type="button" class="boton suave" style="border:1.5px dashed #C9CED6;background:transparent" data-accion="nueva-meta">${ic('mas')}Nueva meta</button>`;
}
const fechaLarga = f => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

async function aportar(ctx, id, cantidad) {
  const m = ctx.E.metas.find(x => String(x.id) === String(id));
  if (!m || !(cantidad > 0)) return;
  const nuevo = Math.min(+m.objetivo, +m.ahorrado + cantidad);
  if (!await D.actualizarMeta(m.id, { ahorrado: nuevo })) return;
  m.ahorrado = nuevo;
  toast(nuevo >= +m.objetivo ? `¡Meta «${m.nombre}» conseguida!` : `${fmt(cantidad)} añadidos a «${m.nombre}»`);
  ctx.pintar();
}

// ─── INVERSIÓN ───
const PERFILES = [['prudente', 'Prudente', 3], ['equilibrado', 'Equilibrado', 6], ['decidido', 'Decidido', 8]];

export function inversion(E) {
  const v = E.inv;
  return `${cabecera(E, '<span class="sub">Simulador</span>')}
  <div class="rejilla-auto">
  <div id="inv-resultado" style="display:flex;flex-direction:column;gap:12px">${resultadoInversion(v)}</div>
  <section class="tarjeta" aria-label="Ajustes" style="gap:14px">
    <label class="campo" style="font-size:14px;color:var(--texto)"><span style="display:flex;justify-content:space-between"><span>Cada mes</span><b class="num" id="inv-mensual-txt">${v.mensual} €</b></span>
      <input type="range" min="10" max="500" step="10" value="${v.mensual}" data-entrada="inv-mensual" style="accent-color:var(--tinta);height:28px"></label>
    <label class="campo" style="font-size:14px;color:var(--texto)"><span style="display:flex;justify-content:space-between"><span>Durante</span><b class="num" id="inv-anos-txt">${v.anos} años</b></span>
      <input type="range" min="1" max="40" step="1" value="${v.anos}" data-entrada="inv-anos" style="accent-color:var(--tinta);height:28px"></label>
    <div class="rejilla-cats" style="grid-template-columns:repeat(3,minmax(0,1fr))" role="group" aria-label="Perfil">
      ${PERFILES.map(([k, n, t]) => `<button type="button" data-accion="inv-perfil" data-valor="${k}" aria-pressed="${v.perfil === k}"><b style="font-size:13px">${n}</b><span class="num nota">${t} % al año</span></button>`).join('')}
    </div>
  </section>
  </div>
  <p class="nota" style="display:flex;gap:8px;margin:0 4px">${ic('info', 'ic-s')}Simulación orientativa con una rentabilidad anual fija. Las rentabilidades pasadas no garantizan las futuras. No es asesoramiento financiero.</p>`;
}

function resultadoInversion(v) {
  const tasa = PERFILES.find(p => p[0] === v.perfil)[2];
  const r = tasa / 100 / 12;
  const fv = meses => r === 0 ? v.mensual * meses : v.mensual * (Math.pow(1 + r, meses) - 1) / r;
  const total = fv(v.anos * 12), aportado = v.mensual * v.anos * 12;
  const W = 320, B = 130, H = 120;
  const y = x => (B - x / total * H).toFixed(1), x = i => (i / v.anos * W).toFixed(1);
  const pts = [];
  for (let i = 0; i <= v.anos; i++) pts.push([x(i), y(v.mensual * 12 * i), y(fv(12 * i))]);
  const areaAp = `M0,${B} ` + pts.map(p => `L${p[0]},${p[1]}`).join(' ') + ` L${W},${B} Z`;
  const areaGan = 'M' + pts.map(p => `${p[0]},${p[2]}`).join(' L') + ' ' + pts.slice().reverse().map(p => `L${p[0]},${p[1]}`).join(' ') + ' Z';
  return `<section class="tarjeta-tinta" aria-label="Resultado" style="gap:6px">
      <span class="etiqueta" style="gap:0">En ${v.anos} ${v.anos === 1 ? 'año' : 'años'} podrías tener</span>
      <span class="num" style="font-size:40px;font-weight:600;line-height:1.05">${fmt0(total)}</span>
      <span class="lima" style="font-size:13px;font-weight:500">Tú pones ${fmt0(aportado)} · el interés compuesto añade ${fmt0(total - aportado)}</span>
    </section>
    <section class="tarjeta" aria-label="Evolución" style="gap:10px">
      <svg viewBox="0 0 320 140" role="img" aria-label="Aportas ${fmt0(aportado)} y los intereses suman ${fmt0(total - aportado)}" style="width:100%;height:auto;display:block">
        <line x1="0" y1="130" x2="320" y2="130" stroke="#C3C2B7"/><line x1="0" y1="70" x2="320" y2="70" stroke="#ECECE8"/><line x1="0" y1="10" x2="320" y2="10" stroke="#ECECE8"/>
        <path d="${areaGan}" fill="#1baf7a" fill-opacity=".85"/><path d="${areaAp}" fill="#2a78d6" fill-opacity=".9"/>
        <path d="M${pts.map(p => `${p[0]},${p[2]}`).join(' L')}" fill="none" stroke="#111418" stroke-width="2"/>
      </svg>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#6E6D68"><span>Hoy</span><span>Año ${Math.round(v.anos / 2)}</span><span>Año ${v.anos}</span></div>
      <div class="leyenda"><span><i class="cuadro" style="background:#2a78d6"></i>Lo que aportas</span><span><i class="cuadro" style="background:#1baf7a"></i>Lo que generan los intereses</span></div>
    </section>`;
}

// ─── ACCIONES ───
export const acciones = {
  'editar-presupuesto': (ctx, el) => hojaPresupuesto(ctx.E, el.dataset.cat),
  'guardar-presupuesto': async (ctx, el) => {
    const categoria = el.dataset.cat || document.getElementById('pres-cat')?.value;
    const limite = parseFloat(document.getElementById('pres-limite').value);
    if (!categoria) return;
    if (!(limite > 0)) { document.getElementById('pres-limite').focus(); toast('Pon un límite mayor que 0'); return; }
    const fila = await D.guardarPresupuesto(categoria, limite, mesActual());
    if (!fila) return;
    const E = ctx.E;
    E.presupuestos = E.presupuestos.filter(p => !(p.categoria === categoria && p.mes === mesActual()));
    E.presupuestos.push({ ...fila, limite });
    cerrarHoja();
    toast(`Límite de ${infoCategoria(categoria).nombre.toLowerCase()}: ${fmt0(limite)} al mes`);
    ctx.pintar();
  },
  'quitar-presupuesto': async (ctx, el) => {
    const categoria = el.dataset.cat;
    if (!await confirmar('¿Quitar este presupuesto?', `Dejarás de tener límite para ${esc(infoCategoria(categoria).nombre.toLowerCase())}.`, 'Quitar')) return;
    if (!await D.borrarPresupuesto(categoria)) return;
    ctx.E.presupuestos = ctx.E.presupuestos.filter(p => p.categoria !== categoria);
    toast('Presupuesto quitado');
    ctx.pintar();
  },

  'aportar-rapido': (ctx, el) => aportar(ctx, el.dataset.id, parseFloat(el.dataset.cantidad)),
  'aportar': (ctx, el) => {
    const abiertas = ctx.E.metas.filter(m => +m.ahorrado < +m.objetivo);
    const id = el.dataset.id;
    abrirHoja(`${cabeceraHoja('Añadir a una meta')}
      ${id ? `<input type="hidden" id="ap-meta" value="${esc(id)}">` : `<label class="campo">Meta<select id="ap-meta">${abiertas.map(m => `<option value="${esc(m.id)}">${esc(m.emoji || '🎯')} ${esc(m.nombre)}</option>`).join('')}</select></label>`}
      <label class="campo">Cantidad (€)<input type="number" id="ap-cantidad" inputmode="decimal" min="1" step="1" value="${el.dataset.cantidad || ''}"></label>
      <button type="button" class="boton" data-accion="confirmar-aporte">Añadir</button>`, 'Añadir a una meta');
  },
  'confirmar-aporte': async (ctx) => {
    const id = document.getElementById('ap-meta').value, cantidad = parseFloat(document.getElementById('ap-cantidad').value);
    if (!(cantidad > 0)) { toast('Pon una cantidad'); return; }
    cerrarHoja();
    await aportar(ctx, id, cantidad);
  },
  'nueva-meta': () => abrirHoja(`${cabeceraHoja('Nueva meta')}
      <div class="par" style="grid-template-columns:72px 1fr">
        <label class="campo">Emoji<input type="text" id="meta-emoji" maxlength="2" placeholder="🎯" style="text-align:center;font-size:20px"></label>
        <label class="campo">Nombre<input type="text" id="meta-nombre" maxlength="40" placeholder="Viaje, portátil, carné…"></label>
      </div>
      <div class="par">
        <label class="campo">Objetivo (€)<input type="number" id="meta-objetivo" inputmode="decimal" min="1" placeholder="600"></label>
        <label class="campo">Fecha límite<input type="date" id="meta-fecha" min="${hoyISO(1)}"></label>
      </div>
      <button type="button" class="boton" data-accion="crear-meta">Crear meta</button>`, 'Nueva meta'),
  'crear-meta': async (ctx) => {
    const nombre = document.getElementById('meta-nombre').value.trim();
    const objetivo = parseFloat(document.getElementById('meta-objetivo').value);
    if (!nombre || !(objetivo > 0)) { toast('Pon nombre y objetivo'); return; }
    const meta = await D.crearMeta({ nombre, emoji: document.getElementById('meta-emoji').value.trim() || '🎯', objetivo, ahorrado: 0, fecha_limite: document.getElementById('meta-fecha').value || null });
    if (!meta) return;
    ctx.E.metas.push(meta);
    cerrarHoja();
    toast(`Meta «${nombre}» creada`);
    ctx.pintar();
  },
  'borrar-meta': async (ctx, el) => {
    const m = ctx.E.metas.find(x => String(x.id) === el.dataset.id);
    if (!await confirmar('¿Eliminar esta meta?', `«${esc(m.nombre)}» y lo que llevas apuntado (${fmt0(m.ahorrado)}). No se puede deshacer.`, 'Eliminar')) return;
    if (!await D.borrarMeta(m.id)) return;
    ctx.E.metas.splice(ctx.E.metas.indexOf(m), 1);
    toast('Meta eliminada');
    ctx.pintar();
  },

  'inv-perfil': (ctx, el) => { ctx.E.inv.perfil = el.dataset.valor; ctx.pintar(); }
};

// Los deslizadores solo repintan el resultado, para no cortar el gesto
export const entradas = {
  'inv-mensual': (ctx, el) => { ctx.E.inv.mensual = Number(el.value); document.getElementById('inv-mensual-txt').textContent = el.value + ' €'; document.getElementById('inv-resultado').innerHTML = resultadoInversion(ctx.E.inv); },
  'inv-anos': (ctx, el) => { ctx.E.inv.anos = Number(el.value); document.getElementById('inv-anos-txt').textContent = el.value + ' años'; document.getElementById('inv-resultado').innerHTML = resultadoInversion(ctx.E.inv); }
};
