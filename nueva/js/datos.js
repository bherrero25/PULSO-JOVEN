// Acceso a Supabase. La clave es la pública (sb_publishable_…): la seguridad la dan las reglas RLS de cada tabla.
// En modo demo no se guarda nada: las funciones de escritura responden como si hubieran ido bien.

import { mostrarAviso } from './ui.js';
import { claveConcepto } from './logica.js';
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
export async function registrarse(nombre, email, password) {
  const { error } = await sb.auth.signUp({ email, password, options: { data: { name: nombre } } });
  return { error };
}
export async function salir() { if (!demo) await sb.auth.signOut(); }

// ─── LECTURA ───
// Devuelve todo lo de la persona, o null si falló (el aviso ya se ha mostrado)
export async function cargarTodo(usuario) {
  if (demo) return datosDemo();
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
    return { txs, presupuestos, metas, reglas };
  } catch (error) {
    avisarError(error, 'cargar tus datos');
    return null;
  }
}

// Claves de todos los movimientos guardados, recién leídas, para no duplicar al importar
export async function clavesGuardadas(txsEnPantalla) {
  if (demo) return new Set(txsEnPantalla.map(claveMovimiento));
  const filas = await leerTodas(() => sb.from('pj_transacciones').select('id, fecha, descripcion, importe').eq('user_id', uid).order('id'));
  return new Set(filas.map(claveMovimiento));
}
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const claveMovimiento = t => `${t.fecha}|${norm(t.descripcion)}|${parseFloat(t.importe)}`;

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

export async function borrarMeta(id) {
  if (demo) return true;
  const { error } = await sb.from('pj_metas').delete().eq('id', id);
  return !avisarError(error, 'eliminar la meta');
}
