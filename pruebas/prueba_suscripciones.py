"""Suscripciones y pagos de cada mes (Supabase simulado y demo): Resumen enseña lo que se cobra cada mes en el mismo
sitio (Netflix, Spotify con su subida de precio, el recibo del gimnasio) con lo que suma al mes y al año, sin el súper;
la hoja de cada uno lista sus cobros y lo añade a los movimientos fijos con los datos puestos; «No es un pago de cada
mes» lo quita del total (también al recargar) y se puede volver a enseñar; sin la tabla de fijos no se ofrece añadirlo;
con un solo mes de datos explica cuándo saldrán."""
import os
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, euros, fila, hoy, SAL

res = Resultado('Suscripciones y pagos de cada mes')
SECCION = 'section[aria-label="Suscripciones y pagos de cada mes"]'
fila_pago = lambda nombre: f'{SECCION} .fila:has(.concepto:text-is("{nombre}"))'
total = lambda pg: euros(pg.inner_text(f'{SECCION} .cifra-m'))


def hace_meses(k, dia):
    """El día `dia` de hace k meses (None si es de este mes y aún no ha llegado)."""
    y, m = hoy.year, hoy.month - k
    while m < 1: y, m = y - 1, m + 12
    return None if k == 0 and dia > hoy.day else f'{y}-{m:02d}-{dia:02d}'


def datos(meses=5, con_fijos=True):
    txs, n = [], 0
    def mov(fecha, descripcion, importe, categoria, medio='tarjeta'):
        nonlocal n
        if fecha: n += 1; txs.append(fila(id=n, fecha=fecha, descripcion=descripcion, importe=importe, categoria=categoria, medio=medio))
    for k in range(meses):
        mov(hace_meses(k, 5), 'COMPRA TARJ. 5402XXXXXXXX1234 NETFLIX.COM', 12.99, '📦 Suscripciones')
        mov(hace_meses(k, 3), 'SPOTIFY P2A1B3C4D5', 11.99 if k < 3 else 10.99, '📦 Suscripciones')
        mov(hace_meses(k, 1), 'RECIBO GIMNASIO ZONA FIT', 35, '🏋️ Deporte', 'recibo')
        for d in (2, 9, 16, 23): mov(hace_meses(k, d), 'MERCADONA', 20 + (k * 7 + d) % 13 + 0.37, '🍔 Comida')
    tablas = {'pj_transacciones': txs, 'pj_cuentas': [], 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': []}
    if con_fijos: tablas['pj_fijos'] = []
    return txs, Supabase(tablas)


with sync_playwright() as p:
    b = lanzar(p); errores = []
    txs, base = datos()
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(SECCION)
    texto = pg.inner_text(SECCION)
    res.comprobar(all(pg.locator(fila_pago(x)).count() == 1 for x in ('Netflix', 'Spotify', 'Gimnasio Zona Fit')), 'encuentra Netflix, Spotify y el recibo del gimnasio')
    res.comprobar('Mercadona' not in texto, 'el súper no es un pago de cada mes')
    res.comprobar(abs(total(pg) - (12.99 + 11.99 + 35)) < 0.005, 'el total al mes es la suma de los tres, con el precio nuevo de Spotify')
    res.comprobar('720 € al año' in texto, 'y dice cuánto es al año')
    pg.locator(SECCION).screenshot(path=os.path.join(SAL, 'sus01_resumen.png'))

    # La hoja de Spotify: sus cobros, la subida de precio y añadirlo a los movimientos fijos
    pg.click(fila_pago('Spotify')); pg.wait_for_selector('[data-accion="ocultar-pago"]')
    hoja = pg.inner_text('.hoja-panel')
    res.comprobar('Ha subido de precio' in hoja and '10,99' in hoja, 'la hoja avisa de la subida de precio')
    res.comprobar(pg.locator('.hoja-panel .fila').count() == sum(1 for t in txs if 'SPOTIFY' in t['descripcion']), 'y lista todos sus cobros')
    foto(pg, 'sus02_hoja', False)
    pg.click('[data-accion="pago-a-fijos"]'); pg.wait_for_selector('#fijo-nombre')
    res.comprobar(pg.input_value('#fijo-nombre') == 'Spotify' and float(pg.input_value('#fijo-importe')) == 11.99 and pg.input_value('#fijo-dia') == '3'
                  and pg.input_value('#fijo-categoria') == '📦 Suscripciones', 'el movimiento fijo nuevo viene con los datos puestos')
    pg.click('[data-accion="guardar-fijo"]'); pg.wait_for_timeout(400)
    fijos = base.tablas['pj_fijos']
    res.comprobar(len(fijos) == 1 and fijos[0]['tipo'] == 'gasto' and float(fijos[0]['importe']) == 11.99, 'se guarda como gasto fijo')
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector('.tarjeta-tinta')
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(SECCION)
    res.comprobar('en tus fijos' in pg.inner_text(fila_pago('Spotify')), 'en la lista dice que ya está en tus fijos')

    # «No es un pago de cada mes»
    pg.click(fila_pago('Netflix')); pg.wait_for_selector('[data-accion="ocultar-pago"]'); pg.click('[data-accion="ocultar-pago"]'); pg.wait_for_timeout(300)
    res.comprobar(pg.locator(fila_pago('Netflix')).count() == 0 and abs(total(pg) - (11.99 + 35)) < 0.005, 'quitarlo lo saca de la lista y del total')
    pg.reload(); pg.wait_for_selector(SECCION)
    res.comprobar(pg.locator(fila_pago('Netflix')).count() == 0, 'sigue quitado al volver a abrir la app')
    pg.click('[data-accion="mostrar-pagos-ocultos"]'); pg.wait_for_timeout(300)
    res.comprobar(pg.locator(fila_pago('Netflix')).count() == 1, '«Volver a enseñar» lo devuelve')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    pg.close()

    # ── Sin la tabla de movimientos fijos: no se ofrece añadirlo ──
    txs, base = datos(con_fijos=False)
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(SECCION)
    pg.click(fila_pago('Netflix')); pg.wait_for_selector('[data-accion="ocultar-pago"]')
    res.comprobar(pg.locator('[data-accion="pago-a-fijos"]').count() == 0, 'sin la tabla de fijos no se ofrece añadirlo')
    pg.close()

    # ── Con un solo mes de datos: aún no hay nada, y lo explica ──
    txs, base = datos(meses=1)
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(SECCION)
    res.comprobar('3 meses seguidos' in pg.inner_text(SECCION) and pg.locator(f'{SECCION} .fila').count() == 0, 'con un mes de datos explica cuándo saldrán')
    pg.close()

    # ── Demo: el total es la suma de lo que enseña ──
    pg = pagina(b, errores)
    pg.goto('http://pulso.prueba/nueva/?demo#/resumen'); pg.wait_for_selector(SECCION)
    filas = [euros(x.replace('≈', '')) for x in pg.locator(f'{SECCION} .fila .importe').all_inner_texts()]
    res.comprobar(len(filas) >= 3 and abs(total(pg) - sum(filas)) < 0.005, 'demo: el total al mes es la suma de los pagos que enseña')
    b.close()

res.terminar(errores)
