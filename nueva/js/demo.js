// Datos de ejemplo del modo demo: los 6 últimos meses de una persona estudiante. No se guardan en ningún sitio.

import { mesActual, sumarMeses, diasDelMes, hoyISO, ultimaFechaFijo } from './logica.js';

// Generador pseudoaleatorio con semilla, para que la demo salga siempre igual
function aleatorio(semilla) {
  return () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
}

const GASTOS = [
  ['🍔 Comida', 'tarjeta', [['Mercadona', 18, 34, 4], ['Lidl', 11, 24, 2], ['Bar La Plaza', 6, 14, 3], ['100 Montaditos', 8, 15, 1], ['Telepizza', 12, 19, 1]]],
  ['🎉 Ocio', 'tarjeta', [['Cines Yelmo', 8.9, 8.9, 1], ['Sala Apolo', 14, 20, 1], ['Fourvenues entradas', 18, 30, 1]]],
  ['⛽ Gasolina', 'tarjeta', [['Repsol', 25, 35, 1], ['Petroprix', 24, 30, 1]]],
  ['👕 Ropa', 'tarjeta', [['Zara', 25, 45, 1], ['Primark', 9, 18, 1]]],
  ['🏋️ Deporte', 'tarjeta', [['Rocódromo Sputnik', 35, 35, 1]]],
  ['🚇 Transporte', 'tarjeta', [['Renfe Cercanías', 10, 10, 1], ['Recarga Metro', 12, 20, 1]]],
  ['📦 Suscripciones', 'transferencia', [['Spotify', 10.99, 10.99, 1], ['Netflix', 12.99, 12.99, 1]]],
  ['💊 Salud', 'tarjeta', [['Farmacia Centro', 5, 14, 1]]]
];

export function datosDemo() {
  const r = aleatorio(42);
  const hoy = hoyISO();
  const actual = mesActual();
  const txs = [];
  let id = 1;
  const mov = (fecha, descripcion, importe, tipo, categoria, medio = 'tarjeta') => {
    if (fecha <= hoy) txs.push({ id: 'demo' + id++, fecha, descripcion, importe: Math.round(importe * 100) / 100, tipo, categoria, medio, cuenta: 'bankinter', paso: null });
  };
  for (let i = 5; i >= 0; i--) {
    const ym = sumarMeses(actual, -i);
    const dias = diasDelMes(ym);
    const dia = n => `${ym}-${String(Math.min(n, dias)).padStart(2, '0')}`;
    const anterior = sumarMeses(ym, -1);
    // La mensualidad llega a final del mes anterior; desde hace 2 meses incluye la parte del alquiler que se reenvía
    const paso = i <= 1;
    mov(`${anterior}-${String(diasDelMes(anterior) - 1).padStart(2, '0')}`, 'Transferencia de casa', paso ? 470 : 350, 'ingreso', '💰 Mensualidad', 'transferencia');
    if (paso) mov(dia(2), 'Bizum alquiler compañero', 120, 'gasto', '↩️ Reenviado', 'bizum');
    mov(dia(20), 'Transferencia Bar La Esquina', i === 4 ? 420 : 320, 'ingreso', '💰 Nómina', 'transferencia');
    // Los Bizum de meses pasados ya tienen categoría; los de este mes están por clasificar
    mov(dia(6 + Math.floor(r() * 5)), 'Bizum de Marta', 12.5 + Math.round(r() * 30), 'ingreso', i ? '🤝 Devolución' : '📱 Bizum recibido', 'bizum');
    mov(dia(17 + Math.floor(r() * 5)), 'Bizum de Pablo', 8 + Math.round(r() * 25), 'ingreso', i ? '🎁 Regalo recibido' : '📱 Bizum recibido', 'bizum');
    mov(dia(12 + Math.floor(r() * 5)), 'Bizum a Lucía', 6 + Math.round(r() * 12), 'gasto', i ? '🍔 Comida' : '📱 Bizum enviado', 'bizum');
    for (const [categoria, medio, comercios] of GASTOS) {
      for (const [nombre, min, max, veces] of comercios) {
        const n = categoria === '🎉 Ocio' && i === 4 ? veces + 2 : veces; // en verano, más ocio
        for (let k = 0; k < n; k++) mov(dia(1 + Math.floor(r() * dias)), nombre, min + r() * (max - min), 'gasto', categoria, medio);
      }
    }
    // Lo que pagan quienes van en su coche por BlaBlaCar (sin usar el generador, para no cambiar el resto de la demo)
    const blabla = [18, 22.5, 0, 31, 16, 24][i];
    if (blabla) mov(dia(14), 'TRANSF BLABLACAR COMUTO SA', blabla, 'ingreso', '🚗 Coche compartido', 'transferencia');
  }
  // Tres movimientos que la app no ha sabido clasificar
  [['TPV 8834 ZARAGOZA', 15, -1], ['PAYPAL *STEAMGAMES', 9.99, -2], ['COMPRA 4471 MADRID', 6.5, -4]]
    .forEach(([d, imp, off]) => mov(hoyISO(off), d, imp, 'gasto', '🔧 Otros'));
  // Dos pagos que el banco aún tiene retenidos
  txs.push({ id: 'demo-r1', fecha: hoyISO(0), descripcion: 'REPSOL VALENCIA', importe: 40, tipo: 'gasto', categoria: '⛽ Gasolina', medio: 'tarjeta', cuenta: 'bankinter', pendiente: true });
  txs.push({ id: 'demo-r2', fecha: hoyISO(-1), descripcion: 'AMAZON EU', importe: 23.99, tipo: 'gasto', categoria: '🔧 Otros', medio: 'tarjeta', cuenta: 'bankinter', pendiente: true });
  txs.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const desde = sumarMeses(actual, -5);
  const presupuestos = [['🍔 Comida', 180], ['🎉 Ocio', 80], ['⛽ Gasolina', 70], ['👕 Ropa', 50], ['🚇 Transporte', 40], ['📦 Suscripciones', 25]]
    .map(([categoria, limite], k) => ({ id: 'p' + k, categoria, limite, mes: desde }));
  const metas = [
    { id: 'm1', nombre: 'Viaje a Lisboa', emoji: '✈️', objetivo: 600, ahorrado: 410, fecha_limite: hoyISO(112) },
    { id: 'm2', nombre: 'Portátil nuevo', emoji: '💻', objetivo: 900, ahorrado: 260, fecha_limite: null },
    { id: 'm3', nombre: 'Colchón para imprevistos', emoji: '🛟', objetivo: 1000, ahorrado: 520, fecha_limite: null }
  ];
  const cuentas = [
    { id: 'c1', nombre: 'Bankinter', tipo: 'banco', clave: 'bankinter', saldo: 1234.56, fecha_saldo: hoyISO(-4), principal: false },
    { id: 'c2', nombre: 'Efectivo ahorrado', tipo: 'efectivo', clave: null, saldo: 600, fecha_saldo: hoyISO(-10), principal: false }
  ];
  // Lo que le llega cada mes: ya están los de este mes, así que la demo no crea previstos al abrirse
  const fijos = [
    { id: 'f1', nombre: 'Transferencia de casa', tipo: 'ingreso', categoria: '💰 Mensualidad', importe: 470, dia: 29, medio: 'transferencia', activo: true },
    { id: 'f2', nombre: 'Nómina Bar La Esquina', tipo: 'ingreso', categoria: '💰 Nómina', importe: 320, dia: 20, medio: 'transferencia', activo: true }
  ].map(f => ({ ...f, ultimo: ultimaFechaFijo(f) }));
  return { txs, presupuestos, metas, reglas: {}, cuentas, fijos, conRetenidos: true, conPaso: true };
}
