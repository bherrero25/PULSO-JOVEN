// Pulso Joven: arranque, sesión, navegación entre pantallas y reparto de las acciones de la interfaz

import { SPRITE, ic } from './iconos.js';
import * as D from './datos.js';
import { esc, mesActual, sumarMeses, mesesDisponibles, porRevisar, resumenMes, clasificarPagosAtajo } from './logica.js';
import { abrirHoja, cerrarHoja, cabeceraHoja, hojaAbierta } from './ui.js';
import { barraInferior, menuLateral, marca, inicial } from './componentes.js';
import * as inicio from './pantallas/inicio.js';
import * as movimientos from './pantallas/movimientos.js';
import * as anadir from './pantallas/anadir.js';
import * as resumen from './pantallas/resumen.js';
import * as planes from './pantallas/planes.js';
import * as dinero from './pantallas/dinero.js';

// Estado de la app: datos de la persona y lo que tiene elegido en pantalla
const E = {
  usuario: null, nombre: '', cargado: false,
  txs: [], presupuestos: [], metas: [], reglas: {}, cuentas: null, conRetenidos: false,
  meses: [mesActual()], mes: mesActual(), pantalla: 'inicio',
  filtro: 'todos', q: '',
  tabAnadir: 'mano', nuevo: anadir.nuevoMovimiento(), importacion: null,
  inv: { mensual: 50, anos: 10, perfil: 'equilibrado' },
  modoEntrar: 'entrar'
};

const PANTALLAS = {
  inicio: inicio.render, movimientos: movimientos.render, anadir: anadir.render, resumen: resumen.render,
  presupuesto: planes.presupuesto, metas: planes.metas, inversion: planes.inversion
};

function pintar() {
  const raiz = document.getElementById('raiz');
  if (!E.cargado) { raiz.innerHTML = pantallaEntrar(); return; }
  E.meses = mesesDisponibles(E.txs);
  if (E.mes < E.meses[0]) E.mes = E.meses[0];
  if (E.mes > mesActual()) E.mes = mesActual();
  const render = PANTALLAS[E.pantalla];
  const nRevisar = resumenMes(E.txs, mesActual()).movs.filter(t => porRevisar(t, E.reglas)).length;
  const franja = D.enDemo() ? `<div class="franja-demo">${ic('info', 'ic-s')}<span>Estás viendo la demo: los cambios no se guardan.</span><button type="button" data-accion="salir">Crear cuenta</button></div>` : '';
  raiz.innerHTML = E.pantalla === 'anadir'
    ? `<div class="app">${menuLateral(E, nRevisar)}${render(E)}</div>`
    : `<div class="app">${menuLateral(E, nRevisar)}<main class="contenido${E.pantalla === 'movimientos' ? ' estrecho' : ''}">${franja}${render(E)}</main>${barraInferior(E)}</div>`;
}

function irA() {
  const anterior = E.pantalla;
  const p = location.hash.replace(/^#\/?/, '') || 'inicio';
  E.pantalla = PANTALLAS[p] ? p : 'inicio';
  if (anterior === 'anadir' && E.pantalla !== 'anadir') E.importacion = null;
  cerrarHoja();
  pintar();
  if (anterior !== E.pantalla) window.scrollTo(0, 0);
}

// ─── ENTRAR ───
function pantallaEntrar() {
  const crear = E.modoEntrar === 'crear';
  return `<div class="entrar">
    ${marca()}
    <p class="sub" style="margin-top:-14px">Tu dinero, claro y a tu ritmo</p>
    <form class="tarjeta" id="form-entrar" novalidate>
      <div class="segmentado" role="tablist" aria-label="Entrar o crear cuenta">
        <button type="button" role="tab" aria-selected="${!crear}" data-accion="modo-entrar" data-valor="entrar">Entrar</button>
        <button type="button" role="tab" aria-selected="${crear}" data-accion="modo-entrar" data-valor="crear">Crear cuenta</button>
      </div>
      ${crear ? '<label class="campo">Tu nombre<input type="text" id="acc-nombre" autocomplete="given-name" placeholder="Álex"></label>' : ''}
      <label class="campo">Email<input type="email" id="acc-email" autocomplete="email" placeholder="tu@email.com"></label>
      <label class="campo">Contraseña<input type="password" id="acc-pass" autocomplete="${crear ? 'new-password' : 'current-password'}" placeholder="${crear ? 'Mínimo 6 caracteres' : ''}"></label>
      <button type="submit" class="boton">${crear ? 'Crear cuenta' : 'Entrar'}</button>
      <p class="mensaje" id="acc-msg" role="status"></p>
      <div style="border-top:1px solid var(--linea);padding-top:16px;display:flex;flex-direction:column;gap:10px;align-items:center">
        <span class="nota">¿Quieres verla antes?</span>
        <button type="button" class="boton suave peq" style="width:100%" data-accion="demo">Ver la demo con datos de ejemplo</button>
      </div>
    </form>
    <a href="../" class="nota" style="text-decoration:underline">Volver a la portada</a>
  </div>`;
}

async function enviarEntrar() {
  const msg = document.getElementById('acc-msg');
  const email = document.getElementById('acc-email').value.trim(), pass = document.getElementById('acc-pass').value;
  msg.className = 'mensaje';
  if (E.modoEntrar === 'crear') {
    const nombre = document.getElementById('acc-nombre').value.trim();
    if (!nombre) { msg.textContent = 'Pon tu nombre'; return; }
    msg.textContent = 'Creando la cuenta…';
    const { error, sesion, usuario } = await D.registrarse(nombre, email, pass);
    if (error) { msg.textContent = D.mensajeCuenta(error); return; }
    if (sesion) { await empezar(usuario); return; }
    msg.className = 'mensaje ok';
    msg.textContent = 'Cuenta creada. Te hemos enviado un correo para confirmarla (mira también en spam). Después, entra aquí.';
    return;
  }
  msg.textContent = 'Entrando…';
  const { usuario, error } = await D.entrar(email, pass);
  if (error) { msg.textContent = /not confirmed/i.test(error.message || '') ? D.mensajeCuenta(error) : 'Email o contraseña incorrectos'; return; }
  await empezar(usuario);
}

async function empezar(usuario) {
  E.usuario = usuario;
  E.nombre = usuario.user_metadata?.name || usuario.email.split('@')[0];
  const raiz = document.getElementById('raiz');
  raiz.innerHTML = '<div class="cargando">Cargando tus datos…</div>';
  const datos = await D.cargarTodo(usuario);
  if (!datos) {
    raiz.innerHTML = `<div class="entrar">${marca()}<p class="texto-2">No hemos podido cargar tus datos.</p><button type="button" class="boton" data-accion="reintentar">Reintentar</button></div>`;
    return;
  }
  Object.assign(E, datos, { cargado: true });
  ultimaCarga = Date.now();
  irA();
  clasificarAtajo();
}

// Los pagos del atajo de Apple Pay llegan sin categoría: se clasifican con lo aprendido o las reglas automáticas
async function clasificarAtajo() {
  const cambios = Object.entries(clasificarPagosAtajo(E.txs, E.reglas));
  for (const [categoria, ids] of cambios) {
    if (await D.actualizarMovimientos(ids, { categoria }, 'clasificar los pagos de Apple Pay')) {
      E.txs.forEach(t => { if (ids.includes(t.id)) t.categoria = categoria; });
    }
  }
  if (cambios.length) pintar();
}

// Al volver a la app (por ejemplo, después de pagar con el móvil) se recargan los datos para ver lo nuevo
let ultimaCarga = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !E.cargado || D.enDemo() || E.pantalla === 'anadir' || hojaAbierta()) return;
  if (Date.now() - ultimaCarga < 30000) return;
  ultimaCarga = Date.now();
  const datos = await D.cargarTodo(E.usuario);
  if (!datos || hojaAbierta()) return;
  Object.assign(E, datos);
  pintar();
  clasificarAtajo();
});

function empezarDemo() {
  D.activarDemo();
  empezar({ id: 'demo', email: 'demo', user_metadata: { name: 'Álex' } });
}

// ─── ACCIONES GENERALES ───
const generales = {
  'mes-anterior': () => { if (E.mes > E.meses[0]) { E.mes = sumarMeses(E.mes, -1); pintar(); } },
  'mes-siguiente': () => { if (E.mes < mesActual()) { E.mes = sumarMeses(E.mes, 1); pintar(); } },
  'cerrar-hoja': () => cerrarHoja(),
  'modo-entrar': (ctx, el) => { E.modoEntrar = el.dataset.valor; pintar(); },
  'demo': () => empezarDemo(),
  'reintentar': () => empezar(E.usuario),
  'cuenta': () => abrirHoja(`${cabeceraHoja(esc(E.nombre), D.enDemo() ? 'Modo demo' : esc(E.usuario.email))}
      <a href="../app.html" class="boton suave peq">Abrir la versión anterior de la app</a>
      <button type="button" class="boton peligro peq" data-accion="salir">${ic('salir')}${D.enDemo() ? 'Salir de la demo' : 'Cerrar sesión'}</button>`, 'Tu cuenta'),
  'salir': async () => {
    await D.salir();
    location.href = location.pathname; // vuelve a empezar, sin demo ni datos en memoria
  }
};

const ctx = { E, pintar };
const ACCIONES = { ...generales, ...movimientos.acciones, ...anadir.acciones, ...resumen.acciones, ...planes.acciones, ...dinero.acciones };
const ENTRADAS = { ...movimientos.entradas, ...anadir.entradas, ...planes.entradas };
const CAMBIOS = { ...movimientos.cambios, ...anadir.cambios };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-accion]');
  const f = el && ACCIONES[el.dataset.accion];
  if (f) f(ctx, el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-entrada]');
  const f = el && ENTRADAS[el.dataset.entrada];
  if (f) f(ctx, el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-cambio]');
  const f = el && CAMBIOS[el.dataset.cambio];
  if (f) f(ctx, el, e);
});
document.addEventListener('submit', e => {
  if (e.target.id === 'form-entrar') { e.preventDefault(); enviarEntrar(); }
});
window.addEventListener('hashchange', irA);

// ─── ARRANQUE ───
document.getElementById('sprite').innerHTML = SPRITE;
if (new URLSearchParams(location.search).has('demo')) empezarDemo();
else {
  const sesion = await D.sesionActual();
  if (sesion) empezar(sesion.user); else pintar();
}
