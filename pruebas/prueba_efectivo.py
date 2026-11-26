"""Ingresos en efectivo apuntados a mano (Supabase simulado): «en mano» no toca el banco; «metido en el banco» cuenta en
«Tu dinero» y al importar se junta con el «INGRESO EFECTIVO» del extracto sin repetirse; desde la hoja del movimiento se
puede cambiar dónde está."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, extracto, importar, euros, iso, dmy, fila

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
    b.close()

res.terminar(errores)
