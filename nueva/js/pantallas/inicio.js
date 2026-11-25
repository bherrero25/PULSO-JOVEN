// Inicio: de un vistazo, lo que te queda, lo que ha entrado y salido, cómo van los presupuestos y la meta más cercana

import { ic } from '../iconos.js';
import { esc, fmt, fmt0, nombreMes, resumenMes, ritmoDelMes, estadoPresupuestos, porRevisar, gastoHastaDia, sumarMeses, porCategoria, hoyISO, fechaCorta, TIPOS_CUENTA, totalCuentas, saldoDisponible } from '../logica.js';
import { selectorMes, filaMovimiento, ficha, barraPresupuesto, textoEstado, inicial } from '../componentes.js';

// Botones para apuntar a mano en dos toques: abren el formulario ya preparado
const RAPIDOS = [['gasto', 'tarjeta', 'Gasto', 'menos'], ['ingreso', 'transferencia', 'Ingreso', 'mas'], ['gasto', 'bizum', 'Bizum', 'movil'], ['gasto', 'transferencia', 'Transferencia', 'banco']];

export function render(E) {
  const R = resumenMes(E.txs, E.mes);
  const ritmo = ritmoDelMes(E.mes);
  const mes = nombreMes(E.mes, { año: false }).toLowerCase();
  const pctGastado = R.ingresado > 0 ? Math.round(R.totalGastos / R.ingresado * 100) : 0;
  let etiqueta, sub;
  // Balance del mes: lo que ha entrado menos lo que se ha gastado (no es el saldo de la cuenta: eso está en «Tu dinero»)
  if (ritmo.abierto) {
    etiqueta = 'Balance mensual';
    sub = R.queda > 0 ? `Puedes gastar ${fmt(R.queda / ritmo.quedan)} al día · ${ritmo.quedan === 1 ? 'queda 1 día' : `quedan ${ritmo.quedan} días`}` : 'Has gastado más de lo que ha entrado';
  } else {
    etiqueta = `Balance de ${mes}`;
    sub = R.queda > 0 ? 'Mes cerrado · puedes pasarlo a una meta' : 'Mes cerrado · gastaste más de lo que entró';
  }
  const nRevisar = R.movs.filter(t => porRevisar(t, E.reglas)).length;
  const pres = estadoPresupuestos(E.presupuestos, E.txs, E.mes);
  const superados = pres.filter(p => p.estado === 'superado').length;

  // Comparación justa: el mes anterior hasta el mismo día
  const anterior = sumarMeses(E.mes, -1);
  const antHastaHoy = gastoHastaDia(E.txs, anterior, ritmo.dia);
  const difGasto = R.totalGastos - antHastaHoy;
  const fuentes = porCategoria(R.ingresos).slice(0, 3).map(g => `${g.cat.nombre.toLowerCase()} ${fmt0(g.total)}`).join(' · ');
  const mayor = R.gastos.reduce((m, t) => !m || +t.importe > +m.importe ? t : m, null);

  const ultimos = [...R.movs].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);
  const meta = metaCercana(E.metas);

  return `
  <header class="cabecera">
    <div style="display:flex;flex-direction:column;gap:2px">
      <span class="saludo">Hola, ${esc(E.nombre)}</span>
      ${selectorMes(E)}
    </div>
    <button type="button" class="avatar solo-movil" data-accion="cuenta" aria-label="Tu cuenta">${esc(inicial(E))}</button>
  </header>

  <div class="fila-flex">
    <section class="tarjeta-tinta ancha" aria-label="Balance del mes">
      <div class="etiqueta"><span class="punto"></span>${etiqueta}</div>
      <div class="cifra num">${R.queda < 0 ? '−' : ''}${fmt(R.queda)}</div>
      <div class="lima" style="font-size:13px;font-weight:500">${sub}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="progreso gruesa tinta"><i style="width:${Math.min(pctGastado, 100)}%"></i></div>
        <span style="font-size:12px;color:var(--texto-claro-2)">${R.ingresado > 0 ? `Has gastado el ${pctGastado} % de lo que ha entrado` : 'Aún no ha entrado dinero este mes'}</span>
      </div>
      <div class="dos-col separador-tinta solo-movil">
        <div class="dato"><small>Ingresado</small><b class="num">${fmt(R.ingresado, true)}</b></div>
        <div class="dato"><small>Gastado</small><b class="num">${fmt(-R.totalGastos, true)}</b></div>
      </div>
    </section>
    <section class="tarjeta solo-ordenador" aria-label="Ingresado">
      <span class="sub">Ingresado</span>
      <span class="cifra-m num positivo">${fmt(R.ingresado, true)}</span>
      <span class="nota">${fuentes || 'Nada todavía'}${R.totalPaso ? ` · dinero de paso ${R.totalPaso > 0 ? '−' : '+'}${fmt0(Math.abs(R.totalPaso))}` : ''}</span>
    </section>
    <section class="tarjeta solo-ordenador" aria-label="Gastado">
      <span class="sub">Gastado</span>
      <span class="cifra-m num">${fmt(-R.totalGastos, true)}</span>
      <span class="nota">${R.gastos.length} gastos${mayor ? ` · el mayor: ${esc(mayor.descripcion)}, ${fmt(mayor.importe)}` : ''}</span>
      ${antHastaHoy > 0 ? `<span class="nota" style="font-weight:600;color:${difGasto <= 0 ? 'var(--positivo)' : 'var(--critico-texto)'}">${difGasto <= 0 ? '▼' : '▲'} ${fmt(Math.abs(difGasto))} ${difGasto <= 0 ? 'menos' : 'más'} que ${nombreMes(anterior, { año: false }).toLowerCase()} ${ritmo.abierto ? 'a estas alturas' : ''}</span>` : ''}
    </section>
    <section class="tarjeta solo-ordenador" aria-label="Ahorro">
      <span class="sub">Ahorro del mes</span>
      <span class="cifra-m num">${R.ingresado > 0 ? Math.max(0, Math.round(R.queda / R.ingresado * 100)) : 0} %</span>
      <span class="nota">de lo que entra se queda contigo · objetivo: 20 %</span>
    </section>
  </div>

  <nav class="rapidos" aria-label="Apuntar rápido">
    ${RAPIDOS.map(([tipo, medio, texto, icono]) => `<a href="#/anadir?tipo=${tipo}&medio=${medio}"><span class="ficha">${ic(icono)}</span>${texto}</a>`).join('')}
  </nav>

  ${tarjetaDinero(E)}

  ${nRevisar ? `<a href="#/movimientos" class="aviso-revisar" data-accion="ir-revisar">${ic('alerta')}<span><b>${nRevisar} ${nRevisar === 1 ? 'movimiento' : 'movimientos'}</b> sin categoría</span><b style="display:flex;align-items:center">Revisar${ic('derecha', 'ic-s')}</b></a>` : ''}

  <div class="rejilla-auto">
    <section class="tarjeta" aria-label="Presupuestos">
      <div class="fila-titulo">
        <div style="display:flex;align-items:center;gap:8px"><h2 class="h2">Presupuestos</h2>${superados ? `<span class="pastilla critica">${superados} ${superados === 1 ? 'superado' : 'superados'}</span>` : ''}</div>
        <a href="#/presupuesto" class="enlace">${pres.length ? 'Ver todos' : 'Crear'}</a>
      </div>
      ${pres.length ? pres.slice(0, 4).map(p => `
        <div class="presu">
          <div class="cab">${ficha(p.cat, 'peq')}<span class="nombre">${esc(p.cat.nombre)}</span>
            <span class="estado ${p.estado}">${p.estado === 'bien' ? '' : textoEstado(p).split(' · ')[0]}</span>
            <span class="cifras num">${fmt0(p.gastado)} / ${fmt0(p.limite)}</span></div>
          ${barraPresupuesto(p, ritmo)}
        </div>`).join('') + (ritmo.abierto ? `<span class="nota">La marca gris indica dónde deberías ir hoy (día ${ritmo.dia} de ${ritmo.dias})</span>` : '')
        : '<p class="nota">Pon un límite a lo que más te importa controlar (comida, ocio…) y aquí verás cómo vas.</p>'}
    </section>

    ${meta ? `<a href="#/metas" class="tarjeta" aria-label="Meta más cercana">
      <div class="fila-titulo"><span class="sub">Meta más cercana</span><span class="sub">${meta.cuando}</span></div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="ficha" style="font-size:19px">${esc(meta.emoji || '🎯')}</span>
        <span style="flex:1;font-size:15px;font-weight:600">${esc(meta.nombre)}</span>
        <span class="num texto-2" style="font-size:14px">${fmt0(meta.ahorrado)} de ${fmt0(meta.objetivo)}</span>
      </div>
      <div class="progreso"><i style="width:${meta.pct}%"></i></div>
      ${meta.plan ? `<span class="nota">${meta.plan}</span>` : ''}
    </a>` : ''}

    <section class="tarjeta" aria-label="Últimos movimientos" style="gap:4px">
      <div class="fila-titulo"><h2 class="h2">Últimos movimientos</h2><a href="#/movimientos" class="enlace">Ver todos</a></div>
      ${ultimos.length ? ultimos.map(t => filaMovimiento(t, E)).join('') : `<p class="vacio">Aún no hay movimientos en ${mes}.<br><a href="#/anadir" style="font-weight:600;text-decoration:underline">Añade el primero</a></p>`}
    </section>
  </div>`;
}

// «Tu dinero»: lo que tienes en cada sitio (saldo del banco según el último extracto, efectivo, ahorro) y el total
function tarjetaDinero(E) {
  const cab = `<div class="fila-titulo"><h2 class="h2">Tu dinero</h2>${E.cuentas && E.cuentas.length ? '<button type="button" class="enlace" data-accion="gestionar-cuentas">Gestionar</button>' : ''}</div>`;
  if (E.cuentas === null) {
    return `<section class="tarjeta" aria-label="Tu dinero">${cab}<p class="nota">Para ver cuánto tienes en total falta preparar la base de datos: hay que ejecutar en Supabase el texto <b>sql/2026-11-cuentas.sql</b> del proyecto.</p></section>`;
  }
  if (!E.cuentas.length) {
    return `<section class="tarjeta" aria-label="Tu dinero">${cab}
      <p class="nota">Apunta cuánto tienes. El saldo del banco se pone solo al importar el extracto; el efectivo y los ahorros los añades tú. No cuenta como ingreso de ningún mes.</p>
      <button type="button" class="boton suave peq" data-accion="editar-cuenta" data-id="">${ic('mas')}Añadir efectivo o ahorro</button></section>`;
  }
  const filas = [...E.cuentas].sort((a, b) => parseFloat(b.saldo) - parseFloat(a.saldo)).map(c => filaCuenta(c, E.txs, false, E.cuentas)).join('');
  const total = totalCuentas(E.cuentas, E.txs);
  return `<section class="tarjeta" aria-label="Tu dinero" style="gap:6px">${cab}
    <div style="display:flex;align-items:baseline;gap:8px"><span class="cifra-m num">${total < 0 ? '−' : ''}${fmt(total)}</span><span class="nota">en total</span></div>
    <div class="lista-cuentas">${filas}</div></section>`;
}

// En las cuentas de banco se enseña lo disponible: el saldo del extracto menos lo retenido, más lo apuntado después
export function filaCuenta(c, txs, conFlecha = false, cuentas = [c]) {
  const [tipo, icono] = TIPOS_CUENTA[c.tipo] || TIPOS_CUENTA.efectivo;
  const s = saldoDisponible(c, txs, cuentas);
  return `<button type="button" class="fila" data-accion="editar-cuenta" data-id="${esc(c.id)}">
    <span class="ficha">${ic(icono)}</span>
    <span class="cuerpo"><span class="concepto">${esc(c.nombre)}</span><span class="detalle">${tipo} · a ${fechaCorta(c.fecha_saldo)}${s.retenido > 0 ? ` · ${fmt(s.retenido)} retenido` : ''}${s.apuntado ? ` · ${fmt(s.apuntado, true)} apuntado después` : ''}</span></span>
    <span class="importe num">${s.disponible < 0 ? '−' : ''}${fmt(s.disponible)}</span>${conFlecha ? ic('derecha', 'ic-s') : ''}</button>`;
}

// La meta sin terminar con la fecha más próxima (o, si ninguna tiene fecha, la más avanzada)
export function metaCercana(metas) {
  const abiertas = metas.filter(m => +m.ahorrado < +m.objetivo);
  if (!abiertas.length) return null;
  const m = abiertas.sort((a, b) => (a.fecha_limite || '9999').localeCompare(b.fecha_limite || '9999') || b.ahorrado / b.objetivo - a.ahorrado / a.objetivo)[0];
  return { ...m, ...planMeta(m) };
}

export function planMeta(m) {
  const pct = Math.min(100, Math.round(m.ahorrado / m.objetivo * 100));
  const falta = m.objetivo - m.ahorrado;
  if (!m.fecha_limite) return { pct, cuando: 'sin fecha', plan: '' };
  const dias = Math.ceil((new Date(m.fecha_limite + 'T12:00:00') - new Date(hoyISO() + 'T12:00:00')) / 86400000);
  if (dias <= 0) return { pct, cuando: 'fecha pasada', plan: falta > 0 ? `Te faltan ${fmt0(falta)}` : '' };
  const meses = Math.max(1, dias / 30.4);
  return { pct, cuando: dias === 1 ? 'falta 1 día' : `faltan ${dias} días`, plan: falta > 0 ? `Aparta ${fmt0(falta / meses)} al mes para llegar a tiempo` : '' };
}
