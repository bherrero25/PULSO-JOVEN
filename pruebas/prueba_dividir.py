"""Dividir un movimiento (Supabase simulado): la mensualidad con el alquiler dentro se divide en «Mensualidad» y dinero de
paso «Alquiler»; con el Bizum del alquiler asignado a «Alquiler», nada sale «de tu dinero» y lo ingresado queda igual; la
lista enseña el movimiento entero; «Igual que la última vez» repite la división del mes pasado; no deja separar más de
lo que hay; volver a subir el extracto no duplica el movimiento dividido; y sin la columna no se ofrece dividir."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, extracto, importar, euros, fila, hoy
import datetime

res = Resultado('Dividir un movimiento')
mes = hoy.strftime('%Y-%m')
fin_mes = lambda n: (hoy.replace(day=1) - datetime.timedelta(days=1 + 31 * n)).replace(day=1)  # primer día de hace n+1 meses
ultimo_dia = lambda d: ((d.replace(day=28) + datetime.timedelta(days=4)).replace(day=1) - datetime.timedelta(days=1))
m1, m2 = ultimo_dia(fin_mes(0)), ultimo_dia(fin_mes(1))  # último día del mes pasado y del anterior (cuentan para el mes siguiente)
d = lambda n: f'{mes}-{min(n, hoy.day, 25):02d}'
ingresado = lambda pg: euros(pg.inner_text('.tarjeta-tinta .dato:has-text("Ingresado") b'))
SECCION = 'section[aria-label="Dinero de paso"]'
R = '↩️ Reenviado'


def datos(con_columnas=True):
    extra = {'paso': None, 'partes': None} if con_columnas else {}
    txs = [fila(id=1, fecha=m1.isoformat(), descripcion='TRANSFERENCIA DE PAPA', importe=686, tipo='ingreso', medio='transferencia', categoria='💰 Mensualidad', **extra),
           fila(id=2, fecha=d(2), descripcion='BIZUM A MAMA', importe=300, medio='bizum', categoria=R, **extra),
           fila(id=3, fecha=d(3), descripcion='MERCADONA', importe=40, categoria='🍔 Comida', **extra),
           fila(id=4, fecha=m2.isoformat(), descripcion='TRANSFERENCIA DE PAPA', importe=686, tipo='ingreso', medio='transferencia', categoria='💰 Mensualidad', **extra)]
    if con_columnas: txs[3]['partes'] = None
    return txs, Supabase({'pj_transacciones': txs, 'pj_cuentas': [], 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': [], 'pj_fijos': []})


def abrir_mensualidad(pg, cual):
    """Abre la mensualidad de este mes (cual=0, la del último día del mes pasado) o la del mes anterior (cual=1)."""
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.reload(); pg.wait_for_selector('#lista-movs')  # al recargar, vuelve al mes actual
    for _ in range(cual): pg.click('[data-accion="mes-anterior"]'); pg.wait_for_timeout(150)
    pg.click('#lista-movs .fila:has-text("686,00")'); pg.wait_for_selector('.hoja-panel')


with sync_playwright() as p:
    b = lanzar(p); errores = []
    txs, base = datos()
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.tarjeta-tinta')
    i0 = ingresado(pg)
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(SECCION)
    res.comprobar('De tu dinero' in pg.inner_text(SECCION), 'antes, el alquiler sale «De tu dinero»')

    # Dividir la mensualidad de este mes: 300 € son dinero de paso para el alquiler
    abrir_mensualidad(pg, 0)
    pg.click('[data-accion="dividir-mov"]'); pg.wait_for_selector('#parte-importe')
    res.comprobar(pg.is_visible('#parte-paso'), 'por defecto, la parte es dinero de paso y pregunta para qué')
    pg.fill('#parte-importe', '700'); pg.click('[data-accion="anadir-parte"]'); pg.wait_for_timeout(200)
    res.comprobar('Como mucho' in pg.inner_text('#toast') and not txs[0]['partes'], 'no deja separar más de lo que tiene el movimiento')
    pg.fill('#parte-importe', '300'); pg.fill('#parte-paso', 'Alquiler'); pg.click('[data-accion="anadir-parte"]'); pg.wait_for_timeout(400)
    res.comprobar(txs[0]['partes'] == [{'importe': 300, 'categoria': R, 'paso': 'Alquiler'}], 'se guarda la parte en el mismo movimiento (sigue siendo uno)')
    res.comprobar('El resto: Mensualidad' in pg.inner_text('.hoja-panel') and '386,00' in pg.inner_text('.hoja-panel'), 'enseña lo que queda en la categoría del movimiento')
    foto(pg, 'dv01_dividir', False)
    pg.keyboard.press('Escape')

    # El Bizum del alquiler, para «Alquiler»: se compensa con la parte de la mensualidad
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(SECCION)
    res.comprobar('300,00 € en espera' in pg.inner_text(f'{SECCION} details:has(.concepto:text-is("Alquiler"))'), 'la parte de la mensualidad llega como dinero de paso «Alquiler»')
    pg.click(f'{SECCION} details:has(.concepto:text-is("De tu dinero")) summary'); pg.click(f'{SECCION} details:has(.concepto:text-is("De tu dinero")) [data-accion="elegir-paso"]')
    pg.click('[data-accion="poner-paso"][data-paso="Alquiler"]'); pg.wait_for_timeout(400)
    texto = pg.inner_text(SECCION)
    res.comprobar('De tu dinero' not in texto and 'se compensan' in pg.inner_text(f'{SECCION} details:has(.concepto:text-is("Alquiler"))'), 'con el Bizum en «Alquiler», ya no sale nada de tu dinero: se compensan')
    foto(pg, 'dv02_resumen')
    pg.goto('http://pulso.prueba/nueva/#/inicio'); pg.wait_for_selector('.tarjeta-tinta')
    res.comprobar(abs(ingresado(pg) - i0) < 0.005, 'lo ingresado del mes es el mismo (686 − 300), pero ahora el alquiler no sale de tu dinero')
    # La del mes anterior: «Igual que la última vez»
    abrir_mensualidad(pg, 1)
    pg.click('[data-accion="dividir-mov"]'); pg.wait_for_selector('[data-accion="repetir-division"]')
    res.comprobar('Igual que la última vez' in pg.inner_text('[data-accion="repetir-division"]'), 'otra mensualidad igual ofrece dividirla igual que la última vez')
    pg.click('[data-accion="repetir-division"]'); pg.wait_for_timeout(400)
    res.comprobar(txs[3]['partes'] == txs[0]['partes'], 'y la divide igual con un toque')
    pg.keyboard.press('Escape')
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.reload(); pg.wait_for_selector('#lista-movs')
    texto = pg.locator('#lista-movs .fila:has-text("686,00")').first.inner_text()
    res.comprobar('dividido' in texto and '686,00' in texto, 'en la lista se ve entero, marcado como dividido')

    # Volver a subir el extracto con la mensualidad dividida no la duplica
    ext = extracto('dividir', [(m1.strftime('%d/%m/%Y'), 'TRANSFERENCIA DE PAPA', 686, 1686.0), (d(3)[8:] + '/' + d(3)[5:7] + '/' + d(3)[:4], 'MERCADONA', -40, 1646.0)])
    vista = ' | '.join(importar(pg, ext))
    res.comprobar(sum(1 for t in txs if t['descripcion'] == 'TRANSFERENCIA DE PAPA' and t['fecha'] == m1.isoformat()) == 1 and 'Ya estaban' in vista, 'volver a subir el extracto no duplica el movimiento dividido')
    pg.click('[data-accion="cancelar-importacion"]')

    # Quitar la división
    abrir_mensualidad(pg, 0)
    pg.click('[data-accion="dividir-mov"]'); pg.click('[data-accion="quitar-division"]'); pg.click('#conf-si'); pg.wait_for_timeout(400)
    res.comprobar(txs[0]['partes'] is None, '«Quitar la división» lo deja entero')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    pg.close()

    # ── Sin la columna: no se ofrece dividir ──
    txs, base = datos(con_columnas=False)
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.tarjeta-tinta')
    abrir_mensualidad(pg, 0)
    res.comprobar(pg.locator('[data-accion="dividir-mov"]').count() == 0, 'sin la columna no se ofrece dividir')
    b.close()

res.terminar(errores)
