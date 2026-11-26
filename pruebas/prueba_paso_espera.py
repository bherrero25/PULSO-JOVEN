"""Dinero de paso en espera y «Me lo quedo» (Supabase simulado): lo que llega de paso no suma a lo ingresado ni a la
previsión y se ve «en espera»; cuando sale (marcado como dinero de paso) no resta; lo que sobra se puede pasar a ingreso
con «Me lo quedo» (no más de lo que hay en espera, sin tocar «Tu dinero»), y al borrarlo vuelve a la espera."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, apuntar, euros, fila, hoy
import datetime

res = Resultado('Dinero de paso en espera')
mes = hoy.strftime('%Y-%m')
dia = f'{mes}-{min(hoy.day, 25):02d}'  # dentro del mes aunque hoy sea uno de los 3 últimos días (que cuentan para el siguiente)
iso = lambda n: (hoy - datetime.timedelta(days=n)).isoformat()
ingresado = lambda pg: euros(pg.inner_text('.tarjeta-tinta .dato:has-text("Ingresado") b'))
gastado = lambda pg: euros(pg.inner_text('.tarjeta-tinta .dato:has-text("Gastado") b'))
RESUMEN_PASO = 'section[aria-label="De dónde viene"] details:has-text("Dinero de paso")'


def inicio(pg):
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector('.tarjeta-tinta')


with sync_playwright() as p:
    b = lanzar(p); errores = []
    txs = [fila(id=1, fecha=f'{mes}-01', descripcion='TRANSFERENCIA DE CASA', importe=470, tipo='ingreso', medio='transferencia', categoria='💰 Mensualidad')]
    txs += [fila(id=10 + n, fecha=iso(n), descripcion=f'SUPERMERCADO {n}', importe=6.0, categoria='🍔 Comida') for n in range(1, 40)]
    cuentas = [{'id': 'k1', 'user_id': 'u1', 'nombre': 'Bankinter', 'tipo': 'banco', 'clave': 'bankinter', 'saldo': 1500, 'fecha_saldo': iso(0)}]
    base = Supabase({'pj_transacciones': txs, 'pj_cuentas': cuentas, 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': [], 'pj_fijos': []})
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.tarjeta-tinta')
    i0, g0 = ingresado(pg), gastado(pg)
    linea0 = euros(pg.inner_text('.linea-prevision b').replace('≈', ''))

    # ── Llegan 800 € de paso para un ordenador: en espera, no suman ──
    apuntar(pg, 'ingreso', '800', 'reenviado', dia, 'transferencia', 'Mamá para el ordenador', url='http://pulso.prueba/nueva/#/anadir')
    inicio(pg)
    res.comprobar(ingresado(pg) == i0, 'el dinero de paso que llega no suma a lo ingresado')
    res.comprobar(abs(euros(pg.inner_text('.linea-prevision b').replace('≈', '')) - linea0) <= 1, 'ni a la previsión de fin de mes')
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(RESUMEN_PASO)
    res.comprobar('800,00 € en espera' in pg.inner_text(RESUMEN_PASO), 'en Resumen se ve «en espera»')
    res.comprobar('de dinero de paso en espera' in pg.inner_text('section[aria-label="¿Llegas a fin de mes?"]'), 'y la previsión explica por qué no cuenta')
    res.comprobar(pg.locator('[data-accion="me-lo-quedo"]').count() == 1, 'el botón «Me lo quedo» sale una sola vez')
    foto(pg, 'pe01_en_espera')

    # ── Sale el ordenador (700 €) marcado como dinero de paso: no resta; sobran 100 € en espera ──
    apuntar(pg, 'gasto', '700', 'reenviado', dia, 'tarjeta', 'Ordenador', url='http://pulso.prueba/nueva/#/anadir')
    inicio(pg)
    res.comprobar(ingresado(pg) == i0 and gastado(pg) == g0, 'cuando sale, ni resta de lo ingresado ni cuenta como gasto')
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(RESUMEN_PASO)
    res.comprobar('100,00 € en espera' in pg.inner_text(RESUMEN_PASO), 'lo que sobra sigue en espera')
    inicio(pg); dinero0 = euros(pg.inner_text('section[aria-label="Tu dinero"] .cifra-m'))
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(RESUMEN_PASO)

    # ── Me lo quedo ──
    pg.click('[data-accion="me-lo-quedo"]'); pg.wait_for_selector('#quedo-importe')
    res.comprobar(pg.input_value('#quedo-importe') == '100', 'propone quedarse todo lo que hay en espera')
    pg.fill('#quedo-importe', '150'); pg.click('[data-accion="guardar-me-lo-quedo"]'); pg.wait_for_timeout(200)
    res.comprobar('Como mucho' in pg.inner_text('#toast') and not any(t.get('cuenta') == 'liberado' for t in txs), 'no deja quedarse más de lo que hay en espera')
    pg.fill('#quedo-importe', '100')
    foto(pg, 'pe02_me_lo_quedo', False)
    pg.click('[data-accion="guardar-me-lo-quedo"]'); pg.wait_for_timeout(500)
    quedo = [t for t in txs if t.get('cuenta') == 'liberado']
    res.comprobar(len(quedo) == 1 and quedo[0]['importe'] == 100 and quedo[0]['categoria'] == '🎁 Regalo recibido', 'se guarda como un ingreso (Regalos) que sale del dinero de paso')
    res.comprobar(pg.locator('[data-accion="me-lo-quedo"]').count() == 0, 'y ya no queda nada en espera')
    inicio(pg)
    res.comprobar(abs(ingresado(pg) - (i0 + 100)) < 0.005, 'los 100 € pasan a contar como ingreso')
    res.comprobar(abs(euros(pg.inner_text('section[aria-label="Tu dinero"] .cifra-m')) - dinero0) < 0.005, '«Tu dinero» no cambia: ese dinero ya estaba en el banco')
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.wait_for_selector('#lista-movs')
    fila_quedo = pg.locator('#lista-movs .fila:has-text("Me lo quedo")')
    res.comprobar('De tu dinero de paso' in fila_quedo.inner_text(), 'en Movimientos se ve de dónde sale')
    # Borrarlo lo devuelve a la espera
    fila_quedo.click(); pg.wait_for_selector('.hoja-panel'); pg.click('[data-accion="borrar-mov"]'); pg.click('#conf-si'); pg.wait_for_timeout(500)
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(RESUMEN_PASO)
    res.comprobar('100,00 € en espera' in pg.inner_text(RESUMEN_PASO), 'al borrar «Me lo quedo», el dinero vuelve a estar en espera')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    b.close()

res.terminar(errores)
