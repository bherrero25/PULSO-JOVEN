"""Seguridad: el concepto de un Bizum o una transferencia lo escribe quien te lo envía y llega en tu extracto. Si lleva
código, ninguna página (app nueva, app antigua, informe) debe ejecutarlo: se enseña como texto. Lo mismo con nombres
de cuentas, metas, categorías y lo que sale en los avisos."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, extracto, importar, iso, dmy, fila

res = Resultado('Seguridad: textos con código no se ejecutan')
ATAQUE = '<img src=x onerror="window.__ataque=(window.__ataque||0)+1">'
txs = [fila(id=1, fecha=iso(1), descripcion=f'BIZUM DE ALGUIEN {ATAQUE}', importe=1, tipo='ingreso', categoria='📱 Bizum recibido', medio='bizum'),
       fila(id=2, fecha=iso(2), descripcion=f'TRANSF INM /{ATAQUE}', importe=5, tipo='ingreso', categoria=f'💥 {ATAQUE}'),
       fila(id=3, fecha=iso(3), descripcion='MERCADONA', importe=20, categoria='🍔 Comida'),
       fila(id=4, fecha=iso(0), descripcion=f'Apuntado {ATAQUE}', importe=3, categoria='🍔 Comida', cuenta='manual')]
tablas = lambda: {'pj_transacciones': [dict(t) for t in txs], 'pj_reglas_categoria': [],
                  'pj_cuentas': [{'id': 'k1', 'user_id': 'u1', 'nombre': f'Cuenta {ATAQUE}', 'tipo': 'ahorro', 'clave': None, 'saldo': 100, 'fecha_saldo': iso(5)}],
                  'pj_presupuestos': [{'id': 1, 'user_id': 'u1', 'categoria': f'💥 {ATAQUE}', 'limite': 50, 'mes': '2026-01'}],
                  'pj_metas': [{'id': 1, 'user_id': 'u1', 'nombre': f'Meta {ATAQUE}', 'emoji': ATAQUE, 'objetivo': 500, 'ahorrado': 100, 'fecha_limite': None, 'created_at': '2026-01-01'}],
                  'pj_fijos': [{'id': 'f1', 'user_id': 'u1', 'nombre': f'Fijo {ATAQUE}', 'tipo': 'ingreso', 'categoria': '💰 Nómina', 'importe': 10, 'dia': 1, 'medio': 'transferencia', 'activo': True, 'ultimo': iso(0), 'creado': '2026-10-01'}]}
ataques = lambda pg: pg.evaluate('window.__ataque || 0')

with sync_playwright() as p:
    b = lanzar(p); errores = []

    # ── App nueva: todas las pantallas, la vista previa de un extracto y los avisos ──
    pg = pagina(b, errores); con_sesion(pg, Supabase(tablas()))
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.tarjeta-tinta')
    for ruta in ('movimientos', 'resumen', 'presupuesto', 'metas', 'inicio'):
        pg.goto(f'http://pulso.prueba/nueva/#/{ruta}'); pg.wait_for_timeout(400)
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.wait_for_selector('#lista-movs')
    res.comprobar('<img' in pg.inner_text('#lista-movs'), 'app nueva: el concepto con código se enseña como texto')
    pg.locator('#lista-movs .fila').first.click(); pg.wait_for_timeout(300)
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector('section[aria-label="Tu dinero"]')
    pg.click('[data-accion="gestionar-cuentas"]'); pg.wait_for_timeout(300)
    pg.goto('http://pulso.prueba/nueva/#/metas'); pg.wait_for_timeout(300)
    pg.click('[data-accion="aportar-rapido"] >> nth=0'); pg.wait_for_timeout(400)  # aviso con el nombre de la meta
    res.comprobar('<img' in pg.inner_text('#toast'), 'app nueva: los avisos enseñan los nombres como texto')
    pg.goto('http://pulso.prueba/nueva/#/anadir'); pg.click('[data-accion="tab-anadir"][data-valor="auto"]'); pg.click('[data-accion="gestionar-fijos"]'); pg.wait_for_timeout(300)
    pg.keyboard.press('Escape')
    importar(pg, extracto('ataque', [(dmy(0), f'BIZUM DE OTRA {ATAQUE}', 2, 100.0)]))
    res.comprobar(ataques(pg) == 0, 'app nueva: ningún texto con código se ha ejecutado (pantallas, hojas, avisos y vista previa)')
    pg.close()

    # ── App antigua (sigue en la dirección principal) ──
    pg = pagina(b, errores); con_sesion(pg, Supabase(tablas()))
    pg.goto('http://pulso.prueba/app.html'); pg.wait_for_timeout(2500)
    for pestaña in ('Movimientos', 'Presupuesto', 'Metas'):
        boton = pg.locator(f'button:has-text("{pestaña}"), .nav-item:has-text("{pestaña}"), .tab:has-text("{pestaña}")').first
        if boton.count(): boton.click(); pg.wait_for_timeout(400)
    res.comprobar('<img' in pg.inner_text('body'), 'app antigua: el concepto con código se enseña como texto')
    res.comprobar(ataques(pg) == 0, 'app antigua: ningún texto con código se ha ejecutado')
    pg.close()

    # ── Informe mensual ──
    pg = pagina(b, errores); con_sesion(pg, Supabase(tablas()))
    pg.goto('http://pulso.prueba/informe.html'); pg.wait_for_timeout(2500)
    res.comprobar(ataques(pg) == 0, 'informe: ningún texto con código se ha ejecutado')
    b.close()

# Errores esperables: la imagen «x» no existe y las librerías de gráficos/fuentes que se cortan
res.terminar([e for e in errores if 'status of 404' not in e and 'Failed to load resource' not in e])
