"""¿Llego a fin de mes? (Supabase simulado; las cuentas se hacen con la fecha de hoy, así que se comprueba lo que no depende
de ella): sale la tarjeta en el mes en curso y no en uno pasado, el semáforo dice «no» si se gasta más de lo que entra y
«sí» si sobra, la cifra de la tarjeta y la del desglose coinciden, lo que falta de los fijos se cuenta, y con menos de una
semana de datos no se adivina nada."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, euros, fila, hoy
import datetime

res = Resultado('¿Llego a fin de mes?')
TARJETA = '[data-accion="ver-prevision"]'
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
    res.comprobar(pg.is_visible(TARJETA), 'en el mes en curso sale «¿Llegas a fin de mes?»')
    texto = pg.inner_text(TARJETA)
    res.comprobar('A este ritmo, no' in texto and 'saldrá de tus ahorros' in texto and '0 € al día' not in texto, 'si ya se ha gastado más de lo que entra, dice que no (sin «gasta como mucho 0 €»)')
    tarjeta = euros(pg.inner_text(f'{TARJETA} .cifra-m'))
    foto(pg, 'fm01_no_llega')
    pg.click(TARJETA); pg.wait_for_selector('.hoja-panel')
    hoja = pg.inner_text('.hoja-panel')
    total = euros(pg.locator('.hoja-panel b.num').last.inner_text())
    res.comprobar(abs(round(tarjeta) - round(total)) <= 1 and total < 0, 'la cifra de la tarjeta y la del desglose coinciden')
    res.comprobar('unos 30,00 €' in hoja, 'lo que se suele gastar sale de la semana típica (la compra grande suelta no lo cambia)')
    res.comprobar('saldrá de tus ahorros' in hoja, 'el desglose explica que ya no queda margen')
    res.comprobar('Configurar movimientos fijos' in hoja, 'sin movimientos fijos, sugiere configurarlos')
    foto(pg, 'fm02_desglose', False)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # Un mes pasado no tiene previsión
    pg.click('[data-accion="mes-anterior"]')
    pg.wait_for_timeout(200)
    res.comprobar(not pg.is_visible(TARJETA), 'en un mes pasado no sale')
    pg.close()

    # ── Llega con margen, y cuenta lo que falta de un fijo ──
    dia_fijo = 28
    fijos = [{'id': 'f1', 'user_id': 'u1', 'nombre': 'Beca comedor', 'tipo': 'ingreso', 'categoria': '💰 Nómina', 'importe': 150, 'dia': dia_fijo,
              'medio': 'transferencia', 'activo': True, 'ultimo': None, 'creado': '2026-01-01T00:00:00Z'}]
    pg = abrir(b, errores, base(3000, 5, fijos))
    texto = pg.inner_text(TARJETA)
    res.comprobar('Sí, con margen' in texto, 'si sobra, dice que sí')
    pg.click(TARJETA); pg.wait_for_selector('.hoja-panel')
    hoja = pg.inner_text('.hoja-panel')
    res.comprobar('puedes gastar hasta' in hoja, 'con margen, dice cuánto se puede gastar al día')
    if hoy.day < dia_fijo:
        res.comprobar('Beca comedor · día 28' in hoja, 'un fijo que aún no ha llegado este mes se cuenta en la previsión')
    else:
        res.comprobar('Beca comedor' not in hoja, 'un fijo cuyo día ya ha pasado no se cuenta otra vez')
    res.comprobar('Configurar movimientos fijos' not in hoja, 'con fijos, no sugiere configurarlos')
    pg.close()

    # ── Va bien de momento pero a este ritmo no llega: dice cuánto gastar como mucho ──
    pg = abrir(b, errores, base(30 * hoy.day + 20, 30))
    texto = pg.inner_text(TARJETA)
    if hoy.day < 28:  # quedan días suficientes para que el ritmo se coma lo que sobra
        res.comprobar('A este ritmo, no' in texto and 'gasta como mucho' in texto, 'si aún sobra pero a este ritmo no llega, dice cuánto gastar como mucho al día')
    pg.close()

    # ── Menos de una semana de datos: no adivina ──
    pg = abrir(b, errores, base(500, 10, dias_historia=3))
    res.comprobar(not pg.is_visible(TARJETA) and pg.is_visible('.tarjeta-tinta'), 'con menos de una semana de movimientos no hay previsión')
    pg.close()

    # ── Demo ──
    pg = pagina(b, errores); pg.goto('http://pulso.prueba/nueva/?demo'); pg.wait_for_selector(TARJETA)
    foto(pg, 'fm03_demo')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    b.close()

res.terminar(errores)
