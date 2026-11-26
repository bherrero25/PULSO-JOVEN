"""¿Llego a fin de mes? (Supabase simulado; las cuentas se hacen con la fecha de hoy, así que se comprueba lo que no depende
de ella): en Inicio, una línea dentro del balance que lleva a Resumen, donde está el apartado completo; solo en el mes en
curso; el semáforo dice «no» si se gasta más de lo que entra y «sí» si sobra; la cifra de Inicio y la de Resumen coinciden;
lo que falta de los fijos se cuenta; y con menos de una semana de datos no se adivina nada."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, euros, fila, hoy
import datetime

res = Resultado('¿Llego a fin de mes?')
LINEA = '.tarjeta-tinta .linea-prevision'
APARTADO = 'section[aria-label="¿Llegas a fin de mes?"]'
mes = hoy.strftime('%Y-%m')
iso = lambda d: d.isoformat()


def base(ingreso, diario, fijos=(), dias_historia=70):
    nuevo = dias_historia < 7  # cuenta recién empezada: todo es de estos días
    txs = [fila(id=1, fecha=iso(hoy) if nuevo else f'{mes}-01', descripcion='TRANSFERENCIA DE CASA', importe=ingreso, tipo='ingreso', medio='transferencia', categoria='💰 Nómina')]
    for n in range(1, dias_historia + 1):  # gasto del día a día, de ayer hacia atrás (y alguno grande suelto)
        txs.append(fila(id=100 + n, fecha=iso(hoy - datetime.timedelta(days=n)), descripcion=f'SUPERMERCADO {n}', importe=diario, categoria='🍔 Comida'))
    if not nuevo: txs.append(fila(id=99, fecha=iso(hoy - datetime.timedelta(days=40)), descripcion='TIENDA DE ORDENADORES', importe=900.0, categoria='💻 Tecnología'))
    return Supabase({'pj_transacciones': txs, 'pj_cuentas': [], 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': [], 'pj_fijos': list(fijos)})


def abrir(b, errores, sb):
    pg = pagina(b, errores); con_sesion(pg, sb)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo'); pg.wait_for_timeout(300)
    return pg


with sync_playwright() as p:
    b = lanzar(p); errores = []

    # ── No llega: entra poco y se gasta mucho cada día ──
    pg = abrir(b, errores, base(100, 30))
    res.comprobar(pg.is_visible(LINEA) and pg.locator('section.tarjeta[aria-label="¿Llegas a fin de mes?"]').count() == 0, 'en Inicio es una línea dentro del balance, no una tarjeta más')
    res.comprobar('no llegas' in pg.inner_text(LINEA) and 'Has gastado el' not in pg.inner_text('.tarjeta-tinta'), 'la línea dice que no llega (en lugar de «Has gastado el X %»)')
    en_inicio = euros(pg.inner_text(f'{LINEA} b').replace('≈', ''))
    foto(pg, 'fm01_inicio')
    pg.click(LINEA); pg.wait_for_selector(APARTADO)
    res.comprobar('#/resumen' in pg.url, 'tocarla lleva a Resumen')
    texto = pg.inner_text(APARTADO)
    total = euros(pg.locator(f'{APARTADO} b.num').last.inner_text())
    res.comprobar('A este ritmo, no' in texto and 'saldrá de tus ahorros' in texto and 'como mucho' not in texto, 'si ya se ha gastado más de lo que entra, dice que no (sin «gasta como mucho 0 €»)')
    res.comprobar(abs(round(en_inicio) - round(total)) <= 1 and total < 0, 'la cifra de Inicio y la del desglose de Resumen coinciden')
    res.comprobar('unos 30,00 €' in texto, 'lo que se suele gastar sale de la semana típica (la compra grande suelta no lo cambia)')
    res.comprobar('Configurar movimientos fijos' in texto, 'sin movimientos fijos, sugiere configurarlos')
    res.comprobar('A este ritmo acabarás' not in pg.inner_text('.contenido'), 'la comparación de Resumen ya no hace su propia cuenta (no hay dos previsiones distintas)')
    foto(pg, 'fm02_resumen')
    # Un mes pasado no tiene previsión, ni en Resumen ni en Inicio
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector('.saludo')
    pg.click('[data-accion="mes-anterior"]'); pg.wait_for_timeout(200)
    res.comprobar(not pg.is_visible(LINEA), 'en un mes pasado no sale en Inicio')
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector('.titulo')
    res.comprobar(not pg.is_visible(APARTADO), 'ni en Resumen')
    pg.close()

    # ── Llega con margen, y cuenta lo que falta de un fijo ──
    dia_fijo = 28
    fijos = [{'id': 'f1', 'user_id': 'u1', 'nombre': 'Beca comedor', 'tipo': 'ingreso', 'categoria': '💰 Nómina', 'importe': 150, 'dia': dia_fijo,
              'medio': 'transferencia', 'activo': True, 'ultimo': None, 'creado': '2026-01-01T00:00:00Z'}]
    pg = abrir(b, errores, base(3000, 5, fijos))
    res.comprobar('con margen' in pg.inner_text(LINEA), 'si sobra, la línea lo dice')
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(APARTADO)
    texto = pg.inner_text(APARTADO)
    res.comprobar('Sí, con margen' in texto and 'puedes gastar hasta' in texto, 'en Resumen dice que sí y cuánto se puede gastar al día')
    if hoy.day < dia_fijo:
        res.comprobar('Beca comedor · día 28' in texto, 'un fijo que aún no ha llegado este mes se cuenta en la previsión')
    else:
        res.comprobar('Beca comedor' not in texto, 'un fijo cuyo día ya ha pasado no se cuenta otra vez')
    res.comprobar('Configurar movimientos fijos' not in texto, 'con fijos, no sugiere configurarlos')
    pg.close()

    # ── Va bien de momento pero a este ritmo no llega ──
    pg = abrir(b, errores, base(30 * hoy.day + 20, 30))
    if hoy.day < 28:  # quedan días suficientes para que el ritmo se coma lo que sobra
        pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(APARTADO)
        res.comprobar('A este ritmo, no' in pg.inner_text(APARTADO) and 'puedes gastar hasta' in pg.inner_text(APARTADO), 'si aún sobra pero a este ritmo no llega, dice cuánto gastar como mucho al día')
    pg.close()

    # ── Menos de una semana de datos: no adivina ──
    pg = abrir(b, errores, base(500, 10, dias_historia=3))
    res.comprobar(not pg.is_visible(LINEA) and 'Has gastado el' in pg.inner_text('.tarjeta-tinta'), 'con menos de una semana de movimientos no hay previsión (el balance queda como siempre)')
    pg.close()

    # ── Demo ──
    pg = pagina(b, errores); pg.goto('http://pulso.prueba/nueva/?demo'); pg.wait_for_selector(LINEA)
    foto(pg, 'fm03_demo')
    pg.click(LINEA); pg.wait_for_selector(APARTADO)
    foto(pg, 'fm04_demo_resumen')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    b.close()

res.terminar(errores)
