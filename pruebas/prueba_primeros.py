"""Primeros pasos: una cuenta nueva ve la bienvenida en lugar del balance; cada paso se marca solo al hacerlo, los botones
llevan al sitio, la tarjeta se puede ocultar (y sigue oculta al recargar), los pasos sin tabla no salen, y ni la demo ni
una cuenta completa la ven."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, apuntar, iso, fila

res = Resultado('Primeros pasos')
PASOS = 'section[aria-label="Primeros pasos"]'
vacias = lambda: {'pj_transacciones': [], 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': [], 'pj_cuentas': [], 'pj_fijos': []}
hechos = lambda pg: pg.locator(f'{PASOS} .primeros > li.hecho').count()


def abrir(pg, url='http://pulso.prueba/nueva/'):
    pg.goto(url); pg.wait_for_selector('.saludo'); pg.wait_for_timeout(300)


with sync_playwright() as p:
    b = lanzar(p); errores = []

    # ── Cuenta nueva, con todas las tablas ──
    base = Supabase(vacias())
    pg = pagina(b, errores); con_sesion(pg, base); abrir(pg)
    res.comprobar(pg.is_visible(PASOS) and not pg.is_visible('.tarjeta-tinta'), 'una cuenta vacía ve la bienvenida en lugar del balance a cero')
    res.comprobar(pg.locator(f'{PASOS} .primeros > li').count() == 5 and hechos(pg) == 0, 'con los cinco pasos, ninguno hecho')
    res.comprobar(pg.is_visible('.rapidos') and not pg.is_visible('section[aria-label="Últimos movimientos"]'), 'mantiene los botones de apuntar y quita las tarjetas vacías')
    foto(pg, 'pp01_bienvenida')
    # Paso «Cuánto tienes»: abre la hoja de la cuenta y, al guardar, se marca
    pg.click(f'{PASOS} [data-accion="editar-cuenta"]'); pg.wait_for_selector('#cuenta-nombre')
    pg.fill('#cuenta-nombre', 'Hucha'); pg.fill('#cuenta-saldo', '50'); pg.click('[data-accion="guardar-cuenta"]'); pg.wait_for_timeout(400)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    res.comprobar(hechos(pg) == 1 and pg.is_visible(f'{PASOS} .primeros > li.hecho:has-text("Cuánto tienes")'), 'al añadir una cuenta, el paso se marca solo')
    res.comprobar(pg.is_visible('section[aria-label="Tu dinero"]'), 'y aparece «Tu dinero» con la cuenta')
    # «Subir extracto» abre Añadir en la pestaña del extracto
    pg.click(f'{PASOS} a:has-text("Subir extracto")'); pg.wait_for_selector('.pantalla-anadir')
    res.comprobar(pg.get_attribute('[data-accion="tab-anadir"][data-valor="extracto"]', 'aria-selected') == 'true', '«Subir extracto» abre la pestaña del extracto')
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector(PASOS)
    # «Apuntar a mano» abre el formulario; con el primer movimiento vuelve el balance y queda la tarjeta con lo que falta
    pg.click(f'{PASOS} a:has-text("Apuntar a mano")'); pg.wait_for_selector('.teclado')
    res.comprobar(pg.get_attribute('[data-accion="tab-anadir"][data-valor="mano"]', 'aria-selected') == 'true', '«Apuntar a mano» abre el formulario')
    apuntar(pg, 'gasto', '12', 'comida', iso(0), 'tarjeta', 'Menú del día')
    res.comprobar(pg.is_visible('.tarjeta-tinta'), 'con el primer movimiento vuelve el balance')
    res.comprobar('2 de 5' in pg.inner_text(PASOS) and hechos(pg) == 2, 'y queda la tarjeta «Primeros pasos · 2 de 5»')
    foto(pg, 'pp02_tarjeta')
    # Ocultar: desaparece y sigue oculta al recargar
    pg.click(f'{PASOS} [data-accion="ocultar-primeros"]'); pg.wait_for_timeout(200)
    res.comprobar(not pg.is_visible(PASOS), '«Ocultar» la quita')
    pg.reload(); pg.wait_for_selector('.saludo'); pg.wait_for_timeout(300)
    res.comprobar(not pg.is_visible(PASOS), 'y sigue oculta al recargar')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    pg.close()

    # ── En el ordenador ──
    pg = pagina(b, errores, 1280, 860); con_sesion(pg, Supabase(vacias())); abrir(pg)
    res.comprobar(pg.is_visible(PASOS) and not pg.is_visible('.tarjeta-tinta'), 'en el ordenador también sale la bienvenida')
    foto(pg, 'pp03_ordenador', False)
    pg.close()

    # ── Sin las tablas de cuentas y fijos: esos pasos no salen ──
    t = vacias(); del t['pj_cuentas'], t['pj_fijos']
    pg = pagina(b, errores); con_sesion(pg, Supabase(t)); abrir(pg)
    textos = pg.inner_text(PASOS)
    res.comprobar(pg.locator(f'{PASOS} .primeros > li').count() == 3 and 'Cuánto tienes' not in textos and 'Lo que llega' not in textos, 'sin las tablas de cuentas y fijos, solo los tres pasos que se pueden hacer')
    pg.close()

    # ── Cuenta completa: no sale nada ──
    t = vacias()
    t['pj_transacciones'] = [fila(id=1, fecha=iso(2), descripcion='MERCADONA', importe=30.0, categoria='🍔 Comida')]
    t['pj_cuentas'] = [{'id': 'k1', 'user_id': 'u1', 'nombre': 'Hucha', 'tipo': 'ahorro', 'clave': None, 'saldo': 50, 'fecha_saldo': iso(1)}]
    t['pj_fijos'] = [{'id': 'f1', 'user_id': 'u1', 'nombre': 'Beca', 'tipo': 'ingreso', 'categoria': '💰 Nómina', 'importe': 100, 'dia': 28, 'medio': 'transferencia', 'activo': True, 'ultimo': iso(0), 'creado': '2026-11-01T00:00:00Z'}]
    t['pj_presupuestos'] = [{'id': 1, 'user_id': 'u1', 'categoria': '🍔 Comida', 'limite': 200, 'mes': iso(0)[:7]}]
    t['pj_metas'] = [{'id': 1, 'user_id': 'u1', 'nombre': 'Viaje', 'emoji': '✈️', 'objetivo': 600, 'ahorrado': 100, 'fecha_limite': None}]
    pg = pagina(b, errores); con_sesion(pg, Supabase(t)); abrir(pg)
    res.comprobar(pg.is_visible('.tarjeta-tinta') and not pg.is_visible(PASOS), 'con todo hecho no aparece')
    pg.close()

    # ── Demo: nunca ──
    pg = pagina(b, errores); abrir(pg, 'http://pulso.prueba/nueva/?demo')
    res.comprobar(not pg.is_visible(PASOS), 'la demo no la enseña')
    pg.close()
    b.close()

res.terminar(errores)
