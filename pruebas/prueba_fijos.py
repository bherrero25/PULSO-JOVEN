"""Movimientos fijos: se configuran desde Añadir → Automático (demo); con Supabase simulado, el previsto se crea el día que
toca y no se repite al recargar, se junta con el real del extracto aunque cambie el importe, y sin la tabla la app sigue."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, extracto, importar, hoy, iso, dmy, fila
import datetime

res = Resultado('Movimientos fijos')

with sync_playwright() as p:
    b = lanzar(p); errores = []

    # ── Configurarlos (demo) ──
    pg = pagina(b, errores)
    pg.goto('http://pulso.prueba/nueva/?demo#/anadir'); pg.wait_for_selector('.teclado')
    pg.click('[data-accion="tab-anadir"][data-valor="auto"]'); pg.click('[data-accion="gestionar-fijos"]'); pg.wait_for_selector('.hoja-panel')
    antes = pg.locator('.hoja-panel [data-accion="editar-fijo"]:not([data-id=""])').count()
    pg.click('.hoja-panel [data-accion="editar-fijo"][data-id=""]'); pg.wait_for_selector('#fijo-nombre')
    pg.click('[data-accion="tipo-fijo"][data-valor="gasto"]')
    res.comprobar(pg.eval_on_selector('#fijo-categoria', 'e => e.options[e.selectedIndex].text') == 'Alquiler', 'un fijo de «Pago» propone Alquiler')
    pg.fill('#fijo-nombre', 'Alquiler del piso'); pg.fill('#fijo-importe', '350'); pg.fill('#fijo-dia', '40'); pg.click('[data-accion="guardar-fijo"]'); pg.wait_for_timeout(200)
    res.comprobar('del 1 al 31' in pg.inner_text('#toast'), 'no deja guardar un día que no existe')
    pg.fill('#fijo-dia', '1'); pg.click('[data-accion="guardar-fijo"]'); pg.wait_for_timeout(300)
    res.comprobar(pg.locator('.hoja-panel [data-accion="editar-fijo"]:not([data-id=""])').count() == antes + 1, 'el fijo nuevo aparece en la lista')
    res.comprobar('el próximo' in pg.inner_text('#toast'), 'y dice cuándo se apuntará el próximo')
    foto(pg, 'fi01_fijos', False)
    pg.close()

    # ── Con Supabase simulado ──
    dia = max(1, hoy.day - 1)
    mes_ant = hoy.replace(day=1) - datetime.timedelta(days=1)
    fijos = [{'id': 'f1', 'user_id': 'u1', 'nombre': 'Mensualidad', 'tipo': 'ingreso', 'categoria': '💰 Mensualidad', 'importe': 470, 'dia': dia, 'medio': 'transferencia',
              'activo': True, 'ultimo': mes_ant.replace(day=min(dia, mes_ant.day)).isoformat(), 'creado': '2026-10-01T00:00:00Z'}]
    txs = [fila(id=3, fecha=iso(20), descripcion='ZARA', importe=30.0, categoria='👕 Ropa')]
    cuentas = [{'id': 'k1', 'user_id': 'u1', 'nombre': 'Bankinter', 'tipo': 'banco', 'clave': 'bankinter', 'saldo': 500, 'fecha_saldo': iso(10)}]
    base = Supabase({'pj_fijos': fijos, 'pj_transacciones': txs, 'pj_cuentas': cuentas, 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': []})
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.tarjeta-tinta'); pg.wait_for_timeout(800)
    previstos = [t for t in txs if t['cuenta'] == 'previsto']
    res.comprobar(len(previstos) == 1 and previstos[0]['importe'] == 470, 'al abrir se crea la mensualidad prevista del día que tocaba')
    res.comprobar(fijos[0]['ultimo'] == previstos[0]['fecha'], 'y se apunta hasta cuándo se ha creado')
    pg.reload(); pg.wait_for_selector('.tarjeta-tinta'); pg.wait_for_timeout(800)
    res.comprobar(len([t for t in txs if t['cuenta'] == 'previsto']) == 1, 'al recargar no se repite')
    ext = extracto('fijos', [(dmy(0), 'TRANSF INM /PADRE GARCIA', 480, 950.00), (dmy(20), 'ZARA', -30, 470.00)])
    importar(pg, ext)
    res.comprobar(pg.locator('input[data-cambio="par-unir"]:checked').count() == 1, 'al importar propone juntarla con la transferencia real (480 €)')
    pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_timeout(900)
    real = next(t for t in txs if t['id'] == previstos[0]['id'])
    res.comprobar(real['importe'] == 480 and real['cuenta'] == 'bankinter' and real['categoria'] == '💰 Mensualidad', 'se queda el importe del banco y la categoría Mensualidad')
    res.comprobar(not any(t['cuenta'] == 'previsto' for t in txs) and len(txs) == 2, 'sin repetidos')
    pg.close()

    # ── Sin la tabla de fijos ──
    base = Supabase({'pj_transacciones': [], 'pj_cuentas': [], 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': []})
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/#/anadir'); pg.wait_for_selector('.teclado')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin la tabla de fijos la app abre sin errores')
    pg.click('[data-accion="tab-anadir"][data-valor="auto"]'); pg.click('[data-accion="gestionar-fijos"]'); pg.wait_for_selector('.hoja-panel')
    res.comprobar('sql/2026-11-fijos.sql' in pg.inner_text('.hoja-panel'), 'y al abrir los fijos explica qué falta')
    b.close()

res.terminar(errores)
