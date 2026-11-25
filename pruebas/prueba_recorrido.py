"""Recorrido general de la app nueva en modo demo, en móvil y en ordenador: todas las pantallas se abren, las acciones
principales funcionan y no hay errores de JavaScript. Deja capturas en pruebas/capturas/."""
from playwright.sync_api import sync_playwright
from comun import Resultado, lanzar, pagina, foto, extracto, dmy

res = Resultado('Recorrido general (demo)')
EXT = extracto('recorrido', retenidos=[(dmy(1), 'PENDIENTE XYZ', -5)], filas=[
    (dmy(5), 'MERCADONA VALENCIA', -23.4, 0), (dmy(6), 'PAGO BIZUM A LUCIA', -12, 0), (dmy(7), 'RENFE VIAJEROS', -9.5, 0),
    (dmy(8), 'TRANSFERENCIA DE CASA', 200, 0), (dmy(10), 'MEDIA MARKT', -59.99, 0)])
num_movs = lambda pg: int(pg.inner_text('#lista-movs > div').split()[0])

with sync_playwright() as p:
    b = lanzar(p); errores = []
    pg = pagina(b, errores)
    pg.goto('http://pulso.prueba/nueva/')
    pg.wait_for_selector('#form-entrar'); foto(pg, 'r00_entrar', False)
    res.comprobar(pg.is_visible('text=Ver la demo con datos de ejemplo'), 'la pantalla de entrar ofrece la demo')
    pg.click('text=Ver la demo con datos de ejemplo')
    pg.wait_for_selector('.tarjeta-tinta'); foto(pg, 'r01_inicio')
    res.comprobar(pg.inner_text('.tarjeta-tinta .etiqueta').strip() == 'Balance mensual', 'Inicio muestra el «Balance mensual»')
    res.comprobar(pg.locator('.rapidos a').count() == 4, 'Inicio tiene los 4 botones de apuntar rápido')
    mes = pg.inner_text('.selector-mes span')
    pg.click('[data-accion="mes-anterior"]'); res.comprobar(pg.inner_text('.selector-mes span') != mes, 'se puede ir al mes anterior')
    res.comprobar(pg.inner_text('.tarjeta-tinta .etiqueta').startswith('Balance de'), 'un mes pasado dice «Balance de …»')
    pg.click('[data-accion="mes-siguiente"]'); res.comprobar(pg.inner_text('.selector-mes span') == mes, 'y volver al actual')

    # Movimientos: clasificar uno por revisar y buscar
    pg.click('.barra a[href="#/movimientos"]'); pg.wait_for_selector('#lista-movs'); foto(pg, 'r02_movimientos')
    pg.click('[data-accion="filtro"][data-valor="revisar"]')
    antes = num_movs(pg)
    res.comprobar(antes > 0, 'la demo tiene movimientos por revisar')
    pg.click('#lista-movs .fila >> nth=0'); pg.wait_for_selector('.hoja-panel'); foto(pg, 'r03_elegir_categoria', False)
    pg.click('.rejilla-cats button:has-text("Ocio")'); pg.wait_for_timeout(300)
    res.comprobar(num_movs(pg) == antes - 1, 'al darle categoría sale de «Por revisar»')
    pg.click('[data-accion="filtro"][data-valor="todos"]')
    pg.fill('input[data-entrada="buscar"]', 'mercadona'); pg.wait_for_timeout(150)
    filas = pg.locator('#lista-movs .fila .concepto').all_inner_texts()
    res.comprobar(filas and all('mercadona' in f.lower() for f in filas), 'el buscador solo deja lo que coincide')
    pg.fill('input[data-entrada="buscar"]', '')

    # Añadir a mano
    total = num_movs(pg)
    pg.click('.barra a.mas'); pg.wait_for_selector('.teclado')
    for k in ['1', '2', ',', '5']: pg.click(f'.teclado [data-valor="{k}"]')
    res.comprobar(pg.inner_text('.pantalla-importe').replace(' ', ' ').startswith('−12,5'), 'el teclado escribe el importe')
    pg.click('[data-accion="cat-nuevo"][data-valor="ocio"]')
    pg.fill('input[data-entrada="concepto-nuevo"]', 'Cañas con amigos'); foto(pg, 'r04_anadir', False)
    pg.click('[data-accion="guardar-nuevo"]'); pg.wait_for_selector('.tarjeta-tinta')
    res.comprobar('guardado' in pg.inner_text('#toast'), 'al guardar avisa de que se ha guardado')
    pg.click('.barra a[href="#/movimientos"]'); pg.wait_for_selector('#lista-movs')
    res.comprobar(num_movs(pg) == total + 1, 'el movimiento nuevo aparece en la lista')

    # Importar un extracto
    pg.click('.barra a.mas'); pg.click('[data-accion="tab-anadir"][data-valor="extracto"]'); foto(pg, 'r05_extracto', False)
    pg.set_input_files('input[data-cambio="archivo"]', EXT)
    pg.wait_for_selector('[data-accion="confirmar-importacion"]', timeout=10000); foto(pg, 'r06_extracto_revisar')
    res.comprobar('Nuevos' in pg.inner_text('.anadir-cuerpo'), 'la vista previa cuenta los nuevos')
    pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_selector('#lista-movs')
    res.comprobar('importados' in pg.inner_text('#toast'), 'al importar avisa de cuántos')
    pg.click('.barra a.mas'); pg.click('[data-accion="tab-anadir"][data-valor="auto"]'); foto(pg, 'r07_automatico')
    res.comprobar(pg.locator('[data-accion="gestionar-fijos"]').count() == 1 and pg.locator('[data-accion="configurar-applepay"]').count() == 1, '«Automático» ofrece movimientos fijos y Apple Pay')
    pg.click('a[aria-label="Cerrar"]')

    # Resumen y planes
    pg.click('.barra a[href="#/resumen"]'); pg.wait_for_selector('.grafico-barras'); foto(pg, 'r08_resumen')
    res.comprobar(pg.locator('.grafico-barras .col').count() >= 2, 'el gráfico del resumen tiene varios meses')
    res.comprobar(pg.locator('section[aria-label="En qué se va"] details').count() > 0, '«En qué se va» tiene categorías')
    pg.click('.grafico-barras .col >> nth=1'); foto(pg, 'r09_resumen_otro_mes', False)
    pg.click('.barra a[href="#/presupuesto"]'); foto(pg, 'r10_presupuesto')
    pg.click('[data-accion="editar-presupuesto"] >> nth=0'); pg.wait_for_selector('.hoja-panel')
    pg.fill('#pres-limite', '75'); pg.click('[data-accion="guardar-presupuesto"]'); pg.wait_for_timeout(300)
    res.comprobar('75 €' in pg.inner_text('#toast') and not pg.is_visible('.hoja-panel'), 'el límite de presupuesto se guarda')
    pg.click('.segmentado a[href="#/metas"]'); foto(pg, 'r11_metas')
    antes = pg.inner_text('.contenido')
    pg.click('[data-accion="aportar-rapido"] >> nth=1'); pg.wait_for_timeout(300)
    res.comprobar(pg.inner_text('.contenido') != antes, 'aportar a una meta la cambia')
    pg.click('.segmentado a[href="#/inversion"]'); foto(pg, 'r12_inversion')
    antes = pg.inner_text('.contenido')
    pg.fill('input[data-entrada="inv-mensual"]', '100'); pg.click('[data-accion="inv-perfil"][data-valor="decidido"]'); pg.wait_for_timeout(200)
    res.comprobar(pg.inner_text('.contenido') != antes, 'la simulación de inversión cambia con los datos')
    pg.click('.barra a[href="#/inicio"]'); pg.click('.cabecera [data-accion="cuenta"]'); pg.wait_for_selector('.hoja-panel')
    res.comprobar(pg.is_visible('[data-accion="salir"]'), 'la hoja de la cuenta permite salir')
    pg.close()

    # Ordenador
    pg = pagina(b, errores, 1440, 900)
    pg.goto('http://pulso.prueba/nueva/?demo'); pg.wait_for_selector('.tarjeta-tinta'); foto(pg, 'r13_ordenador_inicio')
    res.comprobar(pg.is_visible('.lateral') and not pg.is_visible('.barra'), 'en ordenador hay menú lateral y no barra inferior')
    for ruta, sel in [('movimientos', '#lista-movs'), ('resumen', '.grafico-barras'), ('presupuesto', '.contenido'), ('anadir', '.teclado')]:
        pg.click(f'.lateral a[href="#/{ruta}"]'); pg.wait_for_selector(sel); foto(pg, f'r14_ordenador_{ruta}', False)
    res.comprobar(True, 'en ordenador se abren todas las pantallas')
    b.close()

res.terminar(errores)
