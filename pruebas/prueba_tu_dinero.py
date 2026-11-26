"""«Tu dinero»: añadir una cuenta suma al total, lo apuntado a mano después del extracto cuenta en el banco (el efectivo no),
el desglose explica la cifra, el saldo del extracto se guarda al importar y la app funciona sin la tabla de cuentas."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, extracto, importar, euros, iso, dmy

res = Resultado('Tu dinero')
total = lambda pg: euros(pg.inner_text('section[aria-label="Tu dinero"] .cifra-m'))
banco = lambda pg: euros(pg.locator('section[aria-label="Tu dinero"] .lista-cuentas .fila:has-text("Banco") .importe').first.inner_text())

with sync_playwright() as p:
    b = lanzar(p); errores = []

    # ── Demo ──
    pg = pagina(b, errores)
    pg.goto('http://pulso.prueba/nueva/?demo'); pg.wait_for_selector('section[aria-label="Tu dinero"]')
    t0, b0 = total(pg), banco(pg)
    pg.click('[data-accion="gestionar-cuentas"]'); pg.click('.hoja-panel [data-accion="editar-cuenta"][data-id=""]')
    pg.fill('#cuenta-nombre', 'Hucha'); pg.select_option('#cuenta-tipo', 'ahorro'); pg.fill('#cuenta-saldo', '50')
    pg.click('[data-accion="guardar-cuenta"]'); pg.wait_for_timeout(300)
    res.comprobar(abs(total(pg) - (t0 + 50)) < 0.005, 'añadir una hucha de 50 € suma 50 € al total')
    # Transferencia recibida apuntada a mano: el banco sube; un café en efectivo no lo cambia
    pg.click('.rapidos a:has-text("Transferencia")'); pg.wait_for_selector('.teclado'); pg.click('.tipo button:has-text("Recibida")')
    for k in '200': pg.click(f'.teclado [data-valor="{k}"]')
    pg.click('[data-accion="cat-nuevo"][data-valor="reenviado"]'); pg.click('[data-accion="guardar-nuevo"]'); pg.wait_for_selector('.saludo')
    pg.wait_for_selector('[data-accion="poner-paso"][data-paso=""]'); pg.click('[data-accion="poner-paso"][data-paso=""]'); pg.wait_for_timeout(300)  # «Todavía no lo sé»
    res.comprobar(abs(banco(pg) - (b0 + 200)) < 0.005, 'lo apuntado a mano después del extracto se suma al banco')
    res.comprobar('apuntado después' in pg.inner_text('section[aria-label="Tu dinero"]'), 'y la fila del banco lo dice')
    pg.click('.rapidos a:has-text("Gasto")'); pg.wait_for_selector('.teclado'); pg.click('.formas button:has-text("Efectivo")')
    pg.click('.teclado [data-valor="5"]'); pg.click('[data-accion="guardar-nuevo"]'); pg.wait_for_selector('.saludo')
    res.comprobar(abs(banco(pg) - (b0 + 200)) < 0.005, 'lo pagado en efectivo no cambia el banco')
    # Desglose al tocar la cuenta
    pg.click('section[aria-label="Tu dinero"] .lista-cuentas .fila:has-text("Banco")'); pg.wait_for_selector('.hoja-panel')
    texto = pg.inner_text('.hoja-panel')
    res.comprobar(all(x in texto for x in ('Saldo del extracto', 'Retenido', 'Apuntado después', 'En «Tu dinero»')), 'el desglose explica la cifra del banco')
    foto(pg, 'td01_desglose', False)
    pg.close()

    # ── Supabase simulado, con y sin la tabla de cuentas ──
    EXT = extracto('tu_dinero', [(dmy(0), 'LIBRERIA PAPEL', -12.0, 845.30), (dmy(1), 'BIZUM DE ANA', 20.0, 857.30), (dmy(2), 'MERCADONA', -30.0, 837.30)])
    for falta in (True, False):
        tablas = {'pj_transacciones': [], 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': []}
        if not falta: tablas['pj_cuentas'] = [{'id': 'k1', 'user_id': 'u1', 'nombre': 'Bankinter', 'tipo': 'banco', 'clave': 'bankinter', 'saldo': 700, 'fecha_saldo': iso(9)}]
        base = Supabase(tablas)
        pg = pagina(b, errores); con_sesion(pg, base)
        pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo'); pg.wait_for_timeout(400)
        res.comprobar(not pg.is_visible('#aviso-error'), f'{"sin" if falta else "con"} la tabla de cuentas la app abre sin errores')
        if falta:
            res.comprobar('sql/2026-11-cuentas.sql' in pg.inner_text('section[aria-label="Tu dinero"]'), 'sin la tabla, «Tu dinero» explica qué falta')
        else:
            importar(pg, EXT); pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_timeout(800)
            c = base.tablas['pj_cuentas'][0]
            res.comprobar(float(c['saldo']) == 845.30 and c['fecha_saldo'] == iso(0), 'al importar se guarda el saldo del último movimiento del extracto')
        pg.close()
    b.close()

res.terminar(errores)
