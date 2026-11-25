"""Apuntar rápido (modo demo): los botones de Inicio abren el formulario preparado, los textos se adaptan a Bizum y
transferencia, «Lo decido luego» deja el movimiento por revisar y la categoría por defecto sigue a la forma de pago."""
from playwright.sync_api import sync_playwright
from comun import Resultado, lanzar, pagina, foto

res = Resultado('Apuntar rápido')


def formulario(pg):
    return {'tipos': pg.locator('.tipo button').all_inner_texts(), 'forma': pg.inner_text('.formas button[aria-pressed="true"]'),
            'cat': pg.inner_text('.cat-chip[aria-pressed="true"]'), 'concepto': pg.get_attribute('input[data-entrada="concepto-nuevo"]', 'placeholder'),
            'boton': pg.inner_text('[data-accion="guardar-nuevo"]')}


with sync_playwright() as p:
    b = lanzar(p); errores = []
    pg = pagina(b, errores)
    pg.goto('http://pulso.prueba/nueva/?demo'); pg.wait_for_selector('.rapidos')
    res.comprobar(pg.locator('.rapidos a').all_inner_texts() == ['Gasto', 'Ingreso', 'Bizum', 'Transferencia'], 'Inicio tiene los botones Gasto, Ingreso, Bizum y Transferencia')
    foto(pg, 'ap01_inicio', False)

    pg.click('.rapidos a:has-text("Bizum")'); pg.wait_for_selector('.teclado')
    f = formulario(pg)
    res.comprobar(pg.url.endswith('#/anadir'), 'el enlace se limpia al abrir el formulario')
    res.comprobar(f == {'tipos': ['Enviado', 'Recibido'], 'forma': 'Bizum', 'cat': 'Lo decido luego', 'concepto': '¿A quién?', 'boton': 'Guardar Bizum enviado'}, 'con Bizum: Enviado/Recibido, «¿A quién?» y «Lo decido luego»')
    for k in '15': pg.click(f'.teclado [data-valor="{k}"]')
    pg.fill('input[data-entrada="concepto-nuevo"]', 'Marta'); foto(pg, 'ap02_bizum', False)
    pg.click('[data-accion="guardar-nuevo"]'); pg.wait_for_selector('.tarjeta-tinta')
    res.comprobar('Por revisar' in pg.inner_text('#toast'), 'al guardar «luego», recuerda que queda por revisar')

    pg.click('.rapidos a:has-text("Transferencia")'); pg.wait_for_selector('.teclado'); pg.click('.tipo button:has-text("Recibida")')
    f = formulario(pg)
    res.comprobar(f['concepto'] == '¿De quién o de qué?' and f['boton'] == 'Guardar transferencia recibida', 'transferencia recibida: textos adaptados')
    for k in '50': pg.click(f'.teclado [data-valor="{k}"]')
    pg.click('[data-accion="cat-nuevo"][data-valor="devolucion"]'); pg.click('[data-accion="guardar-nuevo"]'); pg.wait_for_selector('.tarjeta-tinta')
    res.comprobar('guardada' in pg.inner_text('#toast'), 'la transferencia se guarda')

    pg.click('.rapidos a:has-text("Gasto")'); pg.wait_for_selector('.teclado')
    res.comprobar(formulario(pg)['cat'] == 'Comida' and formulario(pg)['forma'] == 'Tarjeta', 'Gasto abre con tarjeta y comida')
    pg.click('.formas button:has-text("Bizum")'); res.comprobar(formulario(pg)['cat'] == 'Lo decido luego', 'al pasar a Bizum sin elegir categoría, queda para luego')
    pg.click('[data-accion="cat-nuevo"][data-valor="ocio"]'); pg.click('.formas button:has-text("Tarjeta")')
    res.comprobar(formulario(pg)['cat'] == 'Ocio', 'una categoría elegida se mantiene al cambiar la forma de pago')

    pg.goto('http://pulso.prueba/nueva/?demo#/movimientos'); pg.wait_for_selector('#lista-movs')
    hoy = pg.locator('#lista-movs section').first.inner_text()
    res.comprobar('Marta' in hoy and 'Sin categoría' in hoy, 'el Bizum apuntado sale hoy, por revisar')
    b.close()

res.terminar(errores)
