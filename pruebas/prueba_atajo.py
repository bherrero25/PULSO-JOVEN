"""Atajo de Apple Pay con Supabase simulado: al abrir la app se clasifican los pagos que llegaron sin categoría (con lo
aprendido o las reglas automáticas), la hoja de configuración enseña el código personal, y sin la tabla explica qué falta."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, iso, fila

res = Resultado('Atajo de Apple Pay')
CODIGO = 'c0d1g0-de-prueba-1234'

with sync_playwright() as p:
    b = lanzar(p); errores = []
    for falta in (False, True):
        txs = [fila(id=1, fecha=iso(3), descripcion='MERCADONA VALENCIA', importe=23.4, categoria='🔧 Otros', cuenta='apple_pay'),
               fila(id=2, fecha=iso(2), descripcion='Cafetería Lola', importe=3.2, categoria='🔧 Otros', cuenta='apple_pay'),
               fila(id=3, fecha=iso(1), descripcion='Tienda Rara', importe=9.0, categoria='🔧 Otros', cuenta='apple_pay')]
        tablas = {'pj_transacciones': txs, 'pj_cuentas': [], 'pj_presupuestos': [], 'pj_metas': [],
                  'pj_reglas_categoria': [{'user_id': 'u1', 'concepto': 'cafeteria lola', 'categoria': '🎉 Ocio'}]}
        if not falta: tablas['pj_codigos_atajo'] = []
        base = Supabase(tablas, por_defecto={'pj_codigos_atajo': {'codigo': CODIGO}})
        pg = pagina(b, errores); con_sesion(pg, base)
        pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.tarjeta-tinta'); pg.wait_for_timeout(800)
        if not falta:
            cat = {t['descripcion']: t['categoria'] for t in txs}
            res.comprobar(cat['MERCADONA VALENCIA'] == '🍔 Comida', 'al abrir, un pago de Apple Pay se clasifica con las reglas automáticas')
            res.comprobar(cat['Cafetería Lola'] == '🎉 Ocio', 'y con lo aprendido para ese comercio')
            res.comprobar(cat['Tienda Rara'] == '🔧 Otros', 'lo desconocido se queda por revisar')
        pg.goto('http://pulso.prueba/nueva/#/anadir'); pg.click('[data-accion="tab-anadir"][data-valor="auto"]')
        pg.click('[data-accion="configurar-applepay"]'); pg.wait_for_selector('.hoja-panel'); pg.wait_for_timeout(300)
        texto = pg.inner_text('.hoja-panel')
        if falta:
            res.comprobar('sql/2026-11-atajo-apple-pay.sql' in texto, 'sin la tabla de códigos, explica qué falta')
        else:
            res.comprobar(CODIGO in texto and 'pj_apuntar_pago' in texto, 'la hoja enseña la dirección y el código personal')
            res.comprobar(len(base.tablas['pj_codigos_atajo']) == 1, 'el código se crea una sola vez')
            foto(pg, 'at01_hoja_atajo', False)
        pg.close()
    b.close()

res.terminar(errores)
