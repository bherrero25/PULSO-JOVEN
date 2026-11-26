// Cálculos puros de la app nueva (nueva/js/logica.js e importar.js), sin navegador: node pruebas/prueba_logica.mjs
import assert from 'node:assert/strict';
globalThis.XLSX = {}; // importar.js lo usa solo al leer archivos
const L = await import('../nueva/js/logica.js');
const { leerCuentaArchivo } = await import('../nueva/js/importar.js');

let bien = 0; const fallos = [];
const prueba = (que, f) => { try { f(); bien++; } catch (e) { fallos.push(`${que}: ${e.message.split('\n')[0]}`); } };
const m = (fecha, importe, tipo, categoria, extra = {}) => ({ fecha, importe, tipo, categoria, descripcion: 'x', ...extra });

// ── Dinero de paso: lo que llega y lo que sale se compensan cada mes ──
const base = [m('2026-11-01', 470, 'ingreso', '💰 Mensualidad'), m('2026-11-05', 100, 'gasto', '🍔 Comida')];
prueba('paso: solo sale (alquiler dentro de la mensualidad) se resta de lo ingresado', () => {
  const r = L.resumenMes([...base, m('2026-11-02', 120, 'gasto', '↩️ Reenviado')], '2026-11');
  assert.equal(r.ingresado, 350); assert.equal(r.totalGastos, 100);
});
prueba('paso: llega y sale lo mismo, no cambia nada', () => {
  const r = L.resumenMes([...base, m('2026-11-10', 60, 'ingreso', '↩️ Reenviado'), m('2026-11-11', 60, 'gasto', '↩️ Reenviado')], '2026-11');
  assert.equal(r.ingresado, 470); assert.equal(r.queda, 370);
});
prueba('paso: llega el 29 y sale el 2, los dos cuentan para el mes siguiente', () => {
  const txs = [...base, m('2026-11-29', 80, 'ingreso', '↩️ Reenviado'), m('2026-12-02', 80, 'gasto', '↩️ Reenviado')];
  assert.equal(L.resumenMes(txs, '2026-11').totalPaso, 0); assert.equal(L.resumenMes(txs, '2026-12').totalPaso, 0);
});
prueba('traspaso: no cuenta como ingreso ni gasto', () => {
  const r = L.resumenMes([...base, m('2026-11-03', 200, 'ingreso', '🔄 Traspaso'), m('2026-11-04', 50, 'gasto', '🔄 Traspaso')], '2026-11');
  assert.equal(r.ingresado, 470); assert.equal(r.totalGastos, 100);
});

// ── Categorías automáticas ──
prueba('BlaBlaCar: cobrar es coche compartido, pagar un viaje es transporte', () => {
  assert.equal(L.categoriaAutomatica('TRANSF INM /BLABLACAR COMUTO SA', 'ingreso'), '🚗 Coche compartido');
  assert.equal(L.categoriaAutomatica('BLABLACAR VIAJE MADRID', 'gasto'), '🚇 Transporte');
});
prueba('Bizum: la categoría automática es la genérica (por revisar)', () => {
  assert.equal(L.categoriaAutomatica('BIZUM DE ANA', 'ingreso'), '📱 Bizum recibido');
  assert.ok(L.porRevisar({ tipo: 'ingreso', categoria: '📱 Bizum recibido', descripcion: 'BIZUM DE ANA' }, {}));
});

// ── Juntar lo apuntado con el extracto ──
const banco = (imp, cat = '💰 Mensualidad') => ({ fecha: '2026-11-26', descripcion: 'TRANSF INM /JUAN', importe: imp, tipo: 'ingreso', categoria: cat, cuenta: 'banco1', medio: 'transferencia' });
const manual = { id: 'm', fecha: '2026-11-25', descripcion: 'Papá', importe: 200, tipo: 'ingreso', categoria: '↩️ Reenviado', cuenta: 'manual', medio: 'transferencia' };
const previsto = { id: 'p', fecha: '2026-11-25', descripcion: 'Mensualidad', importe: 220, tipo: 'ingreso', categoria: '💰 Mensualidad', cuenta: 'previsto' };
prueba('juntar: el importe exacto gana a un previsto de importe parecido', () => {
  const r = L.emparejarApuntados([banco(200), banco(220)], [manual, previsto], [banco(200), banco(220)]);
  assert.deepEqual(r.pares.map(p => `${p.guardado.id}:${p.banco.importe}:${p.seguro}`).sort(), ['m:200:true', 'p:220:true']);
});
prueba('juntar: un previsto acepta otro importe con la misma categoría (±20 %)', () => {
  const r = L.emparejarApuntados([banco(480)], [{ ...previsto, importe: 470 }], [banco(480)]);
  assert.equal(r.pares.length, 1); assert.ok(r.pares[0].seguro);
});
prueba('juntar: un previsto no se junta con un importe muy distinto', () => {
  assert.equal(L.emparejarApuntados([banco(100)], [{ ...previsto, importe: 470 }], [banco(100)]).pares.length, 0);
});
prueba('juntar: lo de Apple Pay se junta y es seguro', () => {
  const ap = { id: 'a', fecha: '2026-11-25', descripcion: 'CAFE', importe: 0.9, tipo: 'gasto', cuenta: 'apple_pay', medio: 'tarjeta' };
  const b = { fecha: '2026-11-25', descripcion: 'CAFETERIA', importe: 0.9, tipo: 'gasto', cuenta: 'banco1', pendiente: true };
  const r = L.emparejarApuntados([b], [ap], [b]);
  assert.equal(r.pares.length, 1); assert.ok(r.pares[0].applePay && r.pares[0].seguro);
});
prueba('juntar: lo apuntado para otra cuenta no se junta con este extracto', () => {
  const otra = { ...manual, cuenta: 'manual:banco2' };
  assert.equal(L.emparejarApuntados([banco(200)], [otra], [banco(200)]).pares.length, 0);
});

// ── Varias cuentas ──
const movs = [{ fecha: '2026-11-10', descripcion: 'MERCADONA', importe: 20 }, { fecha: '2026-11-20', descripcion: 'NOMINA', importe: 900 }];
const c = (clave, nombre, fecha_saldo = '2026-11-01', extra = {}) => ({ id: clave, clave, nombre, fecha_saldo, ...extra });
prueba('cuentas: sin cuentas y con número, cuenta nueva con el nombre del banco', () => {
  const r = L.cuentaParaExtracto([], [], { banco: 'bankinter', fin: '1234', movs });
  assert.equal(r.clave, 'bankinter·1234'); assert.ok(r.nueva); assert.equal(r.nombre, 'Bankinter');
});
prueba('cuentas: la antigua adopta el número si sus movimientos coinciden (sin preguntar)', () => {
  const r = L.cuentaParaExtracto([c('bankinter', 'Bankinter')], [{ cuenta: 'bankinter', fecha: '2026-11-10', descripcion: 'MERCADONA', importe: 20 }], { banco: 'bankinter', fin: '1234', movs });
  assert.equal(r.adoptar, 'bankinter·1234'); assert.ok(!r.preguntar);
});
prueba('cuentas: si la antigua no coincide, propone una nueva y pregunta', () => {
  const r = L.cuentaParaExtracto([c('bankinter', 'Bankinter')], [{ cuenta: 'bankinter', fecha: '2026-11-12', descripcion: 'ZARA', importe: 30 }], { banco: 'bankinter', fin: '1234', movs });
  assert.ok(r.nueva && r.preguntar);
});
prueba('cuentas: sin número y con dos cuentas del banco, pregunta (y propone la principal)', () => {
  const r = L.cuentaParaExtracto([c('bbva', 'BBVA', '2026-11-20'), c('bbva·2', 'Ahorro', '2026-11-22', { principal: true })], [], { banco: 'bbva', fin: null, movs });
  assert.ok(r.preguntar); assert.equal(r.clave, 'bbva·2');
});
prueba('principal: la elegida; si no hay, la más antigua, aunque otra tenga el extracto más reciente', () => {
  const vieja = c('bankinter·1234', 'Nómina', '2026-11-01', { creada: '2026-09-01' }), nueva = c('bankinter·5678', 'Ahorro', '2026-11-25', { creada: '2026-11-20' });
  assert.equal(L.cuentaPrincipal([nueva, vieja]).clave, 'bankinter·1234');
  assert.equal(L.cuentaPrincipal([vieja, { ...nueva, principal: true }]).clave, 'bankinter·5678');
  assert.equal(L.cuentaPrincipal([{ clave: null, nombre: 'Efectivo' }]), null);
});
prueba('cuentas: una cuenta añadida a mano se reconoce por su número aunque el archivo sea de otro formato', () => {
  const r = L.cuentaParaExtracto([c('bankinter·1234', 'Nómina'), c('bbva·5678', 'Cuenta joven')], [], { banco: 'generico', fin: '5678', entidad: '0182', movs });
  assert.equal(r.clave, 'bbva·5678'); assert.ok(!r.nueva && !r.preguntar);
});
prueba('cuentas: archivo sin número de un banco sin cuentas, con una añadida a mano sin extracto: pregunta y la propone', () => {
  const txs = [{ cuenta: 'bankinter·1234', fecha: '2026-11-02', descripcion: 'X', importe: 1 }];
  const r = L.cuentaParaExtracto([c('bankinter·1234', 'Nómina'), c('bbva·5678', 'Cuenta joven')], txs, { banco: 'santander', fin: null, movs });
  assert.ok(r.preguntar); assert.equal(r.clave, 'bbva·5678');
  assert.deepEqual(r.opciones.map(o => o.clave), ['bbva·5678']);
});
prueba('cuentas: otro número con una cuenta sin extracto: propone una nueva pero pregunta', () => {
  const r = L.cuentaParaExtracto([c('bbva·5678', 'Cuenta joven')], [], { banco: 'bbva', fin: '9999', movs });
  assert.ok(r.nueva && r.preguntar); assert.ok(r.opciones.some(o => o.clave === 'bbva·5678'));
});
prueba('cuentas: banco desconocido toma el nombre de la entidad del IBAN', () => {
  assert.equal(L.cuentaParaExtracto([], [], { banco: 'generico', fin: '9876', entidad: '1465', movs }).nombre, 'ING');
});
prueba('cuentas: traspaso detectado entre cuentas propias, no con pagos con tarjeta', () => {
  const nuevos = [{ fecha: '2026-11-20', importe: 200, tipo: 'gasto', medio: 'transferencia' }, { fecha: '2026-11-21', importe: 15, tipo: 'gasto', medio: 'tarjeta' }];
  const guardados = [{ cuenta: 'bbva·2', fecha: '2026-11-21', importe: 200, tipo: 'ingreso' }, { cuenta: 'bbva·2', fecha: '2026-11-21', importe: 15, tipo: 'ingreso' }];
  const r = L.detectarTraspasos(nuevos, guardados, 'bankinter', new Set(['bankinter', 'bbva·2']));
  assert.equal(r.pares.length, 1); assert.equal(r.pares[0].nuevo.importe, 200);
});
prueba('cuentas: número de cuenta en el extracto (IBAN, con asteriscos o de 20 cifras)', () => {
  assert.deepEqual(leerCuentaArchivo([['Cuenta', 'ES12 0128 0091 2345 6789 1234']], 1), { fin: '1234', entidad: '0128' });
  assert.equal(leerCuentaArchivo([['Número de cuenta', 'ES12 **** **** **** **** 5678']], 1).fin, '5678');
  assert.equal(leerCuentaArchivo([['Cuenta: 0182-1234-56-0201234567']], 1).fin, '4567');
  assert.equal(leerCuentaArchivo([['Saldo', '1.234,56'], ['Fecha', '25/11/2026']], 2), null);
});

// ── «Tu dinero» ──
prueba('tu dinero: saldo − retenido + lo apuntado después (no el efectivo, ni lo previsto, ni lo antiguo)', () => {
  const cuentas = [{ id: 'b', clave: 'banco1', saldo: 1000, fecha_saldo: '2026-11-20' }, { id: 'e', clave: null, saldo: 600, fecha_saldo: '2026-11-15' }];
  const txs = [manual, previsto, { fecha: '2026-11-22', importe: 30, tipo: 'gasto', cuenta: 'apple_pay' }, { fecha: '2026-11-21', importe: 10, tipo: 'gasto', cuenta: 'banco1', pendiente: true },
    { fecha: '2026-11-24', importe: 5, tipo: 'gasto', cuenta: 'efectivo' }, { fecha: '2026-11-01', importe: 50, tipo: 'gasto', cuenta: 'manual' }];
  const s = L.saldoDisponible(cuentas[0], txs, cuentas);
  assert.deepEqual([s.retenido, s.apuntado, s.disponible], [10, 170, 1160]);
  assert.equal(L.totalCuentas(cuentas, txs), 1760);
});

// ── Movimientos fijos ──
const fijo = { nombre: 'Mensualidad', tipo: 'ingreso', categoria: '💰 Mensualidad', importe: 470, dia: 31 };
prueba('fijos: un fijo nuevo empieza desde la próxima vez', () => assert.equal(L.previstosPendientes([fijo], '2026-11-25').length, 0));
prueba('fijos: el día 31 en noviembre es el 30', () => assert.deepEqual(L.previstosPendientes([{ ...fijo, ultimo: '2026-10-31' }], '2026-11-30').map(x => x.fecha), ['2026-11-30']));
prueba('fijos: crea los meses que faltan', () => assert.equal(L.previstosPendientes([{ ...fijo, ultimo: '2026-07-31' }], '2026-12-02').length, 4));
prueba('fijos: uno inactivo no crea nada', () => assert.equal(L.previstosPendientes([{ ...fijo, ultimo: '2026-07-31', activo: false }], '2026-12-02').length, 0));

// ── Nombres limpios y forma de pago ──
const limpio = (descripcion, tipo = 'gasto', cuenta = 'bankinter') => L.nombreLimpio({ descripcion, tipo, cuenta });
prueba('nombres: quita «COMPRA TARJ.», el número de tarjeta y la ciudad de una marca conocida', () => assert.equal(limpio('COMPRA TARJ. 5402XXXXXXXX1234 MERCADONA VALENCIA'), 'Mercadona'));
prueba('nombres: marcas detrás de pasarelas y referencias', () => {
  assert.equal(limpio('COMPRA EN AMZN Mktp ES*AB12CD34E'), 'Amazon');
  assert.equal(limpio('PAYPAL *STEAMGAMES'), 'Steam (PayPal)');
  assert.equal(limpio('SUMUP *BAR PEPE'), 'Bar Pepe');
  assert.equal(limpio('RECIBO NETFLIX.COM'), 'Netflix');
  assert.equal(limpio('100 MONTADITOS VALENCIA'), '100 Montaditos');
});
prueba('nombres: transferencias y Bizum dicen de quién o a quién, con tildes', () => {
  assert.equal(limpio('TRANSF INM /JOSE MARTINEZ PEREZ', 'ingreso'), 'Transferencia de José Martínez Pérez');
  assert.equal(limpio('TRANSFERENCIA A FAVOR DE ANA MARTINEZ'), 'Transferencia a Ana Martínez');
  assert.equal(limpio('BIZUM DE LUCIA GARCIA', 'ingreso'), 'Bizum de Lucía García');
  assert.equal(limpio('PAGO BIZUM A LUCIA'), 'Bizum a Lucía');
});
prueba('nombres: los nombres que empiezan por A y «desde» no pierden letras', () => {
  assert.equal(limpio('BIZUM ANA GARCIA', 'ingreso'), 'Bizum de Ana García');
  assert.equal(limpio('TRANSFERENCIA ANTONIO PEREZ', 'ingreso'), 'Transferencia de Antonio Pérez');
  assert.equal(limpio('TRASPASO DESDE CUENTA', 'ingreso'), 'Traspaso de Cuenta');
  assert.equal(limpio('TRASPASO AHORRO'), 'Traspaso a Ahorro');
  assert.equal(limpio('TRANSFERENCIA INMA GARCIA', 'ingreso'), 'Transferencia de Inma García');
  assert.equal(limpio('TRANSPORTES METROPOLITANOS'), 'Transportes Metropolitanos');
});
prueba('nombres: casos especiales y fechas', () => {
  assert.equal(limpio('REINTEGRO CAJERO 4B 14/11'), 'Retirada en cajero');
  assert.equal(limpio('LIQUIDACION TARJETA CREDITO', 'liquidacion_tarjeta'), 'Liquidación de la tarjeta');
  assert.equal(limpio('INGRESO EFECTIVO OFICINA 0123', 'ingreso'), 'Ingreso en efectivo');
  assert.equal(limpio('DEVOLUCION COMPRA ZARA', 'ingreso'), 'Devolución Zara');
  assert.equal(limpio('BAR PEPE 14/11/26'), 'Bar Pepe');
  assert.equal(limpio('CAFETERIA EL PUERTO'), 'Cafetería el Puerto');
});
prueba('nombres: lo escrito a mano, lo previsto y el efectivo no se tocan', () => {
  assert.equal(limpio('cena en mercadona', 'gasto', 'manual'), 'cena en mercadona');
  assert.equal(limpio('MENSUALIDAD', 'ingreso', 'previsto'), 'MENSUALIDAD');
  assert.equal(limpio('[Efectivo] Café', 'gasto', 'efectivo'), 'Café');
});
prueba('forma de pago: tarjeta, recibo, transferencia, Bizum, Apple Pay y efectivo', () => {
  assert.deepEqual([['COMPRA TARJ. 5402XXXX MERCADONA', 'gasto'], ['RECIBO NETFLIX.COM', 'gasto'], ['TRANSF INM /JUAN', 'ingreso'], ['BIZUM A ANA', 'gasto'],
    ['COMPRA APPLE PAY CAFETERIA', 'gasto'], ['REINTEGRO CAJERO', 'gasto'], ['MERCADONA', 'gasto'], ['INTERESES', 'ingreso']].map(([d, t]) => L.medioAutomatico(d, t)),
    ['tarjeta', 'recibo', 'transferencia', 'bizum', 'apple_pay', 'efectivo', 'tarjeta', 'transferencia']);
});
prueba('forma de pago: lo importado antes como «transferencia» se enseña con la forma correcta', () => {
  assert.equal(L.formaDePago({ descripcion: 'MERCADONA', tipo: 'gasto', medio: 'transferencia', cuenta: 'bankinter' }), 'Tarjeta');
  assert.equal(L.formaDePago({ descripcion: 'TRANSF A JUAN', tipo: 'gasto', medio: 'transferencia', cuenta: 'bankinter' }), 'Transferencia');
  assert.equal(L.formaDePago({ descripcion: 'Alquiler', tipo: 'gasto', medio: 'transferencia', cuenta: 'manual' }), 'Transferencia');
});

for (const f of fallos) console.log(`  ✗ ${f}`);
console.log(`${fallos.length ? '✗' : '✓'} Cálculos (logica.js): ${bien} comprobaciones bien, ${fallos.length} mal`);
process.exit(fallos.length ? 1 : 0);
