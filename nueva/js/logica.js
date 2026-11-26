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
  { id: 'bizum_enviado', nombre: 'Bizum enviado', bd: '📱 Bizum enviado', icono: 'movil', tipo: 'gasto', generica: true },
  { id: 'cargo_tarjeta', nombre: 'Cargo de tarjeta', bd: '💳 Cargo tarjeta', icono: 'tarjeta', tipo: 'gasto' },
  { id: 'otros', nombre: 'Otros', bd: '🔧 Otros', icono: 'otros', tipo: 'gasto' },
  { id: 'mensualidad', nombre: 'Mensualidad', bd: '💰 Mensualidad', icono: 'familia', tipo: 'ingreso' },
  { id: 'nomina', nombre: 'Trabajo', bd: '💰 Nómina', icono: 'trabajo', tipo: 'ingreso' },
  { id: 'devolucion', nombre: 'Devoluciones', bd: '🤝 Devolución', icono: 'devolver', tipo: 'ingreso' },
  { id: 'regalo_recibido', nombre: 'Regalos', bd: '🎁 Regalo recibido', icono: 'regalo', tipo: 'ingreso' },
  { id: 'ventas', nombre: 'Ventas', bd: '🏷️ Ventas', icono: 'etiqueta', tipo: 'ingreso' },
  // Lo que pagan quienes comparten el coche (BlaBlaCar…): es ingreso, y en el Resumen se descuenta de la gasolina para ver lo que de verdad ha costado
  { id: 'coche_compartido', nombre: 'Coche compartido', bd: '🚗 Coche compartido', icono: 'coche', tipo: 'ingreso', compensa: 'gasolina' },
  { id: 'bizum_recibido', nombre: 'Bizum recibido', bd: '📱 Bizum recibido', icono: 'movil', tipo: 'ingreso', generica: true },
  { id: 'ingresos', nombre: 'Otros ingresos', bd: '💰 Ingresos', icono: 'ingreso', tipo: 'ingreso' },
  { id: 'reenviado', nombre: 'Dinero de paso', bd: '↩️ Reenviado', icono: 'paso', tipo: 'ambos' },
  { id: 'traspaso', nombre: 'Traspaso entre tus cuentas', bd: '🔄 Traspaso', icono: 'devolver', tipo: 'ambos' },
  { id: 'liquidacion', nombre: 'Liquidación de tarjeta', bd: '💳 Liquidación tarjeta', icono: 'tarjeta', tipo: 'liquidacion_tarjeta' }
];
export const BD = { OTROS: '🔧 Otros', MENSUALIDAD: '💰 Mensualidad', REENVIO: '↩️ Reenviado', TRASPASO: '🔄 Traspaso' };
// Las que salen primero al apuntar a mano
export const RAPIDAS_GASTO = ['comida', 'ocio', 'transporte', 'gasolina', 'ropa', 'deporte', 'suscripciones', 'alquiler', 'salud', 'estudios', 'regalo', 'otros', 'reenviado', 'traspaso'];
export const RAPIDAS_INGRESO = ['mensualidad', 'nomina', 'devolucion', 'regalo_recibido', 'ventas', 'coche_compartido', 'ingresos', 'reenviado', 'traspaso'];
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
  if (c.tipo === 'ambos') return 'rgba(42,120,214,0.12)';
  if (!c.color) return 'rgba(17,20,24,0.07)';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.color.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},0.15)`;
}

// ─── DINERO DEL MES ───
// «Dinero de paso» (↩️ Reenviado): dinero que no es tuyo, te llega para pagar o reenviar algo. Se puede marcar lo que llega,
// lo que sale o las dos cosas. Nada de lo marcado cuenta como ingreso ni como gasto: en cada mes se compensan, y si sale más
// de lo que llegó marcado (p. ej. la parte del alquiler que viene dentro de la mensualidad) la diferencia se resta de lo ingresado.
// «Traspaso entre tus cuentas» (🔄 Traspaso): tu dinero cambia de sitio (efectivo ahorrado al banco, cajero a la hucha…).
// No es ingreso ni gasto: solo mueve saldo entre las cuentas de «Tu dinero».
export const esTraspaso = t => t.categoria === BD.TRASPASO;
export const esPaso = t => (t.tipo === 'gasto' || t.tipo === 'ingreso') && t.categoria === BD.REENVIO;
export const esGasto = t => t.tipo === 'gasto' && t.categoria !== BD.REENVIO && !esTraspaso(t);
export const esIngreso = t => t.tipo === 'ingreso' && t.categoria !== BD.REENVIO && !esTraspaso(t);
const esMensualidad = t => t.tipo === 'ingreso' && t.categoria === BD.MENSUALIDAD;

// La mensualidad y el dinero de paso de los 3 últimos días del mes cuentan para el mes siguiente
// (la transferencia del 30 de octubre es la de noviembre)
export function mesEfectivo(t) {
  if (t._mes) return t._mes; // parte de un movimiento dividido: cuenta en el mes del movimiento
  const mes = t.fecha.slice(0, 7);
  if (!esMensualidad(t) && !esPaso(t)) return mes;
  const dia = Number(t.fecha.slice(8));
  return dia <= diasDelMes(mes) - 3 ? mes : sumarMeses(mes, 1);
}

// ─── DIVIDIR UN MOVIMIENTO ───
// Un movimiento puede repartirse en partes con otra categoría (pj_transacciones.partes: [{ importe, categoria, paso }]),
// como los 300 € del alquiler que vienen dentro de la mensualidad (dinero de paso «Alquiler»). En la base de datos sigue
// siendo uno, como en el banco (así el extracto no lo duplica); para las cuentas se usan sus partes: cada una con su
// categoría y lo que queda con la del movimiento, todas en el mes del movimiento. Las listas enseñan el movimiento entero.
export const partesDe = t => Array.isArray(t.partes) ? t.partes.filter(p => parseFloat(p.importe) > 0) : [];
export function desglosar(lista) {
  if (!lista.some(t => partesDe(t).length)) return lista;
  const out = [];
  for (const t of lista) {
    const partes = partesDe(t);
    if (!partes.length) { out.push(t); continue; }
    const _mes = mesEfectivo(t);
    const resto = Math.round((parseFloat(t.importe) - sumar(partes)) * 100) / 100;
    if (resto > 0.005) out.push({ ...t, importe: resto, partes: null, parteDe: t.id, _mes });
    partes.forEach((p, i) => out.push({ ...t, id: `${t.id}·${i + 1}`, importe: Math.round(parseFloat(p.importe) * 100) / 100, categoria: p.categoria, paso: p.paso || null, partes: null, parteDe: t.id, _mes }));
  }
  return out;
}

// «Me lo quedo»: la parte del dinero de paso en espera que al final es tuya. Es un ingreso normal (con su categoría) que
// sale de lo que estaba en espera; no es de ninguna cuenta, porque ese dinero ya estaba en tu banco.
export const CUENTA_LIBERADO = 'liberado';
export const esLiberado = t => t.cuenta === CUENTA_LIBERADO;

// Para qué es cada dinero de paso (pj_transacciones.paso: «Ordenador», «Dentista y luz»…). Cada propósito es una «bolsa»:
// lo que llega y lo que sale para lo mismo se compensan, y lo que llega y aún no ha salido queda en espera.
// Lo que sale sin decir para qué es de tu dinero (como la parte del alquiler que va dentro de la mensualidad): resta.
// Lo que llega sin decir para qué queda en espera hasta que se diga (o «Me lo quedo»).
export const propositoPaso = t => String(t.paso || '').trim() || null;
const r2 = n => Math.round(n * 100) / 100;

// Bolsas de dinero de paso hasta un mes (incluido), llevando la cuenta de un mes a otro: en cada una, `saldo` = llegado −
// salido − lo que te has quedado. Si es positivo, está en espera; si es negativo, pusiste tu dinero (resta ese mes, y si
// luego llega lo que faltaba, suma ese otro mes). `efecto` es lo que se resta de lo ingresado en ese mes por la bolsa.
export function bolsasPaso(txs, ym) {
  const anterior = sumarMeses(ym, -1), mapa = new Map(), deTuDinero = [];
  for (const t of desglosar(txs)) {
    const liberado = esLiberado(t), paso = esPaso(t);
    if (!liberado && !paso) continue;
    const mes = mesEfectivo(t);
    if (mes > ym) continue;
    const nombre = propositoPaso(t), importe = parseFloat(t.importe);
    if (paso && t.tipo === 'gasto' && !nombre) { if (mes === ym) deTuDinero.push(t); continue; }
    const b = mapa.get(nombre || '') || { nombre, saldo: 0, saldoAntes: 0, llega: 0, sale: 0, liberado: 0, movs: [] };
    const signo = paso && t.tipo === 'ingreso' ? 1 : -1;
    b.saldo += signo * importe;
    if (mes <= anterior) b.saldoAntes += signo * importe;
    else { b.movs.push(t); b[liberado ? 'liberado' : t.tipo === 'ingreso' ? 'llega' : 'sale'] += importe; }
    mapa.set(nombre || '', b);
  }
  const bolsas = [...mapa.values()].map(b => {
    const saldo = r2(b.saldo), tuDinero = r2(Math.max(0, -saldo));
    return { ...b, saldo, enEspera: r2(Math.max(0, saldo)), tuDinero, efecto: r2(tuDinero - Math.max(0, -r2(b.saldoAntes))), llega: r2(b.llega), sale: r2(b.sale), liberado: r2(b.liberado) };
  });
  const salidoTuyo = r2(sumar(deTuDinero));
  return { bolsas, deTuDinero, salidoTuyo, totalPaso: r2(salidoTuyo + bolsas.reduce((s, b) => s + b.efecto, 0)), enEspera: r2(bolsas.reduce((s, b) => s + b.enEspera, 0)) };
}

// Dinero de paso (ver bolsasPaso): no cuenta como ingreso ni como gasto; solo resta lo que sale de tu dinero.
export function resumenMes(txs, ym) {
  const movs = txs.filter(t => mesEfectivo(t) === ym); // tal cual, para las listas
  const partes = desglosar(movs);                       // para las cuentas: los movimientos divididos, en sus partes
  const gastos = partes.filter(esGasto), ingresos = partes.filter(esIngreso), paso = partes.filter(esPaso);
  const pasoLlega = sumar(paso.filter(t => t.tipo === 'ingreso')), pasoSale = sumar(paso.filter(t => t.tipo === 'gasto'));
  // totalPaso > 0: este mes ha salido dinero de paso con tu dinero (se resta de lo ingresado); < 0: te han devuelto lo que pusiste
  const { totalPaso, enEspera } = bolsasPaso(txs, ym), liberado = sumar(partes.filter(esLiberado));
  const totalGastos = sumar(gastos), ingresosBrutos = sumar(ingresos);
  const ingresado = ingresosBrutos - totalPaso;
  return { ym, movs, gastos, ingresos, paso, pasoLlega, pasoSale, totalGastos, ingresosBrutos, totalPaso, enEspera, liberado, ingresado, queda: ingresado - totalGastos };
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
  return sumar(desglosar(txs).filter(t => esGasto(t) && t.fecha.slice(0, 7) === ym && Number(t.fecha.slice(8)) <= dia));
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
  // BlaBlaCar (Comuto SA): si te pagan, es coche compartido; si pagas tú un viaje, es transporte
  if (/blablacar|comuto/.test(d) && tipo === 'ingreso') return '🚗 Coche compartido';
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

// Un movimiento está «por revisar» si no tiene una categoría real (Otros, o Bizum sin más) y nadie se la ha dado aún a ese concepto.
// El Bizum es la forma de pago: su categoría es para qué era (comida, ocio…) o de dónde viene (trabajo, regalo, devolución…).
const SIN_CLASIFICAR = new Set([BD.OTROS, '📱 Bizum enviado', '📱 Bizum recibido']);
export const porRevisar = (t, reglas) => (t.tipo === 'gasto' || t.tipo === 'ingreso') && SIN_CLASIFICAR.has(t.categoria) && !(claveConcepto(t.descripcion) in reglas);
export const esBizum = t => t.medio === 'bizum' || /bizum/i.test(t.descripcion || '');

// Forma de pago a partir del concepto del banco. Lo que no dice nada: un gasto suele ser una compra con tarjeta y un
// ingreso, una transferencia.
export function medioAutomatico(descripcion, tipo) {
  const d = (descripcion || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/bizum/.test(d)) return 'bizum';
  if (/apple ?pay/.test(d)) return 'apple_pay';
  if (/recibo visa|visa clasica|liquidacion tarjeta/.test(d)) return 'tarjeta';
  if (/efectivo|cajero|reintegro/.test(d)) return 'efectivo';
  if (/\b(recibo|adeudo|domiciliaci|cuota)\b/.test(d)) return 'recibo';
  if (/transf|traspaso|nomina|\babono\b|\bsepa\b|\bdevolucion\b/.test(d)) return 'transferencia';
  if (/tarj|\bcompra|\btpv\b|pago (con|en)|contactless|google ?pay|\d{4}[x*]{4,}/.test(d)) return 'tarjeta';
  return tipo === 'ingreso' ? 'transferencia' : tipo === 'gasto' ? 'tarjeta' : 'transferencia';
}

// ─── NOMBRES LIMPIOS ───
// El concepto del banco se guarda tal cual (sirve para no duplicar y para lo aprendido); en pantalla se enseña limpio:
// sin «COMPRA TARJ. 5402XXXX», números de tarjeta, fechas ni referencias, con el nombre de la marca si se reconoce y en
// mayúsculas y minúsculas. Lo escrito a mano, lo previsto y el efectivo se enseñan como se escribieron.
const MARCAS = [
  [/mercadona/, 'Mercadona'], [/carrefour/, 'Carrefour'], [/\blidl\b/, 'Lidl'], [/\baldi\b/, 'Aldi'], [/(^|\s)dia(\s|$)|supermercados dia/, 'Dia'],
  [/eroski/, 'Eroski'], [/alcampo/, 'Alcampo'], [/\bconsum\b/, 'Consum'], [/hipercor/, 'Hipercor'], [/supercor/, 'Supercor'], [/corte ?ingles/, 'El Corte Inglés'],
  [/ahorramas/, 'Ahorramás'], [/bon ?preu/, 'Bonpreu'], [/caprabo/, 'Caprabo'], [/\bcondis\b/, 'Condis'],
  [/prime ?video/, 'Prime Video'], [/amazon prime/, 'Amazon Prime'], [/amazon|amzn/, 'Amazon'], [/netflix/, 'Netflix'], [/spotify/, 'Spotify'], [/disney/, 'Disney+'],
  [/youtube/, 'YouTube'], [/\bhbo\b/, 'HBO Max'], [/apple\.com|itunes|\bapple\b/, 'Apple'], [/google play/, 'Google Play'], [/\bgoogle\b/, 'Google'], [/playstation|\bpsn\b/, 'PlayStation'],
  [/\bsteam/, 'Steam'], [/nintendo/, 'Nintendo'], [/glovo/, 'Glovo'], [/uber ?eats/, 'Uber Eats'], [/\buber\b/, 'Uber'], [/cabify/, 'Cabify'], [/\bbolt\b/, 'Bolt'],
  [/just ?eat/, 'Just Eat'], [/deliveroo/, 'Deliveroo'], [/renfe/, 'Renfe'], [/\biryo\b/, 'Iryo'], [/ouigo/, 'Ouigo'], [/\balsa\b/, 'Alsa'], [/blablacar/, 'BlaBlaCar'],
  [/ryanair/, 'Ryanair'], [/vueling/, 'Vueling'], [/iberia/, 'Iberia'], [/booking/, 'Booking'], [/airbnb/, 'Airbnb'],
  [/repsol/, 'Repsol'], [/cepsa|moeve/, 'Cepsa'], [/(^|\s)bp(\s|$)/, 'BP'], [/\bgalp\b/, 'Galp'], [/\bshell\b/, 'Shell'], [/ballenoil/, 'Ballenoil'], [/plenoil/, 'Plenoil'], [/petroprix/, 'Petroprix'],
  [/\bzara\b/, 'Zara'], [/primark/, 'Primark'], [/\bmango\b/, 'Mango'], [/(^|\s)h ?(&|y) ?m(\s|$)|hm\.com/, 'H&M'], [/pull ?(&|and|y)? ?bear/, 'Pull&Bear'], [/bershka/, 'Bershka'],
  [/stradivarius/, 'Stradivarius'], [/decathlon/, 'Decathlon'], [/shein/, 'Shein'], [/aliexpress/, 'AliExpress'], [/vinted/, 'Vinted'], [/wallapop/, 'Wallapop'],
  [/mc ?donald/, "McDonald's"], [/burger king/, 'Burger King'], [/telepizza/, 'Telepizza'], [/(100|cien) montaditos/, '100 Montaditos'], [/\bkfc\b/, 'KFC'], [/starbucks/, 'Starbucks'],
  [/foster/, "Foster's Hollywood"], [/goiko/, 'Goiko'], [/domino/, "Domino's"], [/media ?markt/, 'MediaMarkt'], [/\bfnac\b/, 'Fnac'], [/\bikea\b/, 'IKEA'], [/leroy ?merlin/, 'Leroy Merlin'],
  [/primor/, 'Primor'], [/druni/, 'Druni'], [/sephora/, 'Sephora'], [/vodafone/, 'Vodafone'], [/movistar|telefonica/, 'Movistar'], [/\borange\b/, 'Orange'], [/\bdigi\b/, 'Digi'],
  [/simyo/, 'Simyo'], [/\blowi\b/, 'Lowi'], [/yoigo/, 'Yoigo'], [/jazztel/, 'Jazztel'], [/pepephone/, 'Pepephone']
];
const MENUDAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'a', 'en', 'al', 'con', 'por']);
// Tildes que los bancos quitan: comercios, nombres y apellidos frecuentes
const TILDES = Object.fromEntries(('cafetería librería panadería frutería carnicería pescadería peluquería papelería pastelería cervecería heladería droguería ferretería lavandería ' +
  'gestoría óptica clínica médico música informática electrónica energía teléfono nómina crédito café jardín estación autoescuela·autoescuela ' +
  'garcía martínez lópez pérez gonzález rodríguez fernández sánchez gómez díaz hernández jiménez álvarez ramírez muñoz martín ' +
  'lucía maría rubén ramón josé ángel andrés adrián sofía raúl iván óscar mónica verónica tomás nicolás jesús inés belén ' +
  'málaga cádiz córdoba león almería jaén cáceres ávila castellón logroño').split(' ').filter(w => !w.includes('·')).map(w => [w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), w]));
const titulo = s => s.toLowerCase().split(/\s+/).filter(Boolean).map((w, i) => {
  if (i && MENUDAS.has(w)) return w;
  if (/\d/.test(w) || (w.length <= 4 && !/[aeiouáéíóú]/.test(w) && /^[a-z]+$/.test(w))) return w.toUpperCase(); // números y siglas
  const p = TILDES[w] || w;
  return p.charAt(0).toUpperCase() + p.slice(1);
}).join(' ');

export function nombreLimpio(t) {
  const original = String(t.descripcion || '').replace(/^\[Efectivo\]\s*/, '').trim();
  if (!original || esManual(t) || t.cuenta === CUENTA_PREVISTO || t.cuenta === 'efectivo' || t.cuenta === CUENTA_LIBERADO) return original;
  let s = ' ' + original + ' ';
  s = s.replace(/\b\d{4,6}[X*·]{4,}\d{0,4}\b|\b[X*]{4,}\d{2,4}\b/gi, ' ')         // número de tarjeta tapado
    .replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b|\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ') // fechas y horas
    .replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i++) {                                                         // lo que no es el nombre, al principio
    const antes = s;
    s = s.replace(/^(compra(s)?(\s+tarj(eta)?\.?)?(\s+(internet|online|en))?|pago movil( en)?|pago(\s+(con|en))?(\s+tarj(eta)?\.?)?|cargo( tarjeta)?|tpv|apple ?pay|google ?pay|contactless|operacion tarjeta|adeudo( de)?|recibo( de)?|domiciliacion|cuota|tarj(eta)?\.?)\b[\s:.\-/*]*/i, '').trim();
    if (s === antes) break;
  }
  let pago = '';
  const proc = s.match(/^(paypal|pp|sumup|sum ?up|i?zettle|sq|square|stripe|sp|tst|myp)\s*[*_]\s*/i);
  if (proc) { if (/^p(aypal|p)/i.test(proc[1])) pago = ' (PayPal)'; s = s.slice(proc[0].length); }
  const d = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const sentido = t.tipo === 'ingreso' ? 'de' : 'a';
  // La preposición solo si va suelta: en «Bizum Ana» o «Traspaso desde…», la A y el «de» son parte de otra palabra
  let m = d.match(/^(pago\s+)?bizum\s*(enviado|recibido)?\s*(?:(desde|para|de|a)(?=\s|$))?\s*/);
  if (m) { const r = titulo(s.slice(m[0].length)); return r ? `Bizum ${sentido} ${r}` : 'Bizum'; }
  m = d.match(/^(transf(erencia)?|trans|traspaso|tr)(?=[\s.\/:-]|$)\.?\s*(?:(inm(ediata)?|sepa|recibida|emitida|periodica)(?=[\s.\/:-]|$))?\s*[\/:.-]?\s*(?:(a favor de|desde|para|de|a)(?=\s|$))?\s*/);
  if (m && (m[1] !== 'tr' || m[0].length > 3)) {
    const r = titulo(s.slice(m[0].length).replace(/^[\s\/:.-]+/, ''));
    const tipo = m[1] === 'traspaso' ? 'Traspaso' : 'Transferencia';
    return r ? `${tipo} ${sentido} ${r}` : tipo;
  }
  if (/reintegro|retirada|cajero/.test(d)) return 'Retirada en cajero';
  if (/liquidacion tarjeta|recibo visa|visa clasica/.test(d)) return 'Liquidación de la tarjeta';
  if (/ingreso (de |en )?efectivo/.test(d)) return 'Ingreso en efectivo';
  const devolucion = /devolucion|reembolso/.test(d) ? 'Devolución ' : '';
  const marca = MARCAS.find(([re]) => re.test(d));
  if (marca) return devolucion + marca[1] + pago;
  s = s.replace(/^\d{2,4}\s+(?=\D)/, '')                                               // número de tienda suelto
    .replace(/\.(com|es|eu|net|org|io)(\/\S*)?(?=\s|$)/gi, ' ')                 // dominios
    .replace(/[*_]+/g, ' ')
    .replace(/\b(?=[a-z]*\d)(?=\d*[a-z])[a-z\d]{5,}\b|\b\d{5,}\b|\b(ref|nº|n\.)\s*\S+/gi, ' ') // referencias
    .replace(/\b(s\.?\s?a\.?|s\.?\s?l\.?(u\.?)?)\s*$/i, ' ')                          // S.A., S.L.
    .replace(/\s+/g, ' ').replace(/^[\s,.\-/]+|[\s,.\-/]+$/g, '');
  if (!s) return titulo(original);
  return (/[a-zñáéíóú]/.test(s) ? s : titulo(s)) + pago;
}


export const MEDIOS = { tarjeta: 'Tarjeta', transferencia: 'Transferencia', bizum: 'Bizum', efectivo: 'Efectivo', apple_pay: 'Apple Pay', recibo: 'Recibo' };
// Los movimientos importados antes de mejorar la detección quedaron como «transferencia»: si el concepto dice otra cosa, se usa esa
export const medioDe = t => t.medio === 'transferencia' && t.tipo === 'gasto' && esClaveBanco(t.cuenta) ? medioAutomatico(t.descripcion, t.tipo) : (t.medio || 'transferencia');

// ─── TU DINERO (saldos de cuentas, aparte de los ingresos y gastos del mes) ───
export const TIPOS_CUENTA = { efectivo: ['Efectivo', 'cartera'], ahorro: ['Ahorro', 'escudo'], banco: ['Banco', 'banco'], inversion: ['Inversión', 'tendencia'] };
export const totalCuentas = (cuentas, txs = []) => cuentas.reduce((s, c) => s + saldoDisponible(c, txs, cuentas).disponible, 0);
const NOMBRES_CUENTA = { bankinter: 'Bankinter', bbva: 'BBVA', santander: 'Santander', caixabank: 'CaixaBank', ing: 'ING', revolut: 'Revolut', n26: 'N26', efectivo: 'Efectivo', generico: 'Otro banco', apple_pay: 'Apple Pay', manual: 'Apuntado a mano', previsto: 'Previsto' };
export const formaDePago = t => t.cuenta === 'apple_pay' ? 'Apple Pay' : t.cuenta === CUENTA_LIBERADO ? 'De tu dinero de paso' : MEDIOS[medioDe(t)] || 'Transferencia';

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

// Clave para no duplicar al importar: misma fecha, mismo concepto y mismo importe
const normalizar = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const claveMovimiento = t => `${t.fecha}|${normalizar(t.descripcion)}|${parseFloat(t.importe)}`;
const diasEntre = (desde, hasta) => Math.round((new Date(hasta + 'T12:00:00') - new Date(desde + 'T12:00:00')) / 86400000);

// Retenidos (movimientos que el banco aún no ha cobrado del todo). Al importar un extracto de una cuenta:
// - un movimiento definitivo con el mismo importe y fecha entre 0 y 7 días después de un retenido guardado es ese retenido ya cobrado;
// - los retenidos del archivo que ya estaban guardados como retenidos no se repiten;
// - los retenidos guardados que ya no aparecen (ni cobrados ni retenidos) se quitan, si el archivo llega hasta su fecha.
export function conciliarRetenidos(definitivos, retenidosArchivo, guardados, cuenta) {
  const libres = guardados.filter(t => t.pendiente && t.cuenta === cuenta);
  const cobrados = [], sinRetener = [];
  definitivos.forEach(d => {
    const i = libres.findIndex(p => p.tipo === d.tipo && Math.abs(+p.importe - +d.importe) < 0.005 && diasEntre(p.fecha, d.fecha) >= 0 && diasEntre(p.fecha, d.fecha) <= 7);
    if (i >= 0) { cobrados.push({ retenido: libres[i], definitivo: d }); libres.splice(i, 1); } else sinRetener.push(d);
  });
  const enArchivo = new Set(retenidosArchivo.map(claveMovimiento));
  const yaGuardados = new Set(libres.filter(p => enArchivo.has(claveMovimiento(p))).map(claveMovimiento));
  const ultimaFecha = [...definitivos, ...retenidosArchivo].reduce((m, t) => t.fecha > m ? t.fecha : m, '');
  return {
    definitivos: sinRetener,
    cobrados,
    retenidosNuevos: retenidosArchivo.filter(r => !yaGuardados.has(claveMovimiento(r))),
    caducados: libres.filter(p => !enArchivo.has(claveMovimiento(p)) && p.fecha <= ultimaFecha)
  };
}

// Saldo de una cuenta de banco descontando lo retenido (como el «saldo disponible» del banco)
// y sumando lo apuntado después del último extracto (ver apuntadoSinExtracto)
export function saldoDisponible(cuenta, txs, cuentas = [cuenta]) {
  const saldo = parseFloat(cuenta.saldo || 0);
  if (!cuenta.clave) return { saldo, retenido: 0, apuntado: 0, disponible: saldo };
  const ret = txs.filter(t => t.pendiente && t.cuenta === cuenta.clave);
  const retenido = sumar(ret.filter(t => t.tipo === 'gasto')) - sumar(ret.filter(t => t.tipo === 'ingreso'));
  const apuntado = apuntadoSinExtracto(cuenta, cuentas, txs);
  return { saldo, retenido, apuntado, disponible: saldo - retenido + apuntado };
}

// Lo apuntado a mano (tarjeta, Bizum, transferencia…) o con Apple Pay que aún no ha llegado en un extracto también mueve el
// dinero del banco: se suma (ingresos) o se resta (gastos) en la cuenta de banco con el extracto más reciente, hasta que el
// siguiente extracto lo traiga. Lo apuntado a mano o con Apple Pay sigue así hasta que se junta con el banco (si en el banco
// aún está retenido, pasa a ser un retenido); se cuenta desde 7 días antes de la fecha del saldo, por si el banco lo carga
// más tarde. Ni el efectivo ni lo previsto.
export function apuntadoSinExtracto(cuenta, cuentas, txs) {
  const total = movimientosSinExtracto(cuenta, cuentas, txs).reduce((s, t) => s + (t.tipo === 'ingreso' ? 1 : -1) * parseFloat(t.importe), 0);
  return Math.round(total * 100) / 100;
}
export function movimientosSinExtracto(cuenta, cuentas, txs) {
  if (!cuenta.clave) return [];
  const esPrincipal = cuentaPrincipal(cuentas)?.id === cuenta.id;
  const d = new Date(cuenta.fecha_saldo + 'T12:00:00'); d.setDate(d.getDate() - 7);
  const desdeManual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const suyo = t => esManual(t) ? (destinoManual(t) ? destinoManual(t) === cuenta.clave : esPrincipal) : false;
  return txs.filter(t => (t.tipo === 'ingreso' || t.tipo === 'gasto')
    && ((suyo(t) || (esPrincipal && t.cuenta === 'apple_pay')) && t.fecha > desdeManual))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// Lo apuntado a mano (o con Apple Pay) que ya estaba en el banco antes de apuntarlo no se junta al importar, porque el
// del banco no es nuevo: queda repetido. Esto busca su «gemelo» ya guardado del banco (mismo tipo e importe, fecha cercana).
export function gemeloEnBanco(t, txs) {
  if (!esManual(t) && t.cuenta !== 'apple_pay') return null;
  return txs.filter(x => x !== t && esClaveBanco(x.cuenta) && x.tipo === t.tipo && Math.abs(+x.importe - +t.importe) < 0.005
      && diasEntre(t.fecha, x.fecha) >= -3 && diasEntre(t.fecha, x.fecha) <= 7)
    .sort((a, b) => Math.abs(diasEntre(t.fecha, a.fecha)) - Math.abs(diasEntre(t.fecha, b.fecha)))[0] || null;
}

// Lo apuntado a mano que saldrá en el banco (tarjeta, Bizum, transferencia o un ingreso de efectivo) se guarda con cuenta 'manual'.
// Al importar el extracto se junta con su movimiento del banco en vez de repetirse.
export const CUENTA_MANUAL = 'manual';
// Con varias cuentas de banco, lo apuntado a mano guarda a cuál va: 'manual:bankinter·1234'
export const esManual = t => t.cuenta === CUENTA_MANUAL || String(t.cuenta || '').startsWith(CUENTA_MANUAL + ':');
export const destinoManual = t => esManual(t) ? (String(t.cuenta).split(':')[1] || null) : null;
export const cuentaManual = clave => clave ? `${CUENTA_MANUAL}:${clave}` : CUENTA_MANUAL;

// ─── VARIAS CUENTAS ───
// Una cuenta de banco se reconoce por el banco y las 4 últimas cifras de su número (clave 'bankinter·1234').
// Las creadas antes de leer el número (clave 'bankinter') lo adoptan la primera vez que llega en un extracto.
export const claveCuentaBanco = (banco, fin) => fin ? `${banco}·${fin}` : banco;
export const bancoDeClave = clave => String(clave || '').split('·')[0];
export const cuentasBanco = cuentas => (cuentas || []).filter(c => c.clave);
// Si el valor de «cuenta» de un movimiento es una cuenta de banco (y no efectivo, a mano, Apple Pay, previsto o tarjeta de crédito)
export const esClaveBanco = c => !!c && !['manual', 'efectivo', 'apple_pay', 'previsto', 'principal', 'liberado'].includes(c) && !String(c).startsWith('manual:') && !String(c).endsWith('_tarjeta');
// La cuenta principal: la que elige cada persona (pj_cuentas.principal) o, si no ha elegido, la primera que tuvo (la más
// antigua), que no cambia al subir el extracto de otra. Viene elegida al apuntar a mano, y a ella va lo que no dice a qué
// cuenta pertenece (lo apuntado sin cuenta y los pagos de Apple Pay).
export const cuentaPrincipal = cuentas => {
  const bancos = cuentasBanco(cuentas);
  return bancos.find(c => c.principal) || bancos.sort((a, b) => String(a.creada || '9').localeCompare(String(b.creada || '9')))[0] || null;
};
// Si la base de datos ya tiene la columna para elegirla (sql/2026-11-cuenta-principal.sql)
export const sePuedeElegirPrincipal = cuentas => (cuentas || []).some(c => 'principal' in c);
// Las 4 últimas cifras de la cuenta, si la clave las tiene ('bankinter·1234' → '1234')
export const numeroDeClave = clave => (String(clave || '').match(/·(\d{4})$/) || [])[1] || null;
// Bancos para añadir una cuenta a mano. La clave es la que pone la app al leer su extracto ('generico' para los demás);
// en cualquier caso, el extracto la reconoce por sus 4 últimas cifras.
export const BANCOS = [['bankinter', 'Bankinter'], ['bbva', 'BBVA'], ['santander', 'Santander'], ['caixabank', 'CaixaBank'], ['ing', 'ING'],
  ['revolut', 'Revolut'], ['n26', 'N26'], ['generico', 'Otro banco']];
const ENTIDADES = { '0128': 'Bankinter', '0182': 'BBVA', '0049': 'Santander', '2100': 'CaixaBank', '1465': 'ING', '0081': 'Sabadell', '0073': 'Openbank', '2085': 'Ibercaja', '2095': 'Kutxabank', '2103': 'Unicaja', '3058': 'Cajamar', '0239': 'EVO Banco' };

// De qué cuenta es un extracto. Devuelve { clave, nombre, nueva, adoptar, preguntar, opciones }:
// - con número: la cuenta que ya lo tiene; si no, la antigua sin número de ese banco (si sus movimientos encajan con el
//   archivo, adopta el número) o una nueva;
// - sin número: la única cuenta de ese banco, o se pregunta si hay varias.
export function cuentaParaExtracto(cuentas, txs, { banco, fin, entidad, movs }) {
  const delBanco = cuentasBanco(cuentas).filter(c => bancoDeClave(c.clave) === banco);
  const nombreBanco = banco === 'generico' ? (ENTIDADES[entidad] || 'Mi banco') : nombreCuenta(banco);
  const libre = () => { // clave nueva que no choque con otra cuenta
    if (fin) return claveCuentaBanco(banco, fin);
    if (!delBanco.some(c => c.clave === banco)) return banco;
    for (let n = 2; ; n++) if (!delBanco.some(c => c.clave === `${banco}·${n}`)) return `${banco}·${n}`;
  };
  const nueva = { clave: libre(), nombre: delBanco.length ? `${nombreBanco}${fin ? ` ···${fin}` : ' (otra cuenta)'}` : nombreBanco, nueva: true };
  const opciones = delBanco.map(c => ({ clave: c.clave, nombre: c.nombre }));
  // Cuentas añadidas a mano que aún no tienen ningún extracto: si no se sabe de cuál es el archivo, se ofrecen
  const sinExtracto = cuentasBanco(cuentas).filter(c => !txs.some(t => t.cuenta === c.clave));
  const conSinExtracto = [...opciones, ...sinExtracto.filter(c => !delBanco.includes(c)).map(c => ({ clave: c.clave, nombre: c.nombre }))];
  if (fin) {
    const exacta = delBanco.find(c => c.clave === claveCuentaBanco(banco, fin));
    if (exacta) return { clave: exacta.clave, nombre: exacta.nombre, opciones };
    // Mismo número en una cuenta de otro banco: la añadida a mano con otro banco, o un archivo con un formato que no es el suyo
    const porNumero = cuentasBanco(cuentas).filter(c => numeroDeClave(c.clave) === fin);
    if (porNumero.length === 1) return { clave: porNumero[0].clave, nombre: porNumero[0].nombre, opciones };
    const antigua = delBanco.find(c => c.clave === banco);
    if (antigua) {
      // ¿Es la misma? Si la antigua tiene movimientos en esas fechas y ninguno coincide con el archivo, es otra cuenta
      const fechas = movs.map(t => t.fecha).sort(), claves = new Set(movs.map(claveMovimiento));
      const suyos = txs.filter(t => t.cuenta === banco && t.fecha >= fechas[0] && t.fecha <= fechas[fechas.length - 1]);
      // Si alguno coincide, es la misma y no se pregunta; si no hay con qué comparar, se propone la antigua pero se pregunta
      const coincide = suyos.some(t => claves.has(claveMovimiento(t))), misma = !suyos.length || coincide;
      return { ...(misma ? { clave: banco, nombre: antigua.nombre, adoptar: claveCuentaBanco(banco, fin) } : nueva), preguntar: !coincide, opciones, nuevaPropuesta: nueva };
    }
    // Otro número: es otra cuenta (si hay alguna añadida a mano sin extracto, se pregunta por si es esa)
    return { ...nueva, opciones: conSinExtracto, preguntar: sinExtracto.length > 0, nuevaPropuesta: nueva };
  }
  // Sin número y de un banco que no conocemos («generico» son muchos bancos distintos): se pregunta entre todas tus cuentas
  if (banco === 'generico' && cuentasBanco(cuentas).length) {
    const todas = cuentasBanco(cuentas).map(c => ({ clave: c.clave, nombre: c.nombre }));
    return { ...(delBanco.length === 1 ? { clave: delBanco[0].clave, nombre: delBanco[0].nombre } : nueva), preguntar: true, opciones: todas, nuevaPropuesta: nueva };
  }
  if (delBanco.length === 1) return { clave: delBanco[0].clave, nombre: delBanco[0].nombre, opciones };
  if (!delBanco.length) {
    if (!sinExtracto.length) return { ...nueva, opciones, nuevaPropuesta: nueva };
    return { clave: sinExtracto[0].clave, nombre: sinExtracto[0].nombre, preguntar: true, opciones: conSinExtracto, nuevaPropuesta: nueva };
  }
  const principal = cuentaPrincipal(delBanco);
  return { clave: principal.clave, nombre: principal.nombre, preguntar: true, opciones, nuevaPropuesta: nueva };
}

// Traspasos entre tus cuentas de banco: sale una cantidad de una y entra la misma en otra (hasta 2 días de diferencia).
// No se emparejan pagos con tarjeta ni retenidos. Cada movimiento, como mucho con otro.
export function detectarTraspasos(nuevos, txs, clave, clavesBanco) {
  const otras = new Set([...clavesBanco].filter(c => c !== clave));
  if (!otras.size) return { pares: [] };
  const valido = t => (t.tipo === 'gasto' || t.tipo === 'ingreso') && !t.pendiente && !['tarjeta', 'apple_pay', 'recibo'].includes(medioDe(t)) && t.categoria !== '💳 Liquidación tarjeta';
  const libres = txs.filter(t => otras.has(t.cuenta) && valido(t));
  const posibles = [];
  nuevos.forEach((n, i) => {
    if (!valido(n)) return;
    libres.forEach((g, j) => {
      const d = Math.abs(diasEntre(g.fecha, n.fecha));
      if (g.tipo !== n.tipo && Math.abs(+g.importe - +n.importe) < 0.005 && d <= 2) posibles.push({ i, j, d });
    });
  });
  posibles.sort((a, b) => a.d - b.d);
  const usadosN = new Set(), usadosG = new Set(), pares = [];
  posibles.forEach(({ i, j }) => {
    if (usadosN.has(i) || usadosG.has(j)) return;
    usadosN.add(i); usadosG.add(j);
    pares.push({ nuevo: nuevos[i], guardado: libres[j] });
  });
  return { pares };
}

// ─── MOVIMIENTOS FIJOS (mensualidad, nómina, beca, alquiler…) ───
// Cada persona apunta los suyos (tabla pj_fijos). El día que toca, la app crea un movimiento «previsto» (cuenta 'previsto')
// que cuenta como uno más; al importar el extracto se junta con el real y toma su importe aunque haya cambiado.
export const CUENTA_PREVISTO = 'previsto';
// Fecha del fijo en un mes; si el mes tiene menos días, el último
export const fechaFijo = (f, ym) => `${ym}-${String(Math.min(+f.dia, diasDelMes(ym))).padStart(2, '0')}`;
// Última vez que tocaba hasta hoy (incluido): al crear un fijo se empieza a contar desde ahí, para no repetir lo que ya está
export function ultimaFechaFijo(f, hoy = hoyISO()) {
  const ym = hoy.slice(0, 7), este = fechaFijo(f, ym);
  return este <= hoy ? este : fechaFijo(f, sumarMeses(ym, -1));
}
export function proximaFechaFijo(f, hoy = hoyISO()) {
  const ym = hoy.slice(0, 7), este = fechaFijo(f, ym);
  return este > hoy ? este : fechaFijo(f, sumarMeses(ym, 1));
}
// Previstos que faltan por crear: los que tocaban después de «ultimo» y hasta hoy (como mucho 6 por fijo)
export function previstosPendientes(fijos, hoy = hoyISO()) {
  const lista = [];
  (fijos || []).filter(f => f.activo !== false).forEach(f => {
    const desde = f.ultimo || ultimaFechaFijo(f, hoy);
    const suyos = [];
    for (let ym = desde.slice(0, 7), i = 0; i < 12; ym = sumarMeses(ym, 1), i++) {
      const fecha = fechaFijo(f, ym);
      if (fecha > hoy) break;
      if (fecha > desde) suyos.push({ fijo: f, fecha });
    }
    lista.push(...suyos.slice(-6));
  });
  return lista;
}
export const movimientoPrevisto = (f, fecha) => ({ fecha, descripcion: f.nombre, importe: +f.importe, tipo: f.tipo, categoria: f.categoria, medio: f.medio || 'transferencia', cuenta: CUENTA_PREVISTO });

// ─── ¿LLEGO A FIN DE MES? ───
const sumarDias = (fecha, n) => { const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const redondear = n => Math.round(n * 100) / 100;
// Gasto del día a día: lo que no es un movimiento fijo (ni lo previsto, ni traspasos ni dinero de paso)
const categoriasFijas = fijos => new Set((fijos || []).filter(f => f.activo !== false && f.tipo === 'gasto').map(f => f.categoria));
const esDelDiaADia = (t, fijas) => esGasto(t) && t.cuenta !== CUENTA_PREVISTO && !fijas.has(t.categoria);

// Lo que sueles gastar al día en el día a día: la semana típica (la mediana) de las últimas 12 semanas hasta ayer, para
// que una compra grande puntual o un pago mensual (el alquiler cae en una sola semana) no lo cambien. Con menos de una
// semana de datos, null.
export function gastoDiarioHabitual(txs, fijos, hoy = hoyISO()) {
  const reales = txs.filter(t => t.cuenta !== CUENTA_PREVISTO);
  if (!reales.length) return null;
  const primero = reales.reduce((m, t) => t.fecha < m ? t.fecha : m, hoy);
  const ayer = sumarDias(hoy, -1);
  const semanas = Math.min(12, Math.floor((diasEntre(primero, ayer) + 1) / 7));
  if (semanas < 1) return null;
  const fijas = categoriasFijas(fijos);
  const delDia = desglosar(txs).filter(t => esDelDiaADia(t, fijas));
  const sumas = Array.from({ length: semanas }, (_, k) => {
    const hasta = sumarDias(ayer, -7 * k), desde = sumarDias(hasta, -6);
    return sumar(delDia.filter(t => t.fecha >= desde && t.fecha <= hasta));
  }).sort((a, b) => a - b);
  const mitad = Math.floor(semanas / 2);
  const mediana = semanas % 2 ? sumas[mitad] : (sumas[mitad - 1] + sumas[mitad]) / 2;
  return { diario: redondear(mediana / 7), semanas };
}

// Movimientos fijos que aún no han llegado este mes (su día es después de hoy y no ha llegado ya uno parecido, por
// ejemplo la nómina que entró un par de días antes), como movimientos previstos
export function fijosPendientes(txs, fijos, hoy = hoyISO()) {
  const mes = hoy.slice(0, 7);
  return (fijos || []).filter(f => f.activo !== false).map(f => ({ f, fecha: fechaFijo(f, mes) }))
    .filter(({ f, fecha }) => fecha > hoy && !txs.some(t => t.tipo === f.tipo && t.categoria === f.categoria
      && Math.abs(diasEntre(fecha, t.fecha)) <= 10 && Math.abs(+t.importe - +f.importe) <= +f.importe * 0.5))
    .map(({ f, fecha }) => movimientoPrevisto(f, fecha));
}

// Previsión del mes en curso: el balance que llevas, más lo que falta por llegar o pagar de tus movimientos fijos (los que
// cuentan para este mes: la mensualidad de los últimos días ya es del siguiente), menos lo que sueles gastar en el día a
// día en los días que quedan (hoy, solo lo que te falte por gastar). `final` es null si no hay datos para saber lo habitual.
export function prevision(txs, fijos, hoy = hoyISO()) {
  const mes = hoy.slice(0, 7), dias = diasDelMes(mes), dia = Number(hoy.slice(8));
  const ahora = resumenMes(txs, mes);
  const pendientes = fijosPendientes(txs, fijos, hoy).filter(t => mesEfectivo(t) === mes);
  const conFijos = resumenMes([...txs, ...pendientes], mes);
  const base = redondear(conFijos.queda); // lo que te quedaría sin gastar nada más
  const habitual = gastoDiarioHabitual(txs, fijos, hoy);
  const restantes = dias - dia; // días después de hoy
  const out = { mes, llevas: redondear(ahora.queda), pendientes, base, restantes, ingresado: conFijos.ingresado, enEspera: ahora.enEspera,
    maxDiario: base > 0 ? redondear(base / (restantes + 1)) : 0, habitual, final: null, estado: null };
  if (!habitual) return out;
  const fijas = categoriasFijas(fijos);
  const gastoHoy = sumar(desglosar(txs).filter(t => t.fecha === hoy && esDelDiaADia(t, fijas)));
  out.restoDeHoy = redondear(Math.max(0, habitual.diario - gastoHoy));
  out.diaADia = redondear(habitual.diario * restantes + out.restoDeHoy);
  out.final = redondear(base - out.diaADia);
  out.estado = out.final < 0 ? 'no' : out.final < Math.max(20, conFijos.ingresado * 0.05) ? 'justo' : 'bien';
  return out;
}

// Empareja movimientos nuevos del extracto con lo que ya estaba apuntado: mismo tipo e importe y fecha del banco
// entre 3 días antes y 7 después. Si hay varios posibles, gana la fecha más cercana, la misma forma de pago y alguna palabra en común.
// - seguro: era un apuntado a mano (cuenta 'manual') o un pago de Apple Pay;
// - dudoso: es un movimiento de ese mismo banco, dentro de las fechas del extracto, que no aparece en él
//   (lo apuntado a mano antes de existir la marca 'manual'); se pregunta antes de juntarlo.
export function emparejarApuntados(nuevos, txs, extracto) {
  if (!nuevos.length || !extracto.length) return { quedan: nuevos, pares: [] };
  const enExtracto = new Set(extracto.map(claveMovimiento));
  const cuentas = new Set(extracto.map(t => t.cuenta));
  const fechas = extracto.map(t => t.fecha).sort();
  const desde = fechas[0], hasta = fechas[fechas.length - 1];
  const candidatos = txs.filter(t => (t.tipo === 'gasto' || t.tipo === 'ingreso') && !t.pendiente && ((esManual(t) && (!destinoManual(t) || cuentas.has(destinoManual(t)))) || t.cuenta === 'apple_pay' || t.cuenta === CUENTA_PREVISTO
    || (cuentas.has(t.cuenta) && t.fecha >= desde && t.fecha <= hasta && !enExtracto.has(claveMovimiento(t)))));
  const palabras = s => new Set(String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9ñ]+/).filter(p => p.length >= 4));
  const posibles = [];
  nuevos.forEach((n, i) => {
    const pn = palabras(n.descripcion);
    candidatos.forEach((g, j) => {
      if (g.tipo !== n.tipo) return;
      const d = diasEntre(g.fecha, n.fecha), mismoImporte = Math.abs(+g.importe - +n.importe) < 0.005;
      const comun = [...palabras(g.descripcion)].some(p => pn.has(p));
      if (g.cuenta === CUENTA_PREVISTO) {
        // Previsto: el real puede llegar unos días antes o después y con otro importe (hasta la mitad de diferencia).
        // Seguro si coincide el importe, o la categoría con poca diferencia; si no, se pregunta.
        if (d < -10 || d > 10) return;
        const dif = Math.abs(+g.importe - +n.importe) / +g.importe, mismaCat = n.categoria === g.categoria;
        const generica = SIN_CLASIFICAR.has(n.categoria) || n.categoria === '💰 Ingresos';
        if (dif > 0.5 || !(mismoImporte || mismaCat || generica)) return;
        posibles.push({ i, j, exacto: mismoImporte, seguro: mismoImporte || (mismaCat && dif <= 0.2) || (generica && dif <= 0.1 && Math.abs(d) <= 5), puntos: Math.abs(d) / 3 + (mismoImporte ? 0 : 1 + dif * 4) - (mismaCat ? 3 : 0) - (comun ? 2 : 0) });
        return;
      }
      if (!mismoImporte || d < -3 || d > 7) return;
      const apuntado = esManual(g) || g.cuenta === 'apple_pay';
      posibles.push({ i, j, exacto: true, seguro: apuntado, puntos: Math.abs(d) + (g.medio && n.medio && g.medio !== n.medio ? 3 : 0) - (comun ? 3 : 0) + (apuntado ? 0 : 0.5) });
    });
  });
  // Antes que nada, las de importe exacto (p. ej. una transferencia apuntada a mano no debe perder su movimiento del banco
  // frente a un previsto de importe parecido); después, las seguras; y entre iguales, las de menos puntos
  posibles.sort((a, b) => (b.exacto - a.exacto) || (b.seguro - a.seguro) || a.puntos - b.puntos);
  const usadosN = new Set(), usadosG = new Set(), pares = [];
  posibles.forEach(({ i, j, seguro }) => {
    if (usadosN.has(i) || usadosG.has(j)) return;
    usadosN.add(i); usadosG.add(j);
    pares.push({ guardado: candidatos[j], banco: nuevos[i], seguro, previsto: candidatos[j].cuenta === CUENTA_PREVISTO, applePay: candidatos[j].cuenta === 'apple_pay' });
  });
  pares.sort((a, b) => b.banco.fecha.localeCompare(a.banco.fecha));
  return { quedan: nuevos.filter((_, i) => !usadosN.has(i)), pares };
}

export function nombreCuenta(c) {
  if (!c || c === 'principal') return 'Cuenta';
  if (c.endsWith('_tarjeta')) return (NOMBRES_CUENTA[c.slice(0, -8)] || c.slice(0, -8)) + ' · tarjeta';
  const [banco, fin] = c.split('·');
  return (NOMBRES_CUENTA[banco] || banco) + (fin ? (/^\d{4}$/.test(fin) ? ` ···${fin}` : ` (${fin})`) : '');
}
