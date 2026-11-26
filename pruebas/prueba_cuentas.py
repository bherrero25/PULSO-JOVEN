"""Varias cuentas con Supabase simulado: la cuenta de siempre adopta el número del extracto sin preguntar, una cuenta nueva
del mismo banco se crea con su nombre, el traspaso entre las dos se detecta, lo apuntado a mano va a la cuenta elegida, el
filtro por cuenta funciona y, si el extracto no trae número y hay varias cuentas de ese banco, se pregunta."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, extracto, importar, euros, iso, dmy, fila

res = Resultado('Varias cuentas')
txs = [fila(id=1, fecha=iso(5), descripcion='MERCADONA VALENCIA', importe=20.0, categoria='🍔 Comida'),
       fila(id=2, fecha=iso(15), descripcion='ZARA', importe=30.0, categoria='👕 Ropa')]
cuentas = [{'id': 'k1', 'user_id': 'u1', 'nombre': 'Bankinter', 'tipo': 'banco', 'clave': 'bankinter', 'saldo': 500, 'fecha_saldo': iso(10)}]
base = Supabase({'pj_transacciones': txs, 'pj_cuentas': cuentas, 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': [], 'pj_fijos': []})
EXT_A = extracto('cuenta_nomina', [(dmy(1), 'TRASPASO A CUENTA AHORRO', -200, 1280.0), (dmy(3), 'NOMINA EMPRESA', 1000, 1480.0), (dmy(5), 'MERCADONA VALENCIA', -20, 480.0)], numero='ES12 0128 0000 1111 2222 1234')
EXT_B = extracto('cuenta_ahorro', [(dmy(0), 'TRASPASO DESDE CUENTA NOMINA', 200, 2200.5), (dmy(4), 'INTERESES', 0.5, 2000.5)], numero='ES98 0128 0000 3333 4444 5678')
EXT_C = extracto('cuenta_sin_numero', [(dmy(0), 'CAFETERIA', -3, 100.0)])

with sync_playwright() as p:
    b = lanzar(p); errores = []
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo')

    # 1) La cuenta de siempre adopta su número (MERCADONA ya estaba: es la misma cuenta)
    vista = ' | '.join(importar(pg, EXT_A))
    res.comprobar(pg.locator('select[data-cambio="cuenta-extracto"]').count() == 0 and '···1234' in vista, 'la cuenta de siempre adopta su número sin preguntar')
    pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_timeout(900)
    res.comprobar([c['clave'] for c in cuentas] == ['bankinter·1234'] and {t['cuenta'] for t in txs} == {'bankinter·1234'}, 'el número se guarda en la cuenta y en todos sus movimientos')

    # 2) Otra cuenta del mismo banco: nueva, con nombre, y el traspaso entre las dos se detecta
    vista = ' | '.join(importar(pg, EXT_B))
    res.comprobar('Cuenta nueva' in vista and 'traspaso entre tus cuentas' in vista.lower(), 'una cuenta con otro número es nueva y se detecta el traspaso')
    pg.fill('input[data-entrada="nombre-cuenta-nueva"]', 'Ahorro')
    res.comprobar(pg.locator('input[data-cambio="traspaso-unir"]:checked').count() == 1, 'el traspaso viene marcado')
    foto(pg, 'cu01_cuenta_nueva')
    pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_timeout(900)
    res.comprobar(any(c['clave'] == 'bankinter·5678' and c['nombre'] == 'Ahorro' for c in cuentas), 'la cuenta nueva se crea con el nombre elegido')
    res.comprobar(all(t['categoria'] == '🔄 Traspaso' for t in txs if 'TRASPASO' in t['descripcion']), 'las dos mitades del traspaso quedan como traspaso')
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector('.saludo')
    ingresado = euros(pg.inner_text('.tarjeta-tinta .dato:has-text("Ingresado") b'))
    res.comprobar(abs(ingresado - 1000.5) < 0.005, 'el traspaso no cuenta como ingreso ni como gasto')
    res.comprobar(abs(euros(pg.inner_text('section[aria-label="Tu dinero"] .cifra-m')) - 3480.5) < 0.005, '«Tu dinero» suma las dos cuentas')

    # 3) Apuntar a mano en la cuenta Ahorro
    pg.click('.rapidos a:has-text("Bizum")'); pg.wait_for_selector('.teclado')
    res.comprobar(pg.locator('select[data-entrada="cuenta-nuevo"] option').count() == 2, 'con dos cuentas, el formulario pregunta la cuenta')
    pg.select_option('select[data-entrada="cuenta-nuevo"]', 'bankinter·5678')
    for k in '10': pg.click(f'.teclado [data-valor="{k}"]')
    pg.click('[data-accion="guardar-nuevo"]'); pg.wait_for_timeout(600)
    res.comprobar(any(t['cuenta'] == 'manual:bankinter·5678' for t in txs), 'lo apuntado guarda a qué cuenta va')
    ahorro = pg.locator('section[aria-label="Tu dinero"] .fila:has-text("Ahorro")').inner_text()
    res.comprobar('−10,00 € apuntado después' in ahorro, 'y «Tu dinero» lo resta en esa cuenta')

    # 4) Filtro por cuenta
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.wait_for_selector('#lista-movs')
    pg.select_option('select[data-cambio="filtro-cuenta"]', 'bankinter·5678'); pg.wait_for_timeout(200)
    filas = pg.locator('#lista-movs .fila').all_inner_texts()
    res.comprobar(len(filas) == 3 and not any('MERCADONA' in f for f in filas), 'el filtro deja solo los movimientos de esa cuenta')

    # 5) Sin número y con dos cuentas del banco: pregunta
    importar(pg, EXT_C)
    res.comprobar(pg.locator('select[data-cambio="cuenta-extracto"] option').count() == 3, 'sin número y con dos cuentas, pregunta de cuál es')
    b.close()

res.terminar(errores)
