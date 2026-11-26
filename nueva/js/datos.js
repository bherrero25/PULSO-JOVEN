// Acceso a Supabase. La clave es la pública (sb_publishable_…): la seguridad la dan las reglas RLS de cada tabla.
// En modo demo no se guarda nada: las funciones de escritura responden como si hubieran ido bien.

import { mostrarAviso } from './ui.js';
import { claveConcepto, claveMovimiento, cuentaManual } from './logica.js';
export { claveMovimiento };
import { datosDemo } from './demo.js';

export const SUPABASE_URL = 'https://tqjukdleqgbpseaipfel.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_8tXAzCiTvfbcrD3rlj5I-w_zF4gXpcN';
export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let demo = false;
let uid = null;
let idDemo = 1;
export const enDemo = () => demo;
export function activarDemo() { demo = true; }

// Supabase devuelve como máximo 1.000 filas por consulta: se leen por páginas hasta tenerlas todas.
// `consulta` crea la consulta de nuevo en cada página y debe tener un orden estable.
export async function leerTodas(consulta) {
  const PAGINA = 1000, filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await consulta().range(desde, desde + PAGINA - 1);
    if (error) throw error;
    filas.push(...data);
    if (data.length < PAGINA) return filas;
  }
}

// Aviso visible cuando la base de datos no responde o rechaza un cambio. Devuelve true si hubo error.
export function avisarError(error, que) {
  if (!error) return false;
  console.error(`Error al ${que}`, error);
  const caducada = error.code === 'PGRST301' || /jwt/i.test(error.message || '');
  mostrarAviso(caducada
    ? `No se ha podido ${que}: tu sesión ha caducado. Sal y vuelve a entrar.`
    : `No se ha podido ${que}. Comprueba la conexión e inténtalo de nuevo.`);
  return true;
}

// ─── SESIÓN ───
export async function sesionActual() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
export async function entrar(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { usuario: data?.user, error };
}
// Si Supabase no pide confirmar el correo, devuelve ya la sesión y se puede entrar directamente.
// El enlace del correo de confirmación vuelve a esta misma página (debe estar en Redirect URLs de Supabase).
export async function registrarse(nombre, email, password) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name: nombre }, emailRedirectTo: location.origin + location.pathname } });
  return { error, sesion: data?.session, usuario: data?.user };
}

// Mensajes de Supabase (en inglés) traducidos para la pantalla de entrar
export function mensajeCuenta(error) {
  const m = String(error?.message || '');
  if (/already registered|already exists/i.test(m)) return 'Ya hay una cuenta con ese email. Entra con tu contraseña.';
  if (/at least 6|password should/i.test(m)) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (/invalid.*email|email.*invalid|unable to validate email/i.test(m)) return 'Ese email no parece válido.';
  if (/not authorized/i.test(m)) return 'Ahora mismo no podemos enviar el correo de confirmación a ese email. Inténtalo más tarde.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.';
  if (/not confirmed/i.test(m)) return 'Falta confirmar tu email: abre el correo que te enviamos (mira también en spam).';
  return 'No se ha podido completar. Inténtalo de nuevo.';
}
export async function salir() { if (!demo) await sb.auth.signOut(); }

// ─── LECTURA ───
// Devuelve todo lo de la persona, o null si falló (el aviso ya se ha mostrado)
export async function cargarTodo(usuario) {
  if (demo) return { ...datosDemo(), formatos: {} };
  uid = usuario.id;
  try {
    const [txs, presupuestos, metas, filasReglas] = await Promise.all([
      leerTodas(() => sb.from('pj_transacciones').select('*').eq('user_id', uid).order('fecha', { ascending: false }).order('id', { ascending: false })),
      leerTodas(() => sb.from('pj_presupuestos').select('*').eq('user_id', uid).order('mes').order('id')),
      leerTodas(() => sb.from('pj_metas').select('*').eq('user_id', uid).order('created_at').order('id')),
      leerTodas(() => sb.from('pj_reglas_categoria').select('concepto, categoria').eq('user_id', uid).order('concepto'))
    ]);
    const reglas = {};
    filasReglas.forEach(r => { reglas[claveConcepto(r.concepto)] = r.categoria; });
    // Los retenidos necesitan la columna «pendiente» (sql/2026-11-retenidos.sql)
    const conRetenidos = txs.length ? 'pendiente' in txs[0] : !(await sb.from('pj_transacciones').select('pendiente').limit(1)).error;
    // Para qué es cada dinero de paso necesita la columna «paso» (sql/2026-11-paso.sql)
    const conPaso = txs.length ? 'paso' in txs[0] : !(await sb.from('pj_transacciones').select('paso').limit(1)).error;
    const [cuentas, fijos, formatos] = await Promise.all([cargarCuentas(), cargarFijos(), cargarFormatos()]);
    return { txs, presupuestos, metas, reglas, cuentas, fijos, formatos, conRetenidos, conPaso };
  } catch (error) {
    avisarError(error, 'cargar tus datos');
    return null;
  }
}

// null si aún no existe la tabla (sql/2026-11-cuentas.sql sin ejecutar): la app sigue funcionando sin «Tu dinero»
async function cargarCuentas() {
  try {
    return await leerTodas(() => sb.from('pj_cuentas').select('*').eq('user_id', uid).order('creada').order('id'));
  } catch (error) {
    if (!faltaTabla(error)) avisarError(error, 'cargar tus cuentas');
    return null;
  }
}

// null si aún no existe la tabla (sql/2026-11-fijos.sql sin ejecutar): la app sigue funcionando sin movimientos fijos
async function cargarFijos() {
  try {
    return await leerTodas(() => sb.from('pj_fijos').select('*').eq('user_id', uid).order('creado').order('id'));
  } catch (error) {
    if (!faltaTabla(error)) avisarError(error, 'cargar tus movimientos fijos');
    return null;
  }
}

// Formatos de extracto recordados ({ firma: formato }), o null si aún no existe la tabla
// (sql/2026-11-formatos-extracto.sql sin ejecutar): entonces se recuerdan solo en el dispositivo
async function cargarFormatos() {
  try {
    const filas = await leerTodas(() => sb.from('pj_formatos_extracto').select('id, firma, formato').eq('user_id', uid).order('firma').order('id'));
    return Object.fromEntries(filas.map(f => [f.firma, f.formato]));
  } catch (error) {
    if (!faltaTabla(error)) avisarError(error, 'cargar los formatos de tus extractos');
    return null;
  }
}
export async function guardarFormatoExtracto(firma, formato) {
  if (demo) return true;
  const { error } = await sb.from('pj_formatos_extracto')
    .upsert({ user_id: uid, firma, formato, actualizado: new Date().toISOString() }, { onConflict: 'user_id,firma' });
  return !avisarError(error, 'recordar las columnas del extracto');
}

// Claves de todos los movimientos guardados, recién leídas, para no duplicar al importar
export async function clavesGuardadas(txsEnPantalla) {
  if (demo) return new Set(txsEnPantalla.map(claveMovimiento));
  const filas = await leerTodas(() => sb.from('pj_transacciones').select('id, fecha, descripcion, importe').eq('user_id', uid).order('id'));
  return new Set(filas.map(claveMovimiento));
}

// ─── ESCRITURA ───
// Todas devuelven la fila guardada (o true) si fue bien, y null si falló (con el aviso ya mostrado)
export async function insertarMovimiento(tx) {
  if (demo) return { ...tx, id: 'd' + idDemo++ };
  const { data, error } = await sb.from('pj_transacciones').insert({ user_id: uid, ...tx }).select().single();
  return avisarError(error, 'guardar el movimiento') ? null : data;
}

// Guarda por lotes de 100. Devuelve las filas guardadas, aunque se corte a medias.
export async function insertarMovimientos(lista) {
  if (demo) return { guardadas: lista.map(t => ({ ...t, id: 'd' + idDemo++ })), error: null };
  const guardadas = [];
  for (let i = 0; i < lista.length; i += 100) {
    const { data, error } = await sb.from('pj_transacciones').insert(lista.slice(i, i + 100).map(t => ({ user_id: uid, ...t }))).select();
    if (error) { avisarError(error, 'guardar todos los movimientos'); return { guardadas, error }; }
    guardadas.push(...data);
  }
  return { guardadas, error: null };
}

export async function actualizarMovimientos(ids, cambios, que) {
  if (demo) return true;
  const { error } = await sb.from('pj_transacciones').update(cambios).in('id', ids);
  return !avisarError(error, que);
}

export async function borrarMovimiento(id) {
  if (demo) return true;
  const { error } = await sb.from('pj_transacciones').delete().eq('id', id);
  return !avisarError(error, 'borrar el movimiento');
}

export async function borrarMovimientos(ids, que) {
  if (demo || !ids.length) return true;
  const { error } = await sb.from('pj_transacciones').delete().in('id', ids);
  return !avisarError(error, que);
}

export async function guardarRegla(concepto, categoria) {
  if (demo) return true;
  const { error } = await sb.from('pj_reglas_categoria').upsert(
    { user_id: uid, concepto: claveConcepto(concepto), categoria },
    { onConflict: 'user_id,concepto' }
  );
  return !avisarError(error, 'recordar esta categoría para la próxima vez');
}

// El límite se guarda para el mes indicado; los meses anteriores conservan el suyo
export async function guardarPresupuesto(categoria, limite, mes) {
  if (demo) return { id: 'd' + idDemo++, categoria, limite, mes };
  const existente = await sb.from('pj_presupuestos').select('id').eq('user_id', uid).eq('categoria', categoria).eq('mes', mes).limit(1);
  if (avisarError(existente.error, 'guardar el límite')) return null;
  const { data, error } = existente.data.length
    ? await sb.from('pj_presupuestos').update({ limite }).eq('id', existente.data[0].id).select().single()
    : await sb.from('pj_presupuestos').insert({ user_id: uid, categoria, limite, mes }).select().single();
  return avisarError(error, 'guardar el límite') ? null : data;
}

export async function borrarPresupuesto(categoria) {
  if (demo) return true;
  const { error } = await sb.from('pj_presupuestos').delete().eq('user_id', uid).eq('categoria', categoria);
  return !avisarError(error, 'quitar el presupuesto');
}

export async function crearMeta(meta) {
  if (demo) return { ...meta, id: 'd' + idDemo++ };
  const { data, error } = await sb.from('pj_metas').insert({ user_id: uid, ...meta }).select().single();
  return avisarError(error, 'crear la meta') ? null : data;
}

export async function actualizarMeta(id, cambios) {
  if (demo) return true;
  const { error } = await sb.from('pj_metas').update(cambios).eq('id', id);
  return !avisarError(error, 'guardar la meta');
}

// ─── ATAJO DE APPLE PAY ───
// Código personal con el que el atajo del iPhone apunta pagos (ver sql/2026-11-atajo-apple-pay.sql).
// Devuelve { codigo }, { falta: true } si aún no se ha preparado la base de datos, o null si falló.
const faltaTabla = error => error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find/i.test(error.message || ''));
export async function codigoAtajo() {
  if (demo) return { codigo: 'disponible-al-entrar-con-tu-cuenta' };
  const { data, error } = await sb.from('pj_codigos_atajo').select('codigo').eq('user_id', uid).limit(1);
  if (faltaTabla(error)) return { falta: true };
  if (avisarError(error, 'obtener tu código')) return null;
  if (data.length) return { codigo: data[0].codigo };
  const nuevo = await sb.from('pj_codigos_atajo').insert({ user_id: uid }).select('codigo').single();
  return avisarError(nuevo.error, 'crear tu código') ? null : { codigo: nuevo.data.codigo };
}
export async function cambiarCodigoAtajo() {
  if (demo) return null;
  const { data, error } = await sb.from('pj_codigos_atajo').update({ codigo: crypto.randomUUID() }).eq('user_id', uid).select('codigo').single();
  return avisarError(error, 'cambiar tu código') ? null : data.codigo;
}

// ─── TU DINERO ───
// Cuentas a mano (efectivo, ahorro…): se crean o cambian con el saldo de hoy. Una de banco añadida a mano lleva su clave
// (banco·4 últimas cifras), para que su extracto la reconozca; la clave no se cambia después.
export async function guardarCuenta({ id, nombre, tipo, saldo, fecha_saldo, clave }) {
  const fila = { nombre, tipo, saldo, fecha_saldo };
  if (demo) return { ...fila, id: id || 'd' + idDemo++, ...(id ? {} : { clave: clave || null, principal: false }) };
  const { data, error } = id
    ? await sb.from('pj_cuentas').update(fila).eq('id', id).select().single()
    : await sb.from('pj_cuentas').insert({ user_id: uid, ...fila, ...(clave ? { clave } : {}) }).select().single();
  return avisarError(error, 'guardar la cuenta') ? null : data;
}

// Cuenta principal: como mucho una por persona, así que primero se quita a las demás
export async function marcarPrincipal(id) {
  if (demo) return true;
  let { error } = await sb.from('pj_cuentas').update({ principal: false }).eq('user_id', uid).neq('id', id);
  if (avisarError(error, 'cambiar la cuenta principal')) return false;
  ({ error } = await sb.from('pj_cuentas').update({ principal: true }).eq('id', id));
  return !avisarError(error, 'cambiar la cuenta principal');
}

// Saldo del banco leído del extracto: una cuenta por banco (clave = 'bankinter', 'bbva'…)
export async function guardarSaldoBanco(clave, nombre, saldo, fecha_saldo) {
  if (demo) return { id: 'd' + idDemo++, clave, nombre, tipo: 'banco', saldo, fecha_saldo };
  const { data, error } = await sb.from('pj_cuentas')
    .upsert({ user_id: uid, clave, nombre, tipo: 'banco', saldo, fecha_saldo }, { onConflict: 'user_id,clave' }).select().single();
  return avisarError(error, 'guardar el saldo del banco') ? null : data;
}

// ─── MOVIMIENTOS FIJOS ───
export async function guardarFijo({ id, nombre, tipo, categoria, importe, dia, medio, ultimo }) {
  const fila = { nombre, tipo, categoria, importe, dia, medio, ultimo };
  if (demo) return { ...fila, id: id || 'd' + idDemo++, activo: true };
  const { data, error } = id
    ? await sb.from('pj_fijos').update(fila).eq('id', id).select().single()
    : await sb.from('pj_fijos').insert({ user_id: uid, ...fila }).select().single();
  return avisarError(error, 'guardar el movimiento fijo') ? null : data;
}

// Apunta hasta qué fecha se han creado ya sus previstos
export async function marcarFijo(id, ultimo) {
  if (demo) return true;
  const { error } = await sb.from('pj_fijos').update({ ultimo }).eq('id', id);
  return !avisarError(error, 'actualizar el movimiento fijo');
}

export async function borrarFijo(id) {
  if (demo) return true;
  const { error } = await sb.from('pj_fijos').delete().eq('id', id);
  return !avisarError(error, 'quitar el movimiento fijo');
}

// Una cuenta antigua (clave 'bankinter') adopta su número ('bankinter·1234'): en sus movimientos, en lo apuntado a mano
// para ella y en la propia cuenta. Primero los movimientos: si algo falla, la cuenta sigue como estaba.
export async function renombrarCuenta(viejo, nuevo) {
  if (demo) return true;
  for (const [de, a] of [[viejo, nuevo], [cuentaManual(viejo), cuentaManual(nuevo)]]) {
    const { error } = await sb.from('pj_transacciones').update({ cuenta: a }).eq('user_id', uid).eq('cuenta', de);
    if (avisarError(error, 'actualizar la cuenta de tus movimientos')) return false;
  }
  const { error } = await sb.from('pj_cuentas').update({ clave: nuevo }).eq('user_id', uid).eq('clave', viejo);
  return !avisarError(error, 'actualizar la cuenta');
}

export async function borrarCuenta(id) {
  if (demo) return true;
  const { error } = await sb.from('pj_cuentas').delete().eq('id', id);
  return !avisarError(error, 'quitar la cuenta');
}

export async function borrarMeta(id) {
  if (demo) return true;
  const { error } = await sb.from('pj_metas').delete().eq('id', id);
  return !avisarError(error, 'eliminar la meta');
}
