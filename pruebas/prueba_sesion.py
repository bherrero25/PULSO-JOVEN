"""Con sesión iniciada y Supabase simulado: lee más de 1.000 movimientos (por páginas), aprende una categoría y la aplica
a los iguales, guarda lo apuntado a mano y los presupuestos, y avisa (sin perder lo escrito) si falla al guardar."""
import datetime
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, hoy, iso, fila

res = Resultado('Sesión iniciada: lectura, reglas, altas y errores')
txs = [fila(id=i, fecha=(hoy - datetime.timedelta(days=i * 300 // 1500)).isoformat(), descripcion=f'COMERCIO {i % 40}', importe=10.0, categoria='🍔 Comida')
       for i in range(1, 1501)]  # 1.500 movimientos en los últimos 10 meses
txs += [fila(id=2000, fecha=iso(0), descripcion='TPV RARO 123', importe=15.0, categoria='🔧 Otros'),
        fila(id=2001, fecha=iso(40), descripcion='TPV RARO 123', importe=9.0, categoria='🔧 Otros')]
base = Supabase({
    'pj_transacciones': txs, 'pj_cuentas': [],
    'pj_presupuestos': [{'id': 1, 'user_id': 'u1', 'categoria': '🍔 Comida', 'limite': 300, 'mes': '2026-01'}],
    'pj_metas': [{'id': 1, 'user_id': 'u1', 'nombre': 'Viaje', 'emoji': '✈️', 'objetivo': 500, 'ahorrado': 100, 'fecha_limite': None, 'created_at': '2026-01-01'}],
    'pj_reglas_categoria': [{'user_id': 'u1', 'concepto': 'comercio 1', 'categoria': '🍔 Comida'}]})

with sync_playwright() as p:
    b = lanzar(p); errores = []
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.tarjeta-tinta')
    res.comprobar(pg.text_content('.saludo').strip() == 'Hola, Prueba', 'saluda con el nombre de la cuenta')
    res.comprobar(base.lecturas['pj_transacciones'] >= 2, 'lee los movimientos en varias páginas (más de 1.000)')
    res.comprobar(not pg.evaluate("document.querySelector('[data-accion=\"mes-anterior\"]').disabled"), 'se puede ir a meses anteriores')
    res.comprobar('300' in pg.inner_text('section[aria-label="Presupuestos"]'), 'el presupuesto de enero sigue valiendo hoy')

    # Clasificar el «por revisar»: cambia también el otro igual y guarda la regla
    pg.click('.aviso-revisar'); pg.wait_for_selector('#lista-movs')
    pg.click('#lista-movs .fila >> nth=0'); pg.wait_for_selector('.hoja-panel')
    pg.click('.rejilla-cats button:has-text("Ocio")'); pg.wait_for_timeout(600)
    res.comprobar(sum(1 for t in txs if t['descripcion'] == 'TPV RARO 123' and t['categoria'] == '🎉 Ocio') == 2, 'el cambio de categoría se aplica a los dos iguales')
    res.comprobar(any(r['concepto'] == 'tpv raro 123' and r['categoria'] == '🎉 Ocio' for r in base.tablas['pj_reglas_categoria']), 'se guarda la regla aprendida')

    # Alta manual
    pg.goto('http://pulso.prueba/nueva/#/anadir'); pg.wait_for_selector('.teclado')
    for k in ['7', ',', '5']: pg.click(f'.teclado [data-valor="{k}"]')
    pg.fill('input[data-entrada="concepto-nuevo"]', 'Café'); pg.click('[data-accion="guardar-nuevo"]'); pg.wait_for_timeout(600)
    alta = [t for t in txs if t['descripcion'] == 'Café']
    res.comprobar(len(alta) == 1 and alta[0]['importe'] == 7.5 and alta[0]['cuenta'] == 'manual', 'lo apuntado a mano se guarda (7,50 €, marcado como «a mano»)')

    # Nuevo límite de presupuesto: vale desde este mes, el de enero se conserva
    pg.goto('http://pulso.prueba/nueva/#/presupuesto'); pg.wait_for_timeout(300)
    pg.click('[data-accion="editar-presupuesto"][data-cat="🍔 Comida"]'); pg.fill('#pres-limite', '250'); pg.click('[data-accion="guardar-presupuesto"]'); pg.wait_for_timeout(500)
    meses = {(x['mes'], float(x['limite'])) for x in base.tablas['pj_presupuestos']}
    res.comprobar(('2026-01', 300.0) in meses and (hoy.strftime('%Y-%m'), 250.0) in meses, 'el límite nuevo vale desde este mes y el antiguo se conserva')

    # Error al guardar (sesión caducada): aviso visible y se queda en el formulario
    base.fallar = True
    pg.goto('http://pulso.prueba/nueva/#/anadir'); pg.wait_for_selector('.teclado')
    pg.click('.teclado [data-valor="3"]'); pg.click('[data-accion="guardar-nuevo"]'); pg.wait_for_timeout(500)
    res.comprobar(pg.is_visible('#aviso-error') and 'sesión' in pg.text_content('#aviso-error'), 'si falla al guardar, avisa de la sesión caducada')
    res.comprobar(pg.is_visible('.teclado'), 'y no se pierde lo escrito')
    foto(pg, 'se01_error_guardar', False)
    b.close()

res.terminar(errores)
