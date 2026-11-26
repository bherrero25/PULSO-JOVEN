"""Efectivo apuntado a mano (Supabase simulado): un ingreso «en mano» no toca el banco y «metido en el banco» cuenta en
«Tu dinero» y al importar se junta con el «INGRESO EFECTIVO» del extracto sin repetirse; desde la hoja del movimiento se
puede cambiar dónde está. Lo que entra o sale en mano cambia la cuenta de efectivo de «Tu dinero»: sola si hay una,
preguntando si hay varias o si el movimiento es de antes del último saldo apuntado, y se deshace al borrarlo o pasarlo al banco."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, extracto, importar, apuntar, euros, iso, dmy, fila

res = Resultado('Ingresos en efectivo')
TU_DINERO = 'section[aria-label="Tu dinero"]'
banco = lambda pg: euros(pg.locator(f'{TU_DINERO} .lista-cuentas .fila:has-text("Bankinter") .importe').inner_text())


def apuntar_efectivo(pg, teclas, donde, concepto):
    pg.goto('http://pulso.prueba/nueva/#/anadir?tipo=ingreso&medio=efectivo'); pg.wait_for_selector('.teclado')
    res.comprobar(pg.is_visible('[data-accion="donde-nuevo"]'), f'{concepto}: un ingreso en efectivo pregunta dónde está el dinero')
    pg.click(f'[data-accion="donde-nuevo"][data-valor="{donde}"]')
    for k in teclas: pg.click(f'.teclado [data-valor="{k}"]')
    pg.click('[data-accion="cat-nuevo"][data-valor="reenviado"]')
    pg.fill('input[data-entrada="concepto-nuevo"]', concepto)
    pg.fill('input[data-entrada="fecha-nuevo"]', iso(1))
    if donde == 'banco': foto(pg, 'ef01_efectivo_al_banco', False)
    pg.click('[data-accion="guardar-nuevo"]'); pg.wait_for_selector('.saludo'); pg.wait_for_timeout(200)


with sync_playwright() as p:
    b = lanzar(p); errores = []
    txs = [fila(id=1, fecha=iso(8), descripcion='MERCADONA VALENCIA', importe=20.0, categoria='🍔 Comida')]
    cuentas = [{'id': 'k1', 'user_id': 'u1', 'nombre': 'Bankinter', 'tipo': 'banco', 'clave': 'bankinter', 'saldo': 300, 'fecha_saldo': iso(3)}]
    base = Supabase({'pj_transacciones': txs, 'pj_cuentas': cuentas, 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': [], 'pj_fijos': []})
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo')
    b0 = banco(pg)

    # Un gasto en efectivo no pregunta nada
    pg.goto('http://pulso.prueba/nueva/#/anadir?tipo=gasto&medio=efectivo'); pg.wait_for_selector('.teclado')
    res.comprobar(not pg.is_visible('[data-accion="donde-nuevo"]'), 'un gasto en efectivo no pregunta dónde está')

    apuntar_efectivo(pg, '50', 'banco', 'Ingreso de mamá en el cajero')
    t50 = next(t for t in txs if t['importe'] == 50)
    res.comprobar(t50['cuenta'] == 'manual' and t50['medio'] == 'efectivo', '«Lo he metido en el banco» se guarda en el banco, con forma de pago efectivo')
    res.comprobar(abs(banco(pg) - (b0 + 50)) < 0.005, 'y suma en el banco de «Tu dinero»')

    apuntar_efectivo(pg, '20', 'mano', 'Dinero de la abuela')
    t20 = next(t for t in txs if t['importe'] == 20 and t['tipo'] == 'ingreso')
    res.comprobar(t20['cuenta'] == 'efectivo' and abs(banco(pg) - (b0 + 50)) < 0.005, '«Lo tengo en mano» no toca el banco')
    res.comprobar('añade allí tu efectivo' in pg.inner_text('#toast'), 'sin cuenta de efectivo, sugiere añadirla en «Tu dinero»')

    # Cambiarlo después desde la hoja del movimiento
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.wait_for_selector('#lista-movs')
    pg.click('#lista-movs .fila:has-text("Dinero de la abuela")'); pg.wait_for_selector('select[data-cambio="donde-mov"]')
    pg.locator('select[data-cambio="donde-mov"]').scroll_into_view_if_needed(); foto(pg, 'ef02_donde_esta', False)
    pg.select_option('select[data-cambio="donde-mov"]', 'manual'); pg.wait_for_timeout(400)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    res.comprobar(t20['cuenta'] == 'manual', 'desde la hoja del movimiento se puede pasar al banco')
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector(TU_DINERO)
    res.comprobar(abs(banco(pg) - (b0 + 70)) < 0.005, 'y entonces también suma en «Tu dinero»')

    # Al importar el extracto, se juntan con los ingresos de efectivo del banco y no se repiten
    ext = extracto('efectivo', [(dmy(0), 'INGRESO EFECTIVO CAJERO 0123', 50, 370.0), (dmy(0), 'INGRESO EFECTIVO OFICINA', 20, 320.0), (dmy(8), 'MERCADONA VALENCIA', -20, 300.0)])
    importar(pg, ext)
    res.comprobar(pg.locator('input[data-cambio="par-unir"]:checked').count() == 2, 'al importar, los dos se juntan con su ingreso del banco')
    pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_timeout(900)
    ingresos = [t for t in txs if t['tipo'] == 'ingreso']
    res.comprobar(len(ingresos) == 2 and all(t['categoria'] == '↩️ Reenviado' and t['cuenta'] == 'bankinter' for t in ingresos), 'sin repetirse, y siguen siendo dinero de paso')
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector(TU_DINERO)
    res.comprobar(abs(banco(pg) - 370.0) < 0.005, '«Tu dinero» queda con el saldo del extracto')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    pg.close()

    # ── Con una cuenta de efectivo en «Tu dinero» ──
    txs = [fila(id=1, fecha=iso(8), descripcion='MERCADONA VALENCIA', importe=20.0, categoria='🍔 Comida')]
    cuentas = [{'id': 'k1', 'user_id': 'u1', 'nombre': 'Bankinter', 'tipo': 'banco', 'clave': 'bankinter', 'saldo': 300, 'fecha_saldo': iso(3)},
               {'id': 'k2', 'user_id': 'u1', 'nombre': 'Cartera', 'tipo': 'efectivo', 'clave': None, 'saldo': 40, 'fecha_saldo': iso(5)}]
    base = Supabase({'pj_transacciones': txs, 'pj_cuentas': cuentas, 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': [], 'pj_fijos': []})
    cartera = lambda: float(next(c for c in cuentas if c['id'] == 'k2')['saldo'])
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo')
    b0 = banco(pg)
    apuntar_efectivo(pg, '20', 'mano', 'Dinero de la abuela'); pg.wait_for_timeout(400)
    res.comprobar(cartera() == 60 and 'Cartera: 60,00' in pg.inner_text('#toast'), 'un ingreso en mano se suma solo a la cuenta de efectivo, y lo dice')
    res.comprobar(next(c for c in cuentas if c['id'] == 'k2')['fecha_saldo'] == iso(5), 'sin cambiar la fecha del último recuento')
    apuntar(pg, 'gasto', '5', 'comida', iso(1), 'efectivo', 'Bocadillo', url='http://pulso.prueba/nueva/#/anadir'); pg.wait_for_timeout(400)
    res.comprobar(cartera() == 55, 'un gasto pagado en efectivo se resta')
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.wait_for_selector('#lista-movs')
    pg.click('#lista-movs .fila:has-text("Bocadillo")'); pg.wait_for_selector('.hoja-panel')
    pg.click('[data-accion="borrar-mov"]'); pg.click('#conf-si'); pg.wait_for_selector('.hoja-panel [data-mantener]')
    res.comprobar('no se llegó a restar' in pg.inner_text('.hoja-panel') and cartera() == 55, 'al borrarlo, pregunta si devolverlo al efectivo (lo antiguo nunca se restó)')
    pg.click('.hoja-panel [data-accion="aplicar-traspaso"]'); pg.wait_for_timeout(400)
    res.comprobar(cartera() == 60, 'y si se elige la cuenta, vuelve a ella')
    pg.click('#lista-movs .fila:has-text("Dinero de la abuela")'); pg.wait_for_selector('select[data-cambio="donde-mov"]')
    pg.select_option('select[data-cambio="donde-mov"]', 'manual'); pg.wait_for_selector('.hoja-panel [data-mantener]')
    pg.click('.hoja-panel [data-accion="aplicar-traspaso"]'); pg.wait_for_timeout(400)
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector(TU_DINERO)
    res.comprobar(cartera() == 40 and abs(banco(pg) - (b0 + 20)) < 0.005, 'al pasarlo al banco (y confirmarlo), sale del efectivo y entra en el banco')
    # De antes del último recuento: pregunta (quizá ya contaba con él)
    apuntar(pg, 'gasto', '7', 'comida', iso(10), 'efectivo', 'Kebab', url='http://pulso.prueba/nueva/#/anadir'); pg.wait_for_selector('.hoja-panel [data-mantener]')
    res.comprobar('después de este movimiento' in pg.inner_text('.hoja-panel'), 'un gasto de antes del último recuento pregunta, y explica por qué')
    pg.click('.hoja-panel [data-accion="cerrar-hoja"]'); pg.wait_for_timeout(300)
    res.comprobar(cartera() == 40, '«No cambiar» lo deja como estaba')
    pg.close()

    # ── Con dos cuentas de efectivo: pregunta cuál ──
    cuentas.append({'id': 'k3', 'user_id': 'u1', 'nombre': 'Hucha', 'tipo': 'efectivo', 'clave': None, 'saldo': 100, 'fecha_saldo': iso(5)})
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo')
    apuntar_efectivo(pg, '15', 'mano', 'Regalo'); pg.wait_for_selector('.hoja-panel [data-mantener]')
    foto(pg, 'ef03_cual_efectivo', False)
    pg.click('.hoja-panel [data-accion="aplicar-traspaso"]:has-text("Hucha")'); pg.wait_for_timeout(400)
    res.comprobar(float(next(c for c in cuentas if c['id'] == 'k3')['saldo']) == 115 and cartera() == 40, 'con dos cuentas de efectivo pregunta y suma en la elegida')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    b.close()

res.terminar(errores)
