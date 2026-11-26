"""Categorías (modo demo): los Bizum se clasifican en categorías reales, «Coche compartido» (BlaBlaCar) se descuenta de la
gasolina en el Resumen, y la casilla «recordar» solo viene marcada al clasificar algo por revisar."""
from playwright.sync_api import sync_playwright
from comun import Resultado, lanzar, pagina, foto, euros

res = Resultado('Categorías: Bizum, coche compartido y «recordar»')

with sync_playwright() as p:
    b = lanzar(p); errores = []
    pg = pagina(b, errores)
    pg.goto('http://pulso.prueba/nueva/?demo#/movimientos'); pg.wait_for_selector('#lista-movs')

    # Bizum recibido por revisar
    pg.click('[data-accion="filtro"][data-valor="revisar"]'); pg.wait_for_timeout(200)
    pg.click('#lista-movs .fila:has-text("Bizum de Marta")'); pg.wait_for_selector('.hoja-panel')
    res.comprobar(pg.inner_text('.hoja-cab .sub') == '¿De qué es este Bizum?', 'un Bizum recibido pregunta «¿De qué es este Bizum?»')
    opciones = pg.locator('.rejilla-cats button').all_inner_texts()
    res.comprobar('Bizum recibido' not in opciones and {'Devoluciones', 'Regalos', 'Ventas', 'Dinero de paso'} <= set(opciones), 'ofrece categorías reales y no «Bizum recibido»')
    res.comprobar(not pg.is_checked('#recordar'), 'con un Bizum, «recordar» viene sin marcar')
    pg.click('.rejilla-cats button:has-text("Devoluciones")'); pg.wait_for_selector('[data-sub="1"]')
    pg.click('[data-sub="1"][data-cat="🤝 Devolución"]'); pg.wait_for_timeout(300)  # «No sé de qué gasto es»: sigue siendo ingreso
    pg.click('.barra a[href="#/resumen"]'); pg.wait_for_selector('section[aria-label="De dónde viene"]')
    res.comprobar('Devoluciones' in pg.inner_text('section[aria-label="De dónde viene"]'), 'el Bizum clasificado aparece en «De dónde viene»')

    # Coche compartido: la gasolina dice lo recuperado y lo que ha costado de verdad
    fila = pg.locator('section[aria-label="En qué se va"] details:has-text("Gasolina")')
    texto = fila.inner_text()
    res.comprobar('Recuperado con coche compartido' in texto and 'te ha costado' in texto, 'la gasolina muestra lo recuperado con coche compartido')
    gastado = euros(fila.locator('.imp').inner_text())
    recuperado = euros(fila.locator('.nota b').nth(0).inner_text())
    coste = euros(fila.locator('.nota b').nth(1).inner_text())
    res.comprobar(abs(gastado - recuperado - coste) < 0.005, 'gastado − recuperado = lo que ha costado')
    res.comprobar('Coche compartido' in pg.inner_text('section[aria-label="De dónde viene"]'), 'y cuenta como ingreso en «De dónde viene»')
    foto(pg, 'ca01_resumen_gasolina', False)
    pg.click('.barra a.mas'); pg.wait_for_selector('.teclado'); pg.click('[data-accion="tipo-nuevo"][data-valor="ingreso"]')
    res.comprobar('Coche compartido' in pg.locator('[data-accion="cat-nuevo"]').all_inner_texts(), 'se puede apuntar a mano como ingreso')
    # La regla automática distingue cobrar (coche compartido) de pagar un viaje (transporte)
    auto = pg.evaluate("""async () => { const m = await import('./js/logica.js');
      return [m.categoriaAutomatica('TRANSF INM /BLABLACAR COMUTO SA', 'ingreso'), m.categoriaAutomatica('BLABLACAR VIAJE MADRID', 'gasto')]; }""")
    res.comprobar(auto == ['🚗 Coche compartido', '🚇 Transporte'], 'BlaBlaCar: si te pagan es coche compartido; si pagas tú, transporte')

    # «Recordar»: al cambiar un movimiento que ya tenía categoría, viene sin marcar y solo cambia ese
    pg.goto('http://pulso.prueba/nueva/?demo#/movimientos'); pg.wait_for_selector('#lista-movs')
    pg.click('[data-accion="filtro"][data-valor="todos"]')
    pg.fill('input[data-entrada="buscar"]', 'mercadona'); pg.wait_for_timeout(150)
    antes = pg.locator('#lista-movs .fila:has-text("Comida")').count()
    pg.locator('#lista-movs .fila').first.click(); pg.wait_for_selector('.hoja-panel')
    res.comprobar(not pg.is_checked('#recordar') and 'Cambiar también' in pg.inner_text('label.casilla'), 'en uno ya clasificado, «recordar» viene sin marcar')
    pg.click('.rejilla-cats button:has-text("Ocio")'); pg.wait_for_timeout(300)
    pg.fill('input[data-entrada="buscar"]', 'mercadona'); pg.wait_for_timeout(150)
    res.comprobar(pg.locator('#lista-movs .fila:has-text("Comida")').count() == antes - 1, 'y solo cambia ese movimiento')
    pg.fill('input[data-entrada="buscar"]', ''); pg.click('[data-accion="filtro"][data-valor="revisar"]'); pg.wait_for_timeout(150)
    pg.locator('#lista-movs .fila:has-text("Zaragoza")').first.click(); pg.wait_for_selector('.hoja-panel')
    res.comprobar(pg.is_checked('#recordar'), 'al clasificar algo por revisar, «recordar» viene marcada')
    b.close()

res.terminar(errores)
