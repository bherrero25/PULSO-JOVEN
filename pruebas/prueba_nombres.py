"""Nombres limpios con Supabase simulado: la lista enseña el nombre limpio y la forma de pago correcta (también en lo
importado antes), al abrir un movimiento se ve el concepto original, el buscador encuentra por los dos, lo escrito a mano
no se toca y lo que se importa ahora se guarda con la forma de pago bien detectada."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, extracto, importar, iso, dmy, fila

res = Resultado('Nombres limpios y forma de pago')
txs = [fila(id=1, fecha=iso(2), descripcion='COMPRA TARJ. 5402XXXXXXXX1234 MERCADONA VALENCIA', importe=23.4, categoria='🍔 Comida', medio='transferencia'),
       fila(id=2, fecha=iso(3), descripcion='TRANSF INM /JOSE MARTINEZ PEREZ', importe=50, tipo='ingreso', categoria='💰 Ingresos', medio='transferencia'),
       fila(id=3, fecha=iso(1), descripcion='cena en mercadona', importe=12, categoria='🍔 Comida', medio='tarjeta', cuenta='manual')]
base = Supabase({'pj_transacciones': txs, 'pj_cuentas': [], 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': []})

with sync_playwright() as p:
    b = lanzar(p); errores = []
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.wait_for_selector('#lista-movs')
    filas = {t.split('\n')[0]: t.replace('\n', ' · ') for t in pg.locator('#lista-movs .fila').all_inner_texts()}
    res.comprobar('Mercadona' in filas and 'Tarjeta' in filas['Mercadona'], 'la compra se ve como «Mercadona» y con tarjeta (aunque se importó como transferencia)')
    res.comprobar('Transferencia de José Martínez Pérez' in filas, 'la transferencia dice de quién es, con tildes')
    res.comprobar('cena en mercadona' in filas, 'lo escrito a mano se ve tal cual')
    foto(pg, 'no01_lista', False)
    pg.locator('#lista-movs .fila:has(.concepto:text-is("Mercadona"))').first.click(); pg.wait_for_selector('.hoja-panel')
    res.comprobar('Concepto original: COMPRA TARJ. 5402XXXXXXXX1234 MERCADONA VALENCIA' in pg.inner_text('.hoja-panel'), 'al abrirlo se ve el concepto original del banco')
    res.comprobar(pg.eval_on_selector('select[data-cambio="medio-mov"]', 'e => e.value') == 'tarjeta', 'y la forma de pago marcada es tarjeta')
    pg.click('.hoja-panel .hoja-cab [data-accion="cerrar-hoja"]')
    for q, que in [('mercadona', 'nombre limpio'), ('compra tarj', 'concepto original')]:
        pg.fill('input[data-entrada="buscar"]', q); pg.wait_for_timeout(150)
        res.comprobar(pg.locator('#lista-movs .fila:has-text("Mercadona")').count() >= 1, f'el buscador encuentra por el {que}')
    pg.fill('input[data-entrada="buscar"]', '')
    ext = extracto('nombres', [(dmy(0), 'RECIBO NETFLIX.COM', -12.99, 500), (dmy(0), 'COMPRA TARJ. 5402XXXX LIBRERIA PAPEL', -8, 512.99), (dmy(0), 'BIZUM A LUCIA', -5, 520.99)])
    vista = ' | '.join(importar(pg, ext))
    res.comprobar('Netflix' in vista and 'Librería Papel' in vista and 'Bizum a Lucía' in vista, 'la vista previa enseña los nombres limpios')
    pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_timeout(800)
    medios = {t['descripcion']: t['medio'] for t in txs}
    res.comprobar(medios['RECIBO NETFLIX.COM'] == 'recibo' and medios['COMPRA TARJ. 5402XXXX LIBRERIA PAPEL'] == 'tarjeta' and medios['BIZUM A LUCIA'] == 'bizum', 'lo importado se guarda con la forma de pago correcta (y el concepto original)')
    b.close()

res.terminar(errores)
