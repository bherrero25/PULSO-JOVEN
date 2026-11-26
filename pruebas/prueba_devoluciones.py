"""Devoluciones (Supabase simulado): al elegir «Devoluciones» en un ingreso, la app pregunta de qué gasto es; guardada con
esa categoría, no cuenta como ingreso y resta de lo gastado en ella (Resumen, presupuesto), con el balance igual; la
lista la enseña como «Devolución · Ocio»; «No sé de qué gasto es» la deja como ingreso; y al apuntar a mano una
devolución también pregunta."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, apuntar, euros, fila, hoy, iso

res = Resultado('Devoluciones')
mes = hoy.strftime('%Y-%m')
d = lambda n: f'{mes}-{min(n, hoy.day, 25):02d}'
cifras = lambda pg: (pg.goto('http://pulso.prueba/nueva/#/inicio'), pg.wait_for_selector('.tarjeta-tinta'),
                     {k: euros(pg.inner_text(f'.tarjeta-tinta .dato:has-text("{t}") b')) for k, t in (('ingresado', 'Ingresado'), ('gastado', 'Gastado'))} | {'balance': euros(pg.inner_text('.tarjeta-tinta .cifra'))})[2]
OCIO = 'section[aria-label="En qué se va"] details:has(.nombre:text-is("Ocio"))'

with sync_playwright() as p:
    b = lanzar(p); errores = []
    txs = [fila(id=1, fecha=d(1), descripcion='TRANSFERENCIA DE CASA', importe=500, tipo='ingreso', medio='transferencia', categoria='💰 Mensualidad'),
           fila(id=2, fecha=d(3), descripcion='RESTAURANTE LA PLAZA', importe=60, categoria='🎉 Ocio'),
           fila(id=3, fecha=d(4), descripcion='BIZUM DE MARTA CENA', importe=20, tipo='ingreso', medio='bizum', categoria='📱 Bizum recibido')]
    base = Supabase({'pj_transacciones': txs, 'pj_cuentas': [], 'pj_presupuestos': [{'id': 1, 'user_id': 'u1', 'categoria': '🎉 Ocio', 'limite': 100, 'mes': '2026-01'}],
                     'pj_metas': [], 'pj_reglas_categoria': [], 'pj_fijos': []})
    pg = pagina(b, errores); con_sesion(pg, base)
    pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.tarjeta-tinta')
    c0 = cifras(pg)

    # El Bizum de Marta (su parte de la cena): Devoluciones → Ocio
    pg.goto('http://pulso.prueba/nueva/#/movimientos'); pg.wait_for_selector('#lista-movs')
    pg.click('#lista-movs .fila:has-text("20,00")'); pg.wait_for_selector('.rejilla-cats')
    pg.click('.rejilla-cats button:has-text("Devoluciones")'); pg.wait_for_selector('[data-sub="1"]')
    res.comprobar('¿De qué gasto es la devolución?' in pg.inner_text('.hoja-cab'), 'al elegir «Devoluciones» pregunta de qué gasto es')
    foto(pg, 'dev01_de_que_gasto', False)
    pg.click('[data-sub="1"][data-cat="🎉 Ocio"]'); pg.wait_for_timeout(400)
    res.comprobar(txs[2]['categoria'] == '🎉 Ocio', 'se guarda con la categoría del gasto')
    res.comprobar('como devolución de Ocio' in pg.inner_text('#toast'), 'y el aviso lo dice')
    res.comprobar('Devolución · Ocio' in pg.locator('#lista-movs .fila:has-text("20,00")').inner_text(), 'en la lista se ve como «Devolución · Ocio»')
    c1 = cifras(pg)
    res.comprobar(abs(c1['ingresado'] - (c0['ingresado'] - 20)) < 0.005 and abs(c1['gastado'] - (c0['gastado'] + 20)) < 0.005, 'ya no cuenta como ingreso y resta 20 € de lo gastado')
    res.comprobar(abs(c1['balance'] - c0['balance']) < 0.005, 'el balance del mes no cambia')
    pg.goto('http://pulso.prueba/nueva/#/resumen'); pg.wait_for_selector(OCIO)
    ocio = pg.inner_text(OCIO)
    res.comprobar('40,00' in ocio and 'Te devolvieron' in ocio, 'en Resumen, Ocio cuenta 40 € y dice lo que te devolvieron')
    res.comprobar('Las devoluciones' in pg.inner_text('section[aria-label="De dónde viene"]'), '«De dónde viene» explica que las devoluciones no cuentan como ingreso')
    pg.click(f'{OCIO} summary'); pg.wait_for_timeout(150)
    foto(pg, 'dev02_resumen')
    pg.goto('http://pulso.prueba/nueva/#/presupuesto'); pg.wait_for_timeout(400)
    res.comprobar('40' in pg.inner_text('.contenido') and '100' in pg.inner_text('.contenido'), 'el presupuesto de Ocio cuenta lo gastado menos lo devuelto (40 de 100)')

    # «No sé de qué gasto es»: queda como ingreso
    apuntar(pg, 'ingreso', '15', 'devolucion', d(5), 'bizum', 'Bizum de Leo', url='http://pulso.prueba/nueva/#/anadir')
    pg.wait_for_selector('[data-sub="1"]')
    res.comprobar('¿De qué gasto es la devolución?' in pg.inner_text('.hoja-cab'), 'al apuntar a mano una devolución también pregunta')
    pg.click('[data-sub="1"][data-cat="🤝 Devolución"]'); pg.wait_for_timeout(400)
    leo = next(t for t in txs if t['descripcion'] == 'Bizum de Leo')
    res.comprobar(leo['categoria'] == '🤝 Devolución', '«No sé de qué gasto es» la deja como devolución sin categoría')
    c3 = cifras(pg)
    res.comprobar(abs(c3['ingresado'] - (c1['ingresado'] + 15)) < 0.005, 'y esa sí cuenta como ingreso')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    b.close()

res.terminar(errores)
