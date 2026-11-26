"""Dinero de paso con propósito (Supabase simulado, el mes del ejemplo real): el alquiler que sale de la mensualidad resta;
lo que llega para el dentista y la luz se compensa con lo que sale para eso (y lo que pusiste de más resta); el dinero
del ordenador queda en espera y no suma ni a lo ingresado ni a la previsión; lo que llega sin decir para qué también
espera y se puede asignar después; al comprar el ordenador se elige de qué dinero sale; «Me lo quedo» pasa a ingreso lo
que sobra de un propósito (sin tocar «Tu dinero») y borrarlo lo devuelve a la espera. Sin la columna, no se pregunta."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, apuntar, euros, fila, hoy
import datetime

res = Resultado('Dinero de paso con propósito')
mes = hoy.strftime('%Y-%m')
d = lambda n: f'{mes}-{min(n, hoy.day, 25):02d}'  # dentro del mes (los 3 últimos días cuentan para el siguiente)
iso = lambda n: (hoy - datetime.timedelta(days=n)).isoformat()
anterior = (hoy.replace(day=1) - datetime.timedelta(days=1))
ingresado = lambda pg: euros(pg.inner_text('.tarjeta-tinta .dato:has-text("Ingresado") b'))
SECCION = 'section[aria-label="Dinero de paso"]'
grupo = lambda nombre: f'{SECCION} details:has(.concepto:text-is("{nombre}"))'
R = '↩️ Reenviado'


def datos(con_columna=True):
    extra = {'paso': None} if con_columna else {}
    P = lambda id, fecha, desc, imp, tipo, paso=None: fila(id=id, fecha=fecha, descripcion=desc, importe=imp, tipo=tipo, medio='transferencia', categoria=R, **({'paso': paso} if con_columna else {}))
    txs = [fila(id=1, fecha=anterior.replace(day=anterior.day - 1).isoformat(), descripcion='TRANSFERENCIA DE PAPA', importe=900, tipo='ingreso', medio='transferencia', categoria='💰 Mensualidad', **extra),
           P(2, d(2), 'BIZUM A MAMA ALQUILER', 400, 'gasto'),                       # el alquiler, de la mensualidad
           P(3, d(5), 'TRANSFERENCIA DE PAPA', 300, 'ingreso', 'Dentista y luz'),
           P(4, d(6), 'BIZUM A MAMA LUZ', 60, 'gasto', 'Dentista y luz'),
           P(5, d(8), 'CLINICA DENTAL', 290, 'gasto', 'Dentista y luz'),
           P(6, d(10), 'TRANSFERENCIA DE PAPA ORDENADOR', 1000, 'ingreso', 'Ordenador'),
           P(7, d(12), 'BIZUM DE MAMA', 345, 'ingreso')]                            # aún sin decir para qué
    txs += [fila(id=100 + n, fecha=iso(n), descripcion=f'SUPERMERCADO {n}', importe=10.0, categoria='🍔 Comida', **extra) for n in range(1, 40)]
    cuentas = [{'id': 'k1', 'user_id': 'u1', 'nombre': 'Bankinter', 'tipo': 'banco', 'clave': 'bankinter', 'saldo': 2500, 'fecha_saldo': iso(0)}]
    return txs, Supabase({'pj_transacciones': txs, 'pj_cuentas': cuentas, 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': [], 'pj_fijos': []})


with sync_playwright() as p:
    b = lanzar(p); errores = []
    txs, base = datos()
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.tarjeta-tinta')
    # 900 de mensualidad − 400 de alquiler − 50 que puso de su dinero en el dentista; el dinero del ordenador no cuenta
    comida = sum(t['importe'] for t in txs if t['categoria'] == '🍔 Comida' and t['fecha'][:7] == mes)
    res.comprobar(abs(ingresado(pg) - 450) < 0.005, 'lo ingresado no incluye el dinero de paso en espera (900 − 400 de alquiler − 50 puestos de su dinero)')
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(SECCION)
    res.comprobar('400,00 €' in pg.inner_text(grupo('De tu dinero')), 'el alquiler sale «De tu dinero» y resta')
    res.comprobar('50,00 € de tu dinero' in pg.inner_text(grupo('Dentista y luz')), 'en «Dentista y luz» resta solo lo que pusiste de tu dinero')
    res.comprobar('1.000,00 € en espera' in pg.inner_text(grupo('Ordenador')), 'el dinero del ordenador está en espera')
    res.comprobar('345,00 € en espera' in pg.inner_text(grupo('Sin decir para qué')), 'lo que llegó sin decir para qué también espera')
    res.comprobar('de dinero de paso en espera' in pg.inner_text('section[aria-label="¿Llegas a fin de mes?"]'), 'la previsión explica que lo que está en espera no cuenta')
    foto(pg, 'pp01_resumen')

    # Decir para qué era el Bizum de mamá: para el ordenador
    pg.click(f'{grupo("Sin decir para qué")} summary'); pg.click(f'{grupo("Sin decir para qué")} [data-accion="elegir-paso"]')
    pg.wait_for_selector('[data-accion="poner-paso"][data-paso="Ordenador"]')
    foto(pg, 'pp02_para_que', False)
    pg.click('[data-accion="poner-paso"][data-paso="Ordenador"]'); pg.wait_for_timeout(400)
    res.comprobar(next(t for t in txs if t['id'] == 7)['paso'] == 'Ordenador', 'se guarda para qué es')
    res.comprobar('1.345,00 € en espera' in pg.inner_text(grupo('Ordenador')), 'y se junta con el resto del dinero del ordenador')

    # Comprar el ordenador (1.300 €) con ese dinero: no resta; sobran 45 € en espera
    apuntar(pg, 'gasto', '1300', 'reenviado', d(25), 'tarjeta', 'Ordenador', url='http://pulso.prueba/nueva/#/anadir')
    pg.wait_for_selector('[data-accion="poner-paso"][data-paso="Ordenador"]')
    res.comprobar('1.345,00 € en espera' in pg.inner_text('.hoja-panel'), 'al comprar, ofrece el dinero del ordenador con lo que hay en espera')
    pg.click('[data-accion="poner-paso"][data-paso="Ordenador"]'); pg.wait_for_timeout(400)
    res.comprobar(abs(ingresado(pg) - 450) < 0.005, 'el ordenador pagado con su dinero de paso no cambia lo ingresado')
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(SECCION)
    res.comprobar('45,00 € en espera' in pg.inner_text(grupo('Ordenador')), 'lo que sobra sigue en espera')

    # Me lo quedo
    pg.click(f'{grupo("Ordenador")} summary'); pg.click(f'{grupo("Ordenador")} [data-accion="me-lo-quedo"]'); pg.wait_for_selector('#quedo-importe')
    res.comprobar(pg.input_value('#quedo-importe') == '45', 'propone quedarse lo que sobra de ese propósito')
    pg.fill('#quedo-importe', '60'); pg.click('[data-accion="guardar-me-lo-quedo"]'); pg.wait_for_timeout(200)
    res.comprobar('Como mucho' in pg.inner_text('#toast'), 'no deja quedarse más de lo que hay en espera')
    pg.fill('#quedo-importe', '45'); pg.click('[data-accion="guardar-me-lo-quedo"]'); pg.wait_for_timeout(500)
    quedo = [t for t in txs if t.get('cuenta') == 'liberado']
    res.comprobar(len(quedo) == 1 and quedo[0]['paso'] == 'Ordenador' and quedo[0]['categoria'] == '🎁 Regalo recibido', 'se guarda como ingreso que sale del dinero del ordenador')
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector('.tarjeta-tinta')
    res.comprobar(abs(ingresado(pg) - 495) < 0.005, 'los 45 € pasan a contar como ingreso')
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.wait_for_selector('#lista-movs')
    pg.click('#lista-movs .fila:has-text("Me lo quedo")'); pg.wait_for_selector('.hoja-panel'); pg.click('[data-accion="borrar-mov"]'); pg.click('#conf-si'); pg.wait_for_timeout(500)
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(SECCION)
    res.comprobar('45,00 € en espera' in pg.inner_text(grupo('Ordenador')), 'al borrar «Me lo quedo», vuelve a estar en espera')
    # En la hoja de un movimiento de paso se ve para qué es y se puede cambiar
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.wait_for_selector('#lista-movs')
    pg.fill('input[data-entrada="buscar"]', 'luz'); pg.wait_for_timeout(150); pg.click('#lista-movs .fila >> nth=0'); pg.wait_for_selector('.hoja-panel')
    res.comprobar('Para «Dentista y luz»' in pg.inner_text('.hoja-panel'), 'la hoja del movimiento dice para qué es')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    pg.close()

    # ── Sin la columna: no pregunta nada y lo que llega espera ──
    txs, base = datos(con_columna=False)
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(SECCION)
    res.comprobar(pg.locator('[data-accion="elegir-paso"]').count() == 0 and 'sql/2026-11-paso.sql' in pg.inner_text(SECCION), 'sin la columna no se puede decir para qué, y explica qué falta')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error (sin la columna)')
    b.close()

res.terminar(errores)
