// Cálculos de Pulso Joven. No toca la base de datos ni la pantalla: recibe datos y devuelve datos.

// ─── FECHAS ───
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);

// Fecha local (no UTC): a las 00:30 de un día 1 sigue siendo ese día
export function hoyISO(desplazamiento = 0) {
  const d = new Date();
  d.setDate(d.getDate() + desplazamiento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const mesActual = () => hoyISO().slice(0, 7);
export const diasDelMes = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export function sumarMeses(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function nombreMes(ym, { corto = false, año = true } = {}) {
  const [y, m] = ym.split('-').map(Number);
  if (corto) return MESES_CORTOS[m - 1];
  return mayus(MESES[m - 1]) + (año ? ' ' + y : '');
}
export const fechaCorta = f => { const [, m, d] = f.split('-').map(Number); return `${d} ${MESES_CORTOS[m - 1]}`; };
export function etiquetaDia(f, mesLista) {
  const d = new Date(f + 'T12:00:00');
  const base = `${DIAS[d.getDay()]} ${d.getDate()}` + (f.slice(0, 7) !== mesLista ? ` de ${MESES[d.getMonth()]}` : '');
  if (f === hoyISO()) return 'Hoy · ' + base;
  if (f === hoyISO(-1)) return 'Ayer · ' + base;
  return mayus(base);
}
// Día de hoy dentro del mes (o el último día, si el mes ya ha terminado)
export function ritmoDelMes(ym) {
  const dias = diasDelMes(ym);
  if (ym === mesActual()) { const dia = Number(hoyISO().slice(8)); return { abierto: true, dia, dias, quedan: dias - dia + 1 }; }
  return { abierto: false, dia: dias, dias, quedan: 0 };
}

// ─── FORMATO ───
export function fmt(n, signo = false) {
  const s = Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
  return signo ? (n < 0 ? '−' : '+') + s : s;
}
export const fmt0 = n => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' }) + ' €';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sumar = lista => lista.reduce((s, t) => s + parseFloat(t.importe), 0);

// ─── CATEGORÍAS ───
// `bd` es el texto que se guarda en la base de datos (el mismo que usa la app anterior).
// Solo las 7 categorías más habituales tienen color propio en los gráficos; el resto va en gris.
export const GRIS = '#9b9a94';
export const CATEGORIAS = [
  { id: 'comida', nombre: 'Comida', bd: '🍔 Comida', icono: 'comida', color: '#2a78d6', tipo: 'gasto' },
  { id: 'ocio', nombre: 'Ocio', bd: '🎉 Ocio', icono: 'ocio', color: '#eb6834', tipo: 'gasto' },
  { id: 'gasolina', nombre: 'Gasolina', bd: '⛽ Gasolina', icono: 'gasolina', color: '#1baf7a', tipo: 'gasto' },
  { id: 'ropa', nombre: 'Ropa', bd: '👕 Ropa', icono: 'ropa', color: '#eda100', tipo: 'gasto' },
  { id: 'deporte', nombre: 'Deporte', bd: '🏋️ Deporte', icono: 'deporte', color: '#e87ba4', tipo: 'gasto' },
  { id: 'transporte', nombre: 'Transporte', bd: '🚇 Transporte', icono: 'transporte', color: '#008300', tipo: 'gasto' },
  { id: 'suscripciones', nombre: 'Suscripciones', bd: '📦 Suscripciones', icono: 'suscripciones', color: '#6250d6', tipo: 'gasto' },
  { id: 'alquiler', nombre: 'Alquiler', bd: '🏠 Alquiler', icono: 'casa', tipo: 'gasto' },
  { id: 'coche', nombre: 'Coche', bd: '🚗 Coche', icono: 'coche', tipo: 'gasto' },
  { id: 'salud', nombre: 'Salud', bd: '💊 Salud', icono: 'salud', tipo: 'gasto' },
  { id: 'estudios', nombre: 'Estudios', bd: '📚 Estudios', icono: 'estudios', tipo: 'gasto' },
  { id: 'viaje', nombre: 'Viajes', bd: '✈️ Viaje', icono: 'viaje', tipo: 'gasto' },
  { id: 'tecnologia', nombre: 'Tecnología', bd: '📱 Tecnología', icono: 'portatil', tipo: 'gasto' },
  { id: 'regalo', nombre: 'Regalos', bd: '🎁 Regalo', icono: 'regalo', tipo: 'gasto' },
  { id: 'apuestas', nombre: 'Apuestas', bd: '🎲 Apuestas', icono: 'dado', tipo: 'gasto' },
  { id: 'bizum_enviado', nombre: 'Bizum enviado', bd: '📱 Bizum enviado', icono: 'movil', tipo: 'gasto' },
  { id: 'cargo_tarjeta', nombre: 'Cargo de tarjeta', bd: '💳 Cargo tarjeta', icono: 'tarjeta', tipo: 'gasto' },
  { id: 'otros', nombre: 'Otros', bd: '🔧 Otros', icono: 'otros', tipo: 'gasto' },
  { id: 'mensualidad', nombre: 'Mensualidad', bd: '💰 Mensualidad', icono: 'familia', tipo: 'ingreso' },
  { id: 'nomina', nombre: 'Trabajo', bd: '💰 Nómina', icono: 'trabajo', tipo: 'ingreso' },
  { id: 'bizum_recibido', nombre: 'Bizum recibido', bd: '📱 Bizum recibido', icono: 'movil', tipo: 'ingreso' },
  { id: 'ingresos', nombre: 'Otros ingresos', bd: '💰 Ingresos', icono: 'ingreso', tipo: 'ingreso' },
  { id: 'reenviado', nombre: 'Dinero de paso', bd: '↩️ Reenviado', icono: 'paso', tipo: 'gasto' },
  { id: 'liquidacion', nombre: 'Liquidación de tarjeta', bd: '💳 Liquidación tarjeta', icono: 'tarjeta', tipo: 'liquidacion_tarjeta' }
];
export const BD = { OTROS: '🔧 Otros', MENSUALIDAD: '💰 Mensualidad', REENVIO: '↩️ Reenviado' };
// Las que salen primero al apuntar a mano
export const RAPIDAS_GASTO = ['comida', 'ocio', 'transporte', 'gasolina', 'ropa', 'deporte', 'suscripciones', 'alquiler', 'salud', 'estudios', 'regalo', 'otros'];
export const RAPIDAS_INGRESO = ['mensualidad', 'nomina', 'bizum_recibido', 'ingresos'];
export const SERIES_GRAFICO = CATEGORIAS.filter(c => c.color);

const PORBD = new Map(CATEGORIAS.map(c => [c.bd, c]));
const PORID = new Map(CATEGORIAS.map(c => [c.id, c]));
const sinEmoji = s => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();

export const categoriaPorId = id => PORID.get(id);
// Información de una categoría a partir del texto guardado (incluidas las que la persona escribió a mano)
export function infoCategoria(valor) {
  if (!valor) return PORID.get('otros');
  const exacta = PORBD.get(valor);
  if (exacta) return exacta;
  const limpio = sinEmoji(valor).toLowerCase();
  return CATEGORIAS.find(c => sinEmoji(c.bd).toLowerCase() === limpio || c.nombre.toLowerCase() === limpio)
    || { id: 'p:' + valor, nombre: sinEmoji(valor) || valor, bd: valor, icono: 'otros', tipo: 'gasto', personalizada: true };
}
export const colorCategoria = c => c.color || GRIS;
export function tinteCategoria(c) {
  if (c.tipo === 'ingreso') return 'rgba(0,99,0,0.10)';
  if (!c.color) return 'rgba(17,20,24,0.07)';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.color.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},0.15)`;
}

// ─── DINERO DEL MES ───
// «Dinero de paso» (↩️ Reenviado): llega y se reenvía a otra persona. No es gasto y se descuenta de lo ingresado.
export const esPaso = t => t.tipo === 'gasto' && t.categoria === BD.REENVIO;
export const esGasto = t => t.tipo === 'gasto' && t.categoria !== BD.REENVIO;
export const esIngreso = t => t.tipo === 'ingreso';
const esMensualidad = t => t.tipo === 'ingreso' && t.categoria === BD.MENSUALIDAD;

// La mensualidad y el dinero de paso de los 3 últimos días del mes cuentan para el mes siguiente
// (la transferencia del 30 de octubre es la de noviembre)
export function mesEfectivo(t) {
  const mes = t.fecha.slice(0, 7);
  if (!esMensualidad(t) && !esPaso(t)) return mes;
  const dia = Number(t.fecha.slice(8));
  return dia <= diasDelMes(mes) - 3 ? mes : sumarMeses(mes, 1);
}

export function resumenMes(txs, ym) {
  const movs = txs.filter(t => mesEfectivo(t) === ym);
  const gastos = movs.filter(esGasto), ingresos = movs.filter(esIngreso), paso = movs.filter(esPaso);
  const totalGastos = sumar(gastos), ingresosBrutos = sumar(ingresos), totalPaso = sumar(paso);
  const ingresado = ingresosBrutos - totalPaso;
  return { ym, movs, gastos, ingresos, paso, totalGastos, ingresosBrutos, totalPaso, ingresado, queda: ingresado - totalGastos };
}

// Agrupa movimientos por categoría, de mayor a menor importe
export function porCategoria(lista) {
  const grupos = new Map();
  lista.forEach(t => {
    const c = infoCategoria(t.categoria);
    const g = grupos.get(c.bd) || { cat: c, total: 0, txs: [] };
    g.total += parseFloat(t.importe); g.txs.push(t);
    grupos.set(c.bd, g);
  });
  return [...grupos.values()].sort((a, b) => b.total - a.total);
}

export function gastoHastaDia(txs, ym, dia) {
  return sumar(txs.filter(t => esGasto(t) && t.fecha.slice(0, 7) === ym && Number(t.fecha.slice(8)) <= dia));
}

// Meses que se pueden consultar: desde el primero con datos hasta el actual
export function mesesDisponibles(txs) {
  const actual = mesActual();
  let primero = actual;
  txs.forEach(t => { const m = mesEfectivo(t); if (m < primero) primero = m; });
  const meses = [];
  for (let m = primero; m <= actual; m = sumarMeses(m, 1)) meses.push(m);
  return meses;
}

// ─── PRESUPUESTOS ───
// Cada límite vale desde el mes en que se guardó hasta que se cambie: de cada categoría, el más reciente hasta ese mes
export function presupuestosVigentes(todos, ym) {
  const porCat = new Map();
  todos.filter(p => p.mes <= ym).sort((a, b) => b.mes.localeCompare(a.mes))
    .forEach(p => { if (!porCat.has(p.categoria)) porCat.set(p.categoria, p); });
  return [...porCat.values()].filter(p => parseFloat(p.limite) > 0);
}
export function estadoPresupuestos(todos, txs, ym) {
  const gastos = resumenMes(txs, ym).gastos;
  return presupuestosVigentes(todos, ym).map(p => {
    const gastado = sumar(gastos.filter(t => t.categoria === p.categoria));
    const limite = parseFloat(p.limite);
    const pct = Math.round(gastado / limite * 100);
    const estado = pct >= 100 ? 'superado' : pct >= 85 ? 'cuidado' : 'bien';
    return { ...p, cat: infoCategoria(p.categoria), gastado, limite, pct, estado };
  }).sort((a, b) => b.pct - a.pct);
}

// ─── CATEGORÍAS AUTOMÁTICAS Y APRENDIDAS ───
// Concepto sin tildes, espacios repetidos, símbolos de relleno (#, $) ni la fecha que Bankinter añade al final
export function claveConcepto(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/, '').replace(/[#$*]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function categoriaAutomatica(descripcion, tipo) {
  const d = (descripcion || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/bizum/.test(d)) return tipo === 'ingreso' ? '📱 Bizum recibido' : '📱 Bizum enviado';
  if (/recobro|recibo visa|visa clasica|liquidacion tarjeta/.test(d)) return '💳 Cargo tarjeta';
  // "E S ..." = estación de servicio (p. ej. "E S ALCAMPO"): va antes que el súper del mismo nombre
  if (/^e ?s |^e\.s\. |estacion(es)? de servicio/.test(d)) return '⛽ Gasolina';
  if (/mercadona|carrefour|lidl|aldi|supermercado|simply|market|fruteria|panaderia|alcampo|(^|\s)dia(\s|$)|eroski|consum|hipercor/.test(d)) return '🍔 Comida';
  if (/netflix|spotify|amazon prime|disney|hbo|apple\.com|google play|playstation|steam/.test(d)) return '📦 Suscripciones';
  if (/renfe|iryo|ouigo|alsa|autobus|nextbike|metro|bus |uber|cabify|blablacar|taxi|parking/.test(d)) return '🚇 Transporte';
  if (/taller|norauto|midas|feu vert|neumatic|itv |recambios|lavadero/.test(d)) return '🚗 Coche';
  if (/gasolinera|estacion(es)? de servicio|petroprix|plenergy|repsol|bp |cepsa|galp|shell|ballenoil|plenoil/.test(d)) return '⛽ Gasolina';
  if (/winamax|bet365|codere|sportium|pokerstars|loteria|apuesta/.test(d)) return '🎲 Apuestas';
  if (/alquiler|arrendamiento|comunidad|hipoteca/.test(d)) return '🏠 Alquiler';
  if (/zara|mango|h&m|primark|stradivarius|pull|bershka|nike|adidas/.test(d)) return '👕 Ropa';
  if (/farmacia|medico|clinica|hospital|dentista|salud/.test(d)) return '💊 Salud';
  if (/universidad|academia|libro|formacion|udemy/.test(d)) return '📚 Estudios';
  if (/boulder|escalada|rocodromo|gym|gimnasio|(?<!tran)sport|decathlon|fitness/.test(d)) return '🏋️ Deporte';
  if (/sala suite|discoteca|pub |cines?|teatro|concierto|entradas|fourvenues|ticketmaster|savage garden/.test(d)) return '🎉 Ocio';
  if (/nomina|salario|sueldo|haberes/.test(d)) return '💰 Nómina';
  if (/transferencia|trans inm|transf|trans \/|paypal|recibido/.test(d) && tipo === 'ingreso') return '💰 Ingresos';
  if (/restaurante|bar |cafeteria|mc ?donald|cafe |burger|pizz|kebab|sushi|montaditos|to go|telepizza|foster|goiko|kfc/.test(d)) return '🍔 Comida';
  return BD.OTROS;
}

// Primero lo que la persona ha enseñado a la app; si no hay nada, las reglas automáticas
export function categoriaConAprendizaje(descripcion, tipo, reglas) {
  const clave = claveConcepto(descripcion);
  if (reglas[clave]) return reglas[clave];
  for (const [k, v] of Object.entries(reglas)) {
    if (k.length >= 4 && (clave.includes(k) || (clave.length >= 4 && k.includes(clave)))) return v;
  }
  return categoriaAutomatica(descripcion, tipo);
}

// Un movimiento está «por revisar» si cayó en Otros y nadie le ha dado aún categoría a ese concepto
export const porRevisar = (t, reglas) => t.tipo === 'gasto' && t.categoria === BD.OTROS && !(claveConcepto(t.descripcion) in reglas);

export function medioAutomatico(descripcion) {
  const d = (descripcion || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/bizum/.test(d)) return 'bizum';
  if (/recibo visa|visa clasica|tarjeta|liquidacion tarjeta/.test(d)) return 'tarjeta';
  if (/efectivo|cajero/.test(d)) return 'efectivo';
  return 'transferencia';
}

export const MEDIOS = { tarjeta: 'Tarjeta', transferencia: 'Transferencia', bizum: 'Bizum', efectivo: 'Efectivo' };
const NOMBRES_CUENTA = { bankinter: 'Bankinter', bbva: 'BBVA', santander: 'Santander', caixabank: 'CaixaBank', ing: 'ING', revolut: 'Revolut', n26: 'N26', efectivo: 'Efectivo', generico: 'Otro banco', apple_pay: 'Apple Pay' };
export const formaDePago = t => t.cuenta === 'apple_pay' ? 'Apple Pay' : MEDIOS[t.medio] || 'Transferencia';

// Pagos que llegan del atajo de Apple Pay sin clasificar: se les pone la categoría aprendida o la automática.
// Devuelve { categoría: [ids] } con los que hay que cambiar.
export function clasificarPagosAtajo(txs, reglas) {
  const cambios = {};
  txs.filter(t => t.cuenta === 'apple_pay' && t.categoria === BD.OTROS).forEach(t => {
    const cat = categoriaConAprendizaje(t.descripcion, 'gasto', reglas);
    if (cat !== BD.OTROS) (cambios[cat] ||= []).push(t.id);
  });
  return cambios;
}

// Movimientos de un extracto que ya entraron por Apple Pay: mismo importe y fecha del banco entre 0 y 4 días después.
// Cada pago de Apple Pay se empareja como mucho con un movimiento del extracto.
export function separarYaApuntados(nuevos, txs) {
  const libres = txs.filter(t => t.cuenta === 'apple_pay');
  const dias = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000);
  const quedan = [], repetidos = [];
  nuevos.forEach(n => {
    const i = n.tipo === 'gasto' ? libres.findIndex(a => Math.abs(+a.importe - +n.importe) < 0.005 && dias(n.fecha, a.fecha) >= 0 && dias(n.fecha, a.fecha) <= 4) : -1;
    if (i >= 0) { repetidos.push(n); libres.splice(i, 1); } else quedan.push(n);
  });
  return { quedan, repetidos };
}
export function nombreCuenta(c) {
  if (!c || c === 'principal') return 'Cuenta';
  if (c.endsWith('_tarjeta')) return (NOMBRES_CUENTA[c.slice(0, -8)] || c.slice(0, -8)) + ' · tarjeta';
  return NOMBRES_CUENTA[c] || c;
}
