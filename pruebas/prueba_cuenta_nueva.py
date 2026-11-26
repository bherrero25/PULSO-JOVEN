"""Cuenta de banco añadida a mano y cuenta principal (Supabase simulado): se añade con banco y 4 últimas cifras, su extracto
la reconoce por el número sin preguntar, la principal se puede elegir (y cambia la cuenta que viene marcada al apuntar),
sin la columna «principal» no se ofrece, y lo que está sin categoría también dice de qué cuenta es."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, extracto, importar, iso, dmy, fila

res = Resultado('Cuenta nueva y cuenta principal')
TU_DINERO = 'section[aria-label="Tu dinero"]'


def base_de_prueba(con_columna=True, segunda=False):
    cuentas = [{'id': 'k1', 'user_id': 'u1', 'nombre': 'Cuenta de siempre', 'tipo': 'banco', 'clave': 'bankinter·1234', 'saldo': 800, 'fecha_saldo': iso(6), 'creada': '2026-09-28T10:00:00Z'}]
    if segunda: cuentas.append({'id': 'k2', 'user_id': 'u1', 'nombre': 'Ahorro', 'tipo': 'banco', 'clave': 'bankinter·9999', 'saldo': 50, 'fecha_saldo': iso(1), 'creada': '2026-11-01T10:00:00Z'})
    if con_columna:
        for c in cuentas: c['principal'] = False
    txs = [fila(id=1, fecha=iso(6), descripcion='MERCADONA VALENCIA', importe=20.0, categoria='🍔 Comida', cuenta='bankinter·1234'),
           fila(id=2, fecha=iso(5), descripcion='BIZUM DE ANA GARCIA', importe=15.0, tipo='ingreso', medio='bizum', categoria='📱 Bizum recibido', cuenta='bankinter·1234')]
    return Supabase({'pj_transacciones': txs, 'pj_cuentas': cuentas, 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': [], 'pj_fijos': []},
                    por_defecto={'pj_cuentas': {'principal': False, 'creada': '2026-11-26T10:00:00Z'} if con_columna else {'creada': '2026-11-26T10:00:00Z'}})


def cuenta_marcada(pg):
    """La cuenta que viene elegida al apuntar a mano."""
    pg.click('.rapidos a:has-text("Gasto")'); pg.wait_for_selector('.teclado')
    v = pg.eval_on_selector('select[data-entrada="cuenta-nuevo"]', 'e => e.value')
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector('.saludo')
    return v


with sync_playwright() as p:
    b = lanzar(p); errores = []
    base = base_de_prueba()
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo')

    # 1) Añadir una cuenta de banco a mano
    pg.click('[data-accion="gestionar-cuentas"]'); pg.click('.hoja-panel [data-accion="editar-cuenta"][data-id=""]'); pg.wait_for_selector('#cuenta-nombre')
    res.comprobar(not pg.is_visible('#cuenta-numero'), 'el banco y las cifras solo se piden si el tipo es Banco')
    pg.select_option('#cuenta-tipo', 'banco'); pg.wait_for_timeout(100)
    res.comprobar(pg.is_visible('#cuenta-numero') and 'reconocerá' in pg.inner_text('#cuenta-nota'), 'al elegir Banco pide el banco y las 4 últimas cifras, y explica para qué')
    pg.select_option('#cuenta-entidad', 'bbva'); pg.fill('#cuenta-saldo', '120')
    pg.fill('#cuenta-numero', '56'); pg.click('[data-accion="guardar-cuenta"]'); pg.wait_for_timeout(200)
    res.comprobar('4 últimas cifras' in pg.inner_text('#toast') and len(base.tablas['pj_cuentas']) == 1, 'no la guarda sin las 4 cifras')
    pg.fill('#cuenta-numero', '1234'); pg.click('[data-accion="guardar-cuenta"]'); pg.wait_for_timeout(200)
    res.comprobar('acaba en 1234' in pg.inner_text('#toast') and len(base.tablas['pj_cuentas']) == 1, 'ni con el número de una cuenta que ya tienes')
    foto(pg, 'cn01_cuenta_banco', False)
    pg.fill('#cuenta-numero', '5678'); pg.click('[data-accion="guardar-cuenta"]'); pg.wait_for_timeout(500)
    nueva = next((c for c in base.tablas['pj_cuentas'] if c.get('clave') == 'bbva·5678'), None)
    res.comprobar(nueva and nueva['nombre'] == 'BBVA ···5678' and nueva['tipo'] == 'banco', 'se guarda como cuenta de banco, con clave y nombre del banco')
    res.comprobar(pg.locator(f'{TU_DINERO} .fila').count() == 2, 'y aparece en «Tu dinero»')

    # 2) La principal: sin elegir, la más antigua (no la recién añadida); se puede cambiar
    res.comprobar('principal' in pg.locator(f'{TU_DINERO} .fila:has-text("Cuenta de siempre")').inner_text(), 'sin elegir, la principal es la primera que tenías')
    res.comprobar(cuenta_marcada(pg) == 'bankinter·1234', 'y es la que viene marcada al apuntar a mano')
    pg.click(f'{TU_DINERO} .fila:has-text("BBVA")'); pg.wait_for_selector('.hoja-panel')
    res.comprobar('reconocerá por su número' in pg.inner_text('.hoja-panel'), 'la hoja de la cuenta sin extracto explica que se pondrá al día con él')
    pg.click('[data-accion="hacer-principal"]'); pg.wait_for_timeout(500)
    principales = [c['clave'] for c in base.tablas['pj_cuentas'] if c.get('principal')]
    res.comprobar(principales == ['bbva·5678'], '«Hacerla mi cuenta principal» la guarda (y solo esa)')
    res.comprobar('Es tu cuenta principal' in pg.inner_text('.hoja-panel'), 'y la hoja lo dice')
    foto(pg, 'cn02_principal', False)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    res.comprobar(cuenta_marcada(pg) == 'bbva·5678', 'al apuntar a mano viene marcada la nueva principal')

    # 3) Su extracto (con otro formato de archivo) la reconoce por el número, sin preguntar ni crear otra
    ext = extracto('bbva_5678', [(dmy(0), 'NOMINA PRACTICAS', 400, 520.0)], numero='ES12 0182 0000 1111 2222 5678')
    vista = ' | '.join(importar(pg, ext))
    res.comprobar('Cuenta: BBVA ···5678' in vista and pg.locator('select[data-cambio="cuenta-extracto"]').count() == 0, 'el extracto la reconoce por su número sin preguntar')
    pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_timeout(800)
    res.comprobar(any(t['descripcion'] == 'NOMINA PRACTICAS' and t['cuenta'] == 'bbva·5678' for t in base.tablas['pj_transacciones']), 'sus movimientos quedan en esa cuenta')
    bbva = [c for c in base.tablas['pj_cuentas'] if c.get('clave') == 'bbva·5678']  # (la simulación sustituye la fila al guardar el saldo)
    res.comprobar(len(base.tablas['pj_cuentas']) == 2 and len(bbva) == 1 and float(bbva[0]['saldo']) == 520.0, 'no se crea otra cuenta y se pone al día su saldo')

    # 4) Lo que está sin categoría también dice de qué cuenta es
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.wait_for_selector('#lista-movs')
    bizum = pg.locator('#lista-movs .fila:has-text("Bizum de Ana")').inner_text()
    res.comprobar('Sin categoría' in bizum and 'Cuenta de siempre' in bizum, 'un movimiento sin categoría enseña su cuenta')
    pg.close()

    # 5) Sin la columna «principal» (SQL sin ejecutar): no se ofrece elegirla y todo sigue funcionando
    pg = pagina(b, errores); con_sesion(pg, base_de_prueba(con_columna=False, segunda=True))
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo')
    pg.click(f'{TU_DINERO} .fila:has-text("Ahorro")'); pg.wait_for_selector('.hoja-panel')
    res.comprobar(pg.locator('[data-accion="hacer-principal"]').count() == 0, 'sin la columna no se ofrece elegir la principal')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    res.comprobar(cuenta_marcada(pg) == 'bankinter·1234', 'y la principal sigue siendo la más antigua')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    pg.close()
    b.close()

res.terminar(errores)
