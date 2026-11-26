// Lectura de extractos (Excel o CSV) de cuenta, tarjeta o efectivo. Detecta el tipo de archivo y el banco solos.
// Solo está probado de verdad con Bankinter; otros formatos conocidos se reconocen por sus cabeceras, y los desconocidos
// se leen con un «formato» (qué columna es cada cosa) que la app propone y la persona puede corregir (asistente de columnas).

import { categoriaConAprendizaje, medioAutomatico } from './logica.js';

export async function leerFilas(archivo) {
  const buf = await archivo.arrayBuffer();
  if (/\.(csv|txt)$/i.test(archivo.name)) {
    // UTF-8 si lo es; si no, la codificación de Windows que usan muchos bancos (tildes y ñ)
    let texto = new TextDecoder('utf-8').decode(buf);
    if (texto.includes('\uFFFD')) texto = new TextDecoder('windows-1252').decode(buf);
    return leerCSV(texto.replace(/^\uFEFF/, ''));
  }
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
}

// CSV con separador ; , tabulador o | (el que reparte las líneas en el mismo número de columnas) y campos entre comillas
export function leerCSV(texto) {
  const lineas = texto.split(/\r?\n/);
  const muestra = lineas.filter(l => l.trim()).slice(0, 40);
  const puntos = sep => {
    const veces = {};
    muestra.forEach(l => { const n = partirLinea(l, sep).length; if (n > 1) veces[n] = (veces[n] || 0) + 1; });
    const [cols, n] = Object.entries(veces).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] || [0, 0];
    return n * 1000 + +cols;
  };
  const sep = [';', '\t', ',', '|'].reduce((mejor, s) => puntos(s) > puntos(mejor) ? s : mejor);
  return lineas.map(l => partirLinea(l, sep));
}
function partirLinea(linea, sep) {
  const celdas = [];
  let actual = '', comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (comillas) {
      if (c !== '"') actual += c;
      else if (linea[i + 1] === '"') { actual += '"'; i++; } else comillas = false;
    } else if (c === '"') comillas = true;
    else if (c === sep) { celdas.push(actual.trim()); actual = ''; }
    else actual += c;
  }
  celdas.push(actual.trim());
  return celdas;
}

const normal = c => String(c).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Fechas: 2026-09-25, 25/09/2026, 25-09-26, 25.09.2026, «25 sep 2026», «25-SEP-26» o el número de serie de Excel
const MESES = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };
export function parsearFecha(valor) {
  if (valor === '' || valor == null) return null;
  if (typeof valor === 'number') {
    if (valor < 36526 || valor > 73051) return null; // entre 2000 y 2100: si no, es un importe, no una fecha
    return new Date(Math.round((valor - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  const s = normal(valor);
  const valida = (a, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(+a, m, 0).getDate() ? `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  const año = a => a.length === 2 ? '20' + a : a;
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return valida(m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})(?!\d)/);
  if (m) return valida(año(m[3]), +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[\s\-\/.]*([a-z]{3})[a-z]*\.?[\s\-\/.,]*(\d{4}|\d{2})(?!\d)/);
  if (m && MESES[m[2]]) return valida(año(m[3]), MESES[m[2]], +m[1]);
  return null;
}

// Importes como número de Excel o como texto: «-1.234,56 €», «1,234.56», «12,30-», «(12,30)», «+45»
export function parsearImporte(valor) {
  if (typeof valor === 'number') return valor;
  let s = String(valor ?? '').replace(/[€\s\u00a0]|eur/gi, '').replace(/[−–]/g, '-');
  if (!s) return NaN;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  if (/^[\d.,]+-$/.test(s)) { negativo = true; s = s.slice(0, -1); }
  s = s.replace(/^\+/, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');       // 1.234,56
  else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, '');                     // 1,234.56
  else s = s.replace(/[.,](?=\d{3}(?!\d))/g, '');                               // 1.234 o 1,234 (miles)
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return negativo ? -parseFloat(s) : parseFloat(s);
}

export function detectarBanco(cabecera) {
  const h = cabecera.map(normal);
  const todo = h.join('|');
  if (h.includes('movimiento') && h.includes('disponible')) return 'bbva';
  if (h.includes('tarjeta') && h.includes('concepto') && h.includes('importe') && !h.includes('movimiento')) return 'bbva_tarjeta';
  if (h.includes('f.valor') || (h.includes('fecha contable') && h.includes('fecha valor'))) return 'bankinter';
  if ((todo.includes('fecha operacion') || todo.includes('f.operacion')) && h.some(c => c.includes('comercio'))) return 'bankinter_tarjeta';
  if (h.some(c => c.includes('comercio')) && h.some(c => c.includes('importe')) && !h.includes('saldo') && !h.includes('disponible')) return 'bankinter_tarjeta';
  if (h.includes('data operacio')) return 'caixabank';
  if (h.includes('subcategoria') || h.includes('subcategory')) return 'ing';
  if (todo.includes('started date') || todo.includes('completed date')) return 'revolut';
  if (todo.includes('payee') && todo.includes('payment reference')) return 'n26';
  if (h.includes('concepto') && h.includes('importe') && h.includes('saldo')) return 'santander';
  return 'generico';
}

// Cabecera de la plantilla de efectivo: Fecha · Concepto · Categoria · Clase · Medio de pago · Importe
const esPlantillaEfectivo = h => h.some(c => c === 'clase' || c.includes('medio de pago')) && h.some(c => c.includes('concepto'));

// Bankinter pone antes un bloque de «movimientos pendientes» (retenidos) con otra cabecera más corta:
// se usa la cabecera del banco reconocido para los movimientos, y se recuerda dónde empezaba ese bloque.
function buscarCabecera(filas) {
  let inicio = -1, cabecera = [], banco = 'generico', previa = -1;
  for (let i = 0; i < Math.min(filas.length, 40); i++) {
    const f = filas[i].map(c => String(c).toLowerCase());
    if (f.some(c => c.includes('fecha') || c.includes('date') || c.includes('data')) &&
        (f.some(c => c.includes('importe') || c.includes('amount') || c.includes('import')) || f.some(c => c.includes('concepto') || c.includes('descripci') || c.includes('payee') || c.includes('comercio')))) {
      const b = detectarBanco(filas[i]);
      if (b !== 'generico' && inicio >= 0 && banco === 'generico') previa = inicio - 1;
      if (inicio < 0 || b !== 'generico') { inicio = i + 1; cabecera = filas[i]; banco = b; }
      if (b !== 'generico' || esPlantillaEfectivo(filas[i].map(normal))) break;
    }
  }
  return { inicio, cabecera, banco, previa };
}

// Movimientos del bloque de retenidos (entre su cabecera y la cabecera principal del extracto)
function leerRetenidos(filas, previa, finBloque, banco, reglas) {
  if (previa < 0) return [];
  const h = filas[previa].map(normal);
  const cF = h.findIndex(c => c.includes('fecha')), cD = h.findIndex(c => c.includes('descripci') || c.includes('concepto')), cI = h.findIndex(c => c.includes('importe'));
  if (cF < 0 || cD < 0 || cI < 0) return [];
  const lista = [];
  for (const f of filas.slice(previa + 1, finBloque)) {
    const fecha = parsearFecha(f[cF]), descripcion = String(f[cD] || '').trim(), bruto = parsearImporte(f[cI]);
    if (!fecha || !descripcion || isNaN(bruto) || bruto === 0) continue;
    const tipo = bruto < 0 ? 'gasto' : 'ingreso';
    lista.push({ fecha, descripcion, importe: Math.abs(bruto), tipo, categoria: categoriaConAprendizaje(descripcion, tipo, reglas), medio: medioAutomatico(descripcion, tipo), cuenta: banco, pendiente: true });
  }
  return lista;
}

// Número de la cuenta, si el banco lo pone encima de los movimientos: IBAN (también en parte oculto con asteriscos) o
// cuenta de 20 cifras. Se usan sus 4 últimas cifras para reconocer la cuenta, y la entidad para poner nombre a un banco desconocido.
export function leerCuentaArchivo(filas, hasta) {
  for (const f of filas.slice(0, Math.max(0, hasta))) {
    for (const c of f) {
      const s = String(c ?? '').toUpperCase().trim();
      if (!s) continue;
      // El IBAN puede ir solo en su celda o dentro de una frase («Movimientos de la cuenta ES76 0081 …»)
      const suelto = s.match(/\b[A-Z]{2}\d{2}(?:[\s.-]?[A-Z0-9*X]{4}){3,7}(?:[\s.-]?[A-Z0-9*X]{1,4})?\b/);
      const compacto = (suelto ? suelto[0] : s).replace(/[\s.-]/g, '');
      let m = compacto.match(/(?:^|[^A-Z])([A-Z]{2})(\d{2})(\d{4})?([A-Z0-9]{7,26})(?![A-Z0-9])/);
      if (m && m[3] && /\d{4}$/.test(m[4])) return { fin: m[4].slice(-4), entidad: m[1] === 'ES' ? m[3] : null };
      m = s.match(/\b([A-Z]{2})\d{2}[\s\d*X·.]*[*X·.]{2,}[\s*X·.]*(\d{4})\s*$/);
      if (m) return { fin: m[2], entidad: null };
      m = compacto.match(/(?<!\d)(\d{4})\d{12}(\d{4})(?!\d)/);
      if (m) return { fin: m[2], entidad: m[1] };
    }
  }
  return null;
}

// Devuelve { tipo, banco, txs } o { error }. `hayTarjeta`: si ya hay movimientos de tarjeta de crédito importados.
// Con un formato (elegido en el asistente de columnas) se lee con él; si no, con el recordado para ese archivo (`formatos`,
// { firma: formato }), con el del banco si se reconoce, o con uno propuesto. Si no está claro, devuelve { necesitaFormato, propuesta } para preguntar.
export function analizarExtracto(filas, { reglas, hayTarjeta, formato, formatos }) {
  if (formato) return leerConFormato(filas, formato, { reglas, hayTarjeta });
  const recordado = formatoRecordado(filas, formatos || {});
  if (recordado) return leerConFormato(filas, recordado, { reglas, hayTarjeta });
  const { inicio, cabecera, banco, previa } = buscarCabecera(filas);
  if (inicio < 0 || (banco === 'generico' && !esPlantillaEfectivo(cabecera.map(normal)))) {
    const p = proponerFormato(filas);
    if (!p) return { error: 'No hemos encontrado movimientos en este archivo (filas con fecha e importe).' };
    if (!p.seguro) return { necesitaFormato: true, propuesta: p };
    const r = leerConFormato(filas, p, { reglas, hayTarjeta });
    return r.txs.length ? r : { necesitaFormato: true, propuesta: p };
  }
  const h = cabecera.map(normal);
  const col = (...pruebas) => h.findIndex(c => pruebas.some(p => typeof p === 'string' ? c.includes(p) : p.test(c)));
  const txs = [];

  if (esPlantillaEfectivo(h)) {
    const cF = col('fecha'), cD = col('concepto', 'descripci', 'comercio'), cI = col('importe', 'cantidad', 'monto');
    const cC = col('categor'), cT = col(/^(clase|tipo)$/), cM = col('medio'), cB = col('banco', 'entidad');
    for (const f of filas.slice(inicio)) {
      const fecha = parsearFecha(f[cF]), descripcion = String(f[cD] || '').trim(), bruto = parsearImporte(f[cI]);
      if (!fecha || !descripcion || isNaN(bruto) || bruto === 0) continue;
      let tipo = bruto < 0 ? 'gasto' : 'ingreso';
      if (cT >= 0 && f[cT]) tipo = String(f[cT]).toLowerCase().includes('ingreso') ? 'ingreso' : 'gasto';
      const m = cM >= 0 ? normal(f[cM]) : '';
      const medio = m.includes('bizum') ? 'bizum' : m.includes('tarjeta') ? 'tarjeta' : m.includes('transferencia') ? 'transferencia' : 'efectivo';
      const b = cB >= 0 ? normal(f[cB]) : '';
      const cuenta = ['bankinter', 'bbva', 'santander', 'ing', 'revolut', 'n26'].find(x => b.includes(x)) || (b.includes('caixa') ? 'caixabank' : 'efectivo');
      const categoria = cC >= 0 && f[cC] ? String(f[cC]).trim() : categoriaConAprendizaje(descripcion, tipo, reglas);
      txs.push({ fecha, descripcion: descripcion.startsWith('[Efectivo]') ? descripcion : '[Efectivo] ' + descripcion, importe: Math.abs(bruto), tipo, categoria, medio, cuenta });
    }
    return { tipo: 'efectivo', banco: 'efectivo', txs };
  }

  if (banco.endsWith('_tarjeta')) {
    const cF = col('fecha', 'date'), cD = col('comercio', 'concepto', 'descripci', 'establec'), cI = col('importe', 'amount');
    const cCargo = h.findIndex(c => c === 'cargo' || c.includes('debito')), cAbono = h.findIndex(c => c === 'abono' || c.includes('credito'));
    for (const f of filas.slice(inicio)) {
      if (f.every(c => !c)) continue;
      const fecha = parsearFecha(f[cF >= 0 ? cF : 0]), descripcion = String(f[cD >= 0 ? cD : 1] || '').trim();
      if (!fecha || !descripcion) continue;
      let bruto;
      if (cCargo >= 0 && cAbono >= 0) {
        const cargo = parsearImporte(f[cCargo]) || 0, abono = parsearImporte(f[cAbono]) || 0;
        bruto = abono > 0 ? abono : -cargo;
      } else bruto = parsearImporte(f[cI >= 0 ? cI : 2]);
      if (isNaN(bruto) || bruto === 0) continue;
      const tipo = bruto < 0 ? 'gasto' : 'ingreso';
      txs.push({ fecha, descripcion, importe: Math.abs(bruto), tipo, categoria: categoriaConAprendizaje(descripcion, tipo, reglas), medio: 'tarjeta', cuenta: banco });
    }
    return { tipo: 'tarjeta', banco, txs };
  }

  // Cuenta corriente
  const cF = col('fecha', /^date$/, /^data operacio$/, /^started date$/);
  const cD = col('concepto', 'descripci', 'payee', /^description$/);
  const cI = col('importe', /^amount( \(eur\))?$/, /^import$/);
  const cS = col(/^saldo/, /^disponible$/, /^balance$/);
  const saldos = []; // saldo tras cada movimiento, en el orden del archivo
  for (const f of filas.slice(inicio)) {
    if (f.every(c => !c)) continue;
    let fecha, descripcion, bruto;
    if (banco === 'bbva') {
      // F.Valor | Fecha | Concepto | Movimiento | Importe | Divisa | Disponible
      fecha = parsearFecha(f[1]);
      const concepto = String(f[2] || '').trim(), movimiento = String(f[3] || '').trim();
      descripcion = concepto && movimiento && movimiento !== concepto && movimiento.length > 3 ? `${concepto} - ${movimiento}` : concepto || movimiento;
      bruto = parsearImporte(f[4]);
    } else {
      fecha = parsearFecha(f[cF >= 0 ? cF : 0]);
      descripcion = String(f[cD >= 0 ? cD : 1] || '').trim();
      bruto = parsearImporte(f[cI >= 0 ? cI : 2]);
    }
    if (!fecha || !descripcion || isNaN(bruto) || bruto === 0) continue;
    if (banco === 'revolut' && String(f[8] || '').toLowerCase() !== 'completed') continue;
    const saldo = parsearImporte(banco === 'bbva' ? f[6] : cS >= 0 ? f[cS] : '');
    if (!isNaN(saldo)) saldos.push({ fecha, valor: saldo });
    txs.push(movimientoDeCuenta(fecha, descripcion, bruto, banco, reglas, hayTarjeta));
  }
  const numero = leerCuentaArchivo(filas, previa >= 0 ? previa : inicio - 1);
  return { tipo: 'cuenta', banco, txs, saldo: saldoFinal(saldos), retenidos: leerRetenidos(filas, previa, inicio - 1, banco, reglas), fin: numero?.fin || null, entidad: numero?.entidad || null };
}

// Un movimiento de la cuenta. El cargo agrupado de la tarjeta solo se compensa si también se importan sus compras;
// un «recobro» siempre es gasto.
function movimientoDeCuenta(fecha, descripcion, bruto, banco, reglas, hayTarjeta) {
  const d = normal(descripcion);
  const esLiq = hayTarjeta && /liquidacion tarjeta|tarjeta credito|pago tarjeta|recibo tarjeta|recibo visa|visa clasica/.test(d) && !/recobro/.test(d);
  const tipo = esLiq ? 'liquidacion_tarjeta' : bruto < 0 ? 'gasto' : 'ingreso';
  return { fecha, descripcion, importe: Math.abs(bruto), tipo, categoria: esLiq ? '💳 Liquidación tarjeta' : categoriaConAprendizaje(descripcion, tipo, reglas), medio: medioAutomatico(descripcion, tipo), cuenta: banco };
}

// ─── CUALQUIER BANCO: FORMATO DEL ARCHIVO ───
// Un formato dice qué columna es cada cosa: { cabecera (fila de los títulos, -1 si no hay), fecha, concepto, importe,
// cargo, abono, saldo, tipo (columna que dice si es cargo o abono), invertir (los gastos vienen sin signo menos), banco
// (si se reconoció el banco antes de elegir las columnas; si no, 'generico') }.
// Las columnas que no hay valen -1. Con «importe» el signo dice si es gasto; con «cargo» y «abono», la columna.
const PALABRAS = {
  fecha: /fecha|date|^data|f\.? ?oper|f\.? ?cont|^dia$/,
  concepto: /concepto|descrip|detalle|movimiento|payee|texto|comercio|beneficiario|observ|referencia|narrat/,
  cargo: /cargo|debe$|^debe|debito|debit|gasto|salida|retirada|reintegro/,
  abono: /abono|haber|credito|credit|ingreso|entrada/,
  importe: /importe|amount|cantidad|^import|monto|euros|^valor$/,
  saldo: /saldo|balance|disponible/
};
const TIPOS_SIGNO = { gasto: /^(d|c|cargo|debe|debito|debit|gasto|salida|-)$/, ingreso: /^(h|a|abono|haber|credito|credit|ingreso|entrada|\+)$/ };

// Lo que identifica un formato de archivo, para recordarlo: sus títulos (o, sin títulos, cuántas columnas tiene)
export const firmaFormato = (filas, f) => f.cabecera >= 0 ? (filas[f.cabecera] || []).map(normal).join('|') : `sin-titulos:${(filas[filaDatos(filas, f)] || []).length}`;
const filaDatos = (filas, f) => f.cabecera + 1;

// Columnas del archivo para elegir: título y un ejemplo de lo que tiene
export function columnasArchivo(filas, f) {
  const datos = filas.slice(filaDatos(filas, f)).filter(r => r.some(c => String(c).trim())).slice(0, 30);
  const n = Math.max(0, ...datos.map(r => r.length), (filas[f.cabecera] || []).length);
  return Array.from({ length: n }, (_, j) => ({
    j, titulo: String((filas[f.cabecera] || [])[j] ?? '').trim(),
    ejemplo: String(datos.map(r => r[j]).find(v => String(v ?? '').trim() !== '') ?? '').trim()
  }));
}

// Propone el formato de un archivo desconocido: la fila de los títulos (la de encima de las primeras filas con fecha e
// importe) y cada columna por su título o, si no lo dice, por lo que contiene. `seguro`: si se ha reconocido todo por
// los títulos y se leen bien casi todas las filas (entonces no hace falta preguntar).
export function proponerFormato(filas) {
  const conDatos = i => { const r = filas[i] || []; return r.some(c => parsearFecha(c)) && r.some(c => !parsearFecha(c) && !isNaN(parsearImporte(c))); };
  let d = -1;
  for (let i = 0; i < Math.min(filas.length, 60) && d < 0; i++) if (conDatos(i) && (conDatos(i + 1) || conDatos(i + 2) || i === filas.length - 1)) d = i;
  if (d < 0) return null;
  // Títulos: la fila no vacía justo encima, si es de texto
  let cabecera = d - 1;
  while (cabecera >= 0 && !(filas[cabecera] || []).some(c => String(c).trim())) cabecera--;
  const titulos = cabecera >= 0 ? filas[cabecera] : [];
  if (cabecera >= 0 && (titulos.filter(c => String(c).trim()).length < 2 || titulos.some(c => parsearFecha(c) || (String(c).trim() && !isNaN(parsearImporte(c)))))) cabecera = -1;
  const f = { cabecera, fecha: -1, concepto: -1, importe: -1, cargo: -1, abono: -1, saldo: -1, tipo: -1, invertir: false };
  const datos = filas.slice(cabecera + 1).filter(r => r.some(c => parsearFecha(c))).slice(0, 60);
  const n = Math.max(...datos.map(r => r.length));
  const cols = Array.from({ length: n }, (_, j) => {
    const v = datos.map(r => r[j]).filter(x => String(x ?? '').trim() !== '');
    const frac = g => v.length ? v.filter(g).length / v.length : 0;
    return { j, titulo: cabecera >= 0 ? normal(titulos[j] ?? '') : '', lleno: v.length / (datos.length || 1),
      fecha: frac(x => parsearFecha(x)), numero: frac(x => !parsearFecha(x) && !isNaN(parsearImporte(x))),
      texto: v.reduce((s, x) => s + String(x).length, 0) / (v.length || 1), signo: v.length && v.every(x => TIPOS_SIGNO.gasto.test(normal(x)) || TIPOS_SIGNO.ingreso.test(normal(x))) };
  });
  const usadas = () => [f.fecha, f.concepto, f.importe, f.cargo, f.abono, f.saldo, f.tipo];
  const porTitulo = (campo, valida) => cols.find(c => PALABRAS[campo].test(c.titulo) && valida(c) && !usadas().includes(c.j));
  const numerica = c => c.numero >= 0.8, numericaHueca = c => c.numero >= 0.8 && c.lleno > 0;
  // Fecha: la de operación antes que la de valor
  const fechas = cols.filter(c => c.fecha >= 0.8);
  const fechaT = fechas.find(c => PALABRAS.fecha.test(c.titulo) && !/valor/.test(c.titulo)) || fechas.find(c => PALABRAS.fecha.test(c.titulo));
  f.fecha = (fechaT || fechas[0] || { j: -1 }).j;
  const porTitulos = { fecha: !!fechaT };
  f.saldo = (porTitulo('saldo', numerica) || { j: -1 }).j;
  const cargo = porTitulo('cargo', numericaHueca), abono = cargo && porTitulo('abono', c => numericaHueca(c) && c.j !== cargo.j);
  if (cargo && abono) { f.cargo = cargo.j; f.abono = abono.j; porTitulos.importe = true; }
  else {
    const imp = porTitulo('importe', numerica);
    porTitulos.importe = !!imp;
    // Sin título: la primera columna de números que no sea el saldo (si hay dos y ninguna dice «saldo», la última lo es)
    const libres = cols.filter(c => numerica(c) && c.j !== f.fecha && c.j !== f.saldo);
    f.importe = (imp || libres[0] || { j: -1 }).j;
    // El saldo suele ser la última columna de números, detrás del importe
    const despues = libres.filter(c => c.j > f.importe);
    if (f.saldo < 0 && despues.length) f.saldo = despues[despues.length - 1].j;
    f.tipo = (cols.find(c => c.signo && c.j !== f.importe) || { j: -1 }).j;
  }
  const textos = cols.filter(c => c.j !== f.fecha && c.numero < 0.5 && c.fecha < 0.5 && !c.signo);
  const conceptoT = textos.find(c => PALABRAS.concepto.test(c.titulo));
  f.concepto = (conceptoT || [...textos].sort((a, b) => b.texto - a.texto)[0] || { j: -1 }).j;
  porTitulos.concepto = !!conceptoT;
  // Todos los importes en positivo y nada que diga cuáles son gastos: no se puede saber, hay que preguntar
  const lectura = leerConFormato(filas, f, { reglas: {} });
  const ambiguo = f.importe >= 0 && f.tipo < 0 && lectura.txs.length > 1 && lectura.txs.every(t => t.tipo === 'ingreso');
  f.seguro = porTitulos.fecha && porTitulos.concepto && porTitulos.importe && !ambiguo && lectura.txs.length > 0 && lectura.malas <= lectura.txs.length * 0.2;
  return f;
}

// Lee los movimientos de una cuenta con un formato. `malas`: filas con fecha que no se han podido leer.
export function leerConFormato(filas, f, { reglas, hayTarjeta = false }) {
  const txs = [], saldos = [];
  let malas = 0;
  const num = x => { const v = parsearImporte(x); return isNaN(v) ? 0 : v; };
  for (const r of filas.slice(filaDatos(filas, f))) {
    if (!r.some(c => String(c ?? '').trim())) continue;
    const fecha = parsearFecha(r[f.fecha]);
    if (!fecha) continue;
    const descripcion = String(r[f.concepto] ?? '').trim();
    let bruto;
    if (f.cargo >= 0 || f.abono >= 0) {
      const abono = Math.abs(num(r[f.abono])), cargo = Math.abs(num(r[f.cargo]));
      bruto = abono ? abono : -cargo;
    } else {
      bruto = parsearImporte(r[f.importe]);
      if (f.tipo >= 0) { const t = normal(r[f.tipo]); if (TIPOS_SIGNO.gasto.test(t)) bruto = -Math.abs(bruto); else if (TIPOS_SIGNO.ingreso.test(t)) bruto = Math.abs(bruto); }
      if (f.invertir) bruto = -bruto;
    }
    if (!descripcion || isNaN(bruto) || bruto === 0) { malas++; continue; }
    const saldo = f.saldo >= 0 ? parsearImporte(r[f.saldo]) : NaN;
    if (!isNaN(saldo)) saldos.push({ fecha, valor: saldo });
    txs.push(movimientoDeCuenta(fecha, descripcion, bruto, f.banco || 'generico', reglas, hayTarjeta));
  }
  const numero = leerCuentaArchivo(filas, Math.max(f.cabecera, filaDatos(filas, f) - 1));
  return { tipo: 'cuenta', banco: f.banco || 'generico', txs, saldo: saldoFinal(saldos), retenidos: [], fin: numero?.fin || null, entidad: numero?.entidad || null, formato: f, malas };
}

// Formatos elegidos a mano, por su firma. Se guardan en la base de datos (pj_formatos_extracto); sin esa tabla, en este
// dispositivo (localStorage)
export const formatoParaGuardar = f => { const { seguro, ...limpio } = f; return limpio; };
const CLAVE_FORMATOS = 'pj_formatos_extracto';
export const formatosLocales = () => { try { return JSON.parse(localStorage.getItem(CLAVE_FORMATOS)) || {}; } catch { return {}; } };
export function guardarFormatoLocal(firma, f) {
  try { localStorage.setItem(CLAVE_FORMATOS, JSON.stringify({ ...formatosLocales(), [firma]: formatoParaGuardar(f) })); return true; } catch { return false; }
}
// Busca en el archivo la fila de títulos de un formato recordado
function formatoRecordado(filas, guardados) {
  if (!Object.keys(guardados).length) return null;
  for (let i = 0; i < Math.min(filas.length, 60); i++) {
    const g = guardados[(filas[i] || []).map(normal).join('|')];
    if (g && g.cabecera >= 0) return { ...g, cabecera: i };
  }
  const p = proponerFormato(filas);
  const g = p && p.cabecera < 0 && guardados[firmaFormato(filas, p)];
  return g ? { ...g, cabecera: p.cabecera } : null;
}

// Saldo tras el último movimiento. Los bancos ordenan el archivo de más nuevo a más antiguo o al revés:
// se mira qué punta tiene la fecha más reciente y, dentro de ese día, se coge el movimiento de esa punta.
function saldoFinal(saldos) {
  if (!saldos.length) return null;
  const descendente = saldos[0].fecha >= saldos[saldos.length - 1].fecha;
  return descendente ? saldos[0] : saldos[saldos.length - 1];
}
