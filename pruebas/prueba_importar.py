"""Importar extractos con Supabase simulado: retenidos (se guardan, se cobran, se quitan si desaparecen y se ignoran si no
existe la columna), lo apuntado a mano y lo de Apple Pay se juntan con su movimiento del banco sin repetirse (también
retenido), y volver a subir el mismo extracto no duplica nada."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, extracto, importar, euros, iso, dmy, fila

res = Resultado('Importar extractos: retenidos, a mano y Apple Pay')
cuenta = lambda saldo, dias: [{'id': 'k1', 'user_id': 'u1', 'nombre': 'Bankinter', 'tipo': 'banco', 'clave': 'bankinter', 'saldo': saldo, 'fecha_saldo': iso(dias)}]
banco = lambda pg: (pg.goto('http://pulso.prueba/nueva/#/inicio'), pg.wait_for_selector('section[aria-label="Tu dinero"]'),
                    euros(pg.locator('section[aria-label="Tu dinero"] .lista-cuentas .importe').first.inner_text()))[2]

with sync_playwright() as p:
    b = lanzar(p); errores = []

    # ── 1. Retenidos ──
    for sin_columna in (False, True):
        txs = [fila(id=1, fecha=iso(3), descripcion='MERCADONA VALENCIA', importe=23.4, categoria='🍔 Comida', pendiente=True),
               fila(id=2, fecha=iso(5), descripcion='HOTEL PREAUTORIZACION', importe=100.0, categoria='🔧 Otros', pendiente=True),
               fila(id=3, fecha=iso(1), descripcion='AMAZON EU', importe=23.99, categoria='🔧 Otros', pendiente=True),
               fila(id=4, fecha=iso(20), descripcion='ZARA', importe=30.0, categoria='👕 Ropa')]
        if sin_columna: txs = [{k: v for k, v in t.items() if k != 'pendiente'} for t in txs if not t['pendiente']]
        base = Supabase({'pj_transacciones': txs, 'pj_cuentas': cuenta(500, 10), 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': []},
                        sin_columna=('pj_transacciones', 'pendiente') if sin_columna else None)
        ext = extracto('retenidos', retenidos=[(dmy(0), 'REPSOL VALENCIA', -40), (dmy(1), 'AMAZON EU', -23.99)],
                       filas=[(dmy(0), 'LIBRERIA PAPEL', -12, 464.60), (dmy(1), 'COMPRA TARJ. 5402XXXX MERCADONA VALENCIA', -23.4, 476.60), (dmy(20), 'ZARA', -30, 500.00)])
        pg = pagina(b, errores); con_sesion(pg, base)
        pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo')
        vista = ' | '.join(importar(pg, ext))
        foto(pg, f'im01_retenidos_{"sin" if sin_columna else "con"}_columna')
        pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_timeout(900)
        descripciones = [t['descripcion'] for t in txs]
        if sin_columna:
            res.comprobar('sql/2026-11-retenidos.sql' in vista, 'sin la columna de retenidos, avisa de qué falta')
            res.comprobar('REPSOL VALENCIA' not in descripciones and 'LIBRERIA PAPEL' in descripciones, 'y los ignora, pero importa lo demás')
        else:
            merc = next(t for t in txs if t['id'] == 1)
            res.comprobar(not merc['pendiente'] and merc['categoria'] == '🍔 Comida' and 'COMPRA TARJ' in merc['descripcion'], 'un retenido ya cobrado pasa a definitivo y conserva su categoría')
            res.comprobar(not any(t['id'] == 2 for t in txs), 'un retenido que ya no aparece se quita')
            res.comprobar(sum(1 for t in txs if t['descripcion'] == 'AMAZON EU') == 1, 'un retenido que sigue retenido no se repite')
            res.comprobar(any(t['descripcion'] == 'REPSOL VALENCIA' and t['pendiente'] for t in txs), 'un retenido nuevo entra como retenido')
            res.comprobar(abs(banco(pg) - (464.60 - 40 - 23.99)) < 0.005, '«Tu dinero» = saldo del extracto − lo retenido')
        pg.close()

    # ── 2. Lo apuntado a mano y lo de Apple Pay se juntan con el banco ──
    txs = [fila(id=1, fecha=iso(0), descripcion='Cena con Laura', importe=15.0, categoria='🎉 Ocio', medio='bizum', cuenta='manual'),
           fila(id=2, fecha=iso(1), descripcion='Libros clase', importe=12.0, categoria='📚 Estudios', cuenta='manual'),
           fila(id=3, fecha=iso(0), descripcion='Café', importe=5.0, categoria='🍔 Comida', medio='efectivo', cuenta='efectivo'),
           fila(id=4, fecha=iso(0), descripcion='CAFETERIA LOLA', importe=0.9, categoria='🍔 Comida', cuenta='apple_pay'),
           fila(id=5, fecha=iso(0), descripcion='PANADERIA', importe=1.2, categoria='🍔 Comida', cuenta='apple_pay'),
           fila(id=6, fecha=iso(20), descripcion='ZARA', importe=30.0, categoria='👕 Ropa')]
    base = Supabase({'pj_transacciones': txs, 'pj_cuentas': cuenta(500, 10), 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': []})
    ext1 = extracto('juntar_1', retenidos=[(dmy(0), 'LIBRERIA PAPEL', -12), (dmy(0), 'CAFETERIA LOLA VALENCIA', -0.9)],
                    filas=[(dmy(0), 'BIZUM A LAURA GARCIA', -15, 1455.00), (dmy(0), 'CAFETERIA EL PUERTO', -5, 1470.00), (dmy(0), 'NOMINA', 1000, 1475.00), (dmy(20), 'ZARA', -30, 500.00)])
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo')
    vista = ' | '.join(importar(pg, ext1)); foto(pg, 'im02_juntar')
    res.comprobar(pg.locator('input[data-cambio="par-unir"]:checked').count() == 3, 'propone juntar el Bizum, los libros (retenido) y el café de Apple Pay (retenido)')
    pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_timeout(900)
    porid = {t['id']: t for t in txs}
    res.comprobar(porid[1]['descripcion'] == 'BIZUM A LAURA GARCIA' and porid[1]['cuenta'] == 'bankinter' and porid[1]['categoria'] == '🎉 Ocio', 'lo apuntado a mano toma el concepto y la cuenta del banco y conserva su categoría')
    res.comprobar(porid[2]['pendiente'] and porid[2]['descripcion'] == 'LIBRERIA PAPEL', 'si en el banco está retenido, queda como retenido')
    res.comprobar(porid[4]['pendiente'] and porid[4]['medio'] == 'apple_pay', 'lo de Apple Pay retenido queda como retenido y sigue diciendo «Apple Pay»')
    res.comprobar(porid[3]['cuenta'] == 'efectivo' and any(t['descripcion'] == 'CAFETERIA EL PUERTO' for t in txs), 'lo pagado en efectivo no se junta con un gasto del banco del mismo importe')
    res.comprobar(sum(1 for t in txs if '15' == str(int(t['importe'])) and t['tipo'] == 'gasto') == 1, 'el Bizum no queda repetido')
    res.comprobar(abs(banco(pg) - (1455.00 - 12 - 0.9 - 1.2)) < 0.005, '«Tu dinero» resta los retenidos y lo de Apple Pay que aún no ha llegado')
    n = len(txs)
    vista = ' | '.join(importar(pg, ext1))
    res.comprobar('Todos los movimientos de este archivo ya estaban guardados' in vista and pg.locator('input[data-cambio="par-unir"]').count() == 0, 'volver a subir el mismo extracto no propone nada nuevo')
    # Días después: todo cobrado
    ext2 = extracto('juntar_2', filas=[(dmy(0), 'PANADERIA SAN JUAN', -1.2, 1440.90), (dmy(0), 'CAFETERIA LOLA VALENCIA', -0.9, 1442.10), (dmy(0), 'LIBRERIA PAPEL', -12, 1443.00),
                                      (dmy(0), 'BIZUM A LAURA GARCIA', -15, 1455.00), (dmy(0), 'CAFETERIA EL PUERTO', -5, 1470.00), (dmy(0), 'NOMINA', 1000, 1475.00), (dmy(20), 'ZARA', -30, 500.00)])
    importar(pg, ext2); pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_timeout(900)
    porid = {t['id']: t for t in txs}
    res.comprobar(len(txs) == n and not porid[2]['pendiente'] and not porid[4]['pendiente'] and porid[5]['cuenta'] == 'bankinter', 'cuando el banco cobra, los retenidos pasan a definitivos y lo de Apple Pay se junta, sin repetir nada')
    res.comprobar(porid[4]['medio'] == 'apple_pay' and porid[5]['medio'] == 'apple_pay', 'y siguen diciendo «Apple Pay»')
    res.comprobar(abs(banco(pg) - 1440.90) < 0.005, '«Tu dinero» coincide con el saldo del banco')
    pg.close()
    b.close()

res.terminar(errores)
