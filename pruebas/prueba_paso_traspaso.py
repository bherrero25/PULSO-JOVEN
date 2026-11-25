"""Dinero de paso y traspasos (modo demo): ni el dinero de paso ni los traspasos cuentan como ingreso o gasto; lo que llega
de paso y lo que sale se compensan; un traspaso resta o suma en la cuenta elegida de «Tu dinero» y se puede deshacer."""
from playwright.sync_api import sync_playwright
from comun import Resultado, lanzar, pagina, apuntar, euros, iso

res = Resultado('Dinero de paso y traspasos')


def cifras(pg):
    pg.click('.barra a[href="#/inicio"]'); pg.wait_for_selector('.tarjeta-tinta')
    return {'balance': euros(pg.inner_text('.tarjeta-tinta .cifra')),
            'ingresado': euros(pg.inner_text('.tarjeta-tinta .dato:has-text("Ingresado") b')),
            'gastado': euros(pg.inner_text('.tarjeta-tinta .dato:has-text("Gastado") b'))}


ahorrado = lambda pg: euros(pg.locator('section[aria-label="Tu dinero"] .fila:has-text("Efectivo ahorrado") .importe').inner_text())

with sync_playwright() as p:
    b = lanzar(p); errores = []
    pg = pagina(b, errores)
    pg.goto('http://pulso.prueba/nueva/?demo'); pg.wait_for_selector('.tarjeta-tinta')
    c0 = cifras(pg); a0 = ahorrado(pg)

    # ── Dinero de paso: llega una transferencia de casa para pagar algo y luego se paga ──
    apuntar(pg, 'ingreso', '60', 'mensualidad', iso(0), 'transferencia', 'Transferencia de casa')
    pg.click('.barra a[href="#/movimientos"]'); pg.fill('input[data-entrada="buscar"]', 'transferencia de casa'); pg.wait_for_timeout(150)
    mensualidades = pg.locator('#lista-movs .fila:has-text("Mensualidad")').count()
    pg.locator('#lista-movs .fila:has-text("60,00")').first.click(); pg.wait_for_selector('.rejilla-cats')
    res.comprobar('Dinero de paso' in pg.locator('.rejilla-cats button').all_inner_texts(), 'un ingreso se puede marcar como dinero de paso')
    res.comprobar(not pg.is_checked('#recordar'), 'cambiar una transferencia de casa no cambia la regla por defecto')
    pg.click('.rejilla-cats button:has-text("Dinero de paso")'); pg.wait_for_timeout(300)
    pg.fill('input[data-entrada="buscar"]', 'transferencia de casa'); pg.wait_for_timeout(150)
    res.comprobar(pg.locator('#lista-movs .fila:has-text("Mensualidad")').count() == mensualidades - 1, 'solo esa transferencia deja de ser mensualidad')
    apuntar(pg, 'gasto', '60', 'reenviado', iso(0), 'tarjeta', 'Seguro del coche de papá')
    c1 = cifras(pg)
    res.comprobar(c1 == c0, 'llega y sale el mismo dinero de paso: balance, ingresado y gastado como al principio')
    pg.click('.barra a[href="#/resumen"]'); pg.wait_for_selector('section[aria-label="De dónde viene"]')
    texto = pg.inner_text('section[aria-label="De dónde viene"]')
    res.comprobar('Llegaron 60,00 €' in texto, 'el Resumen explica lo que llegó y salió de paso')

    # ── Traspaso: meter en el banco 200 € del efectivo ahorrado ──
    apuntar(pg, 'ingreso', '200', 'traspaso', iso(0), 'efectivo', 'Ahorros al banco')
    pg.wait_for_selector('.hoja-panel [data-accion="aplicar-traspaso"]')
    res.comprobar('¿De dónde salía este dinero?' in pg.inner_text('.hoja-cab'), 'al guardar un traspaso pregunta de qué cuenta sale')
    pg.click('[data-accion="aplicar-traspaso"]:has-text("Efectivo ahorrado")'); pg.wait_for_timeout(300)
    res.comprobar(abs(ahorrado(pg) - (a0 - 200)) < 0.005, 'se restan los 200 € del efectivo ahorrado')
    res.comprobar(cifras(pg) == c1, 'un traspaso no cambia ni el balance ni lo ingresado')
    pg.click('.barra a[href="#/movimientos"]'); pg.fill('input[data-entrada="buscar"]', 'ahorros al banco'); pg.wait_for_timeout(150)
    fila = pg.locator('#lista-movs .fila').first
    res.comprobar('⇄' in fila.inner_text(), 'en la lista se ve como traspaso (⇄)')
    # Deshacer: pasarlo a otra categoría ofrece devolver el dinero
    fila.click(); pg.wait_for_selector('.rejilla-cats')
    pg.click('.rejilla-cats button:has-text("Regalos")'); pg.wait_for_selector('.hoja-panel [data-accion="aplicar-traspaso"]')
    res.comprobar('¿Devolvemos este dinero' in pg.inner_text('.hoja-cab'), 'al quitar el traspaso ofrece devolver el dinero')
    pg.click('[data-accion="aplicar-traspaso"]:has-text("Efectivo ahorrado")'); pg.wait_for_timeout(300)
    c2 = cifras(pg)
    res.comprobar(abs(ahorrado(pg) - a0) < 0.005, 'el efectivo ahorrado vuelve a lo que tenía')
    res.comprobar(abs(c2['ingresado'] - (c1['ingresado'] + 200)) < 0.005, 'y ahora sí cuenta como ingreso')
    b.close()

res.terminar(errores)
