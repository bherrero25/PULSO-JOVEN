// Lectura de extractos (Excel o CSV) de cuenta, tarjeta o efectivo. Detecta el tipo de archivo y el banco solos.
// Solo está probado de verdad con Bankinter; el resto de formatos se reconocen por sus cabeceras.

import { categoriaConAprendizaje, medioAutomatico } from './logica.js';

export async function leerFilas(archivo) {
  const buf = await archivo.arrayBuffer();
  if (archivo.name.toLowerCase().endsWith('.csv')) {
    const texto = new TextDecoder('latin1').decode(buf);
    return texto.split('\n').map(l => l.split(';').map(c => c.trim().replace(/^"|"$/g, '')));
  }
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
}

const normal = c => String(c).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function parsearFecha(valor) {
  if (!valor) return null;
  const s = String(valor);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // 2026-09-25 (Revolut y otros)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); // 25/09/2026
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (typeof valor === 'number') return new Date((valor - 25569) * 86400 * 1000).toISOString().slice(0, 10); // número de serie de Excel
  return null;
}

// Importes como número de Excel o como texto («-1.234,56 €»)
function parsearImporte(valor) {
  if (typeof valor === 'number') return valor;
  let s = String(valor || '').replace(/[€\s]/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s.replace(/[^\d.\-]/g, ''));
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
    lista.push({ fecha, descripcion, importe: Math.abs(bruto), tipo, categoria: categoriaConAprendizaje(descripcion, tipo, reglas), medio: medioAutomatico(descripcion), cuenta: banco, pendiente: true });
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
      const compacto = s.replace(/[\s.-]/g, '');
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
export function analizarExtracto(filas, { reglas, hayTarjeta }) {
  const { inicio, cabecera, banco, previa } = buscarCabecera(filas);
  if (inicio < 0) return { error: 'No se ha encontrado la cabecera del archivo (Fecha, Concepto, Importe…).' };
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
    // El cargo agrupado de la tarjeta solo se compensa si también se importan sus compras; un «recobro» siempre es gasto
    const d = normal(descripcion);
    const esLiq = hayTarjeta && /liquidacion tarjeta|tarjeta credito|pago tarjeta|recibo tarjeta|recibo visa|visa clasica/.test(d) && !/recobro/.test(d);
    const tipo = esLiq ? 'liquidacion_tarjeta' : bruto < 0 ? 'gasto' : 'ingreso';
    txs.push({ fecha, descripcion, importe: Math.abs(bruto), tipo, categoria: esLiq ? '💳 Liquidación tarjeta' : categoriaConAprendizaje(descripcion, tipo, reglas), medio: medioAutomatico(descripcion), cuenta: banco });
  }
  const numero = leerCuentaArchivo(filas, previa >= 0 ? previa : inicio - 1);
  return { tipo: 'cuenta', banco, txs, saldo: saldoFinal(saldos), retenidos: leerRetenidos(filas, previa, inicio - 1, banco, reglas), fin: numero?.fin || null, entidad: numero?.entidad || null };
}

// Saldo tras el último movimiento. Los bancos ordenan el archivo de más nuevo a más antiguo o al revés:
// se mira qué punta tiene la fecha más reciente y, dentro de ese día, se coge el movimiento de esa punta.
function saldoFinal(saldos) {
  if (!saldos.length) return null;
  const descendente = saldos[0].fecha >= saldos[saldos.length - 1].fecha;
  return descendente ? saldos[0] : saldos[saldos.length - 1];
}
