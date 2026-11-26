"""Extractos de cualquier banco (demo, archivos inventados): un formato desconocido abre el asistente de columnas con una
propuesta, se puede corregir viendo cómo se leerá, se recuerda para la próxima vez; un archivo con Debe/Haber o con comas
se lee solo; y desde la vista previa se pueden elegir las columnas a mano. Con sesión (Supabase simulado), el formato se
guarda en la base de datos y vale en otro dispositivo; sin la tabla, se recuerda solo en el mismo dispositivo."""
from playwright.sync_api import sync_playwright
from comun import Resultado, Supabase, lanzar, pagina, con_sesion, foto, TMP
import datetime, pathlib

res = Resultado('Extractos de cualquier banco')
hoy = datetime.date.today()
d = lambda n, sep='/': (hoy - datetime.timedelta(days=n)).strftime(f'%d{sep}%m{sep}%Y')

# Banco desconocido: títulos que no dicen nada claro, separador «;», tildes en la codificación de Windows
DESCONOCIDO = pathlib.Path(TMP) / 'otro_banco.csv'
DESCONOCIDO.write_text('\n'.join([
    'Movimientos de la cuenta ES76 0081 0000 1111 2222 3333;;;',
    f'Periodo: {d(30)} - {d(0)};;;', ';;;',
    'F. Op.;Operación;Euros;Tras op.',
    f'{d(1)};PAGO MOVIL EN CAFETERIA LUNA;-3,50;812,40',
    f'{d(2)};TRANSFERENCIA DE JAVIER RUIZ;+25,00;815,90',
    f'{d(4)};CARGO TARJETA LIBRERIA SOL;-12,90;790,90',
    f'{d(6)};NOMINA EMPRESA PRACTICAS;600,00;803,80',
]), encoding='cp1252')
# Debe y Haber en dos columnas y separador «,» con comillas: se lee solo
DEBE_HABER = pathlib.Path(TMP) / 'debe_haber.csv'
DEBE_HABER.write_text('\n'.join([
    'Fecha,Fecha valor,Concepto,Debe,Haber,Saldo',
    f'{d(1)},{d(1)},"COMPRA SUPERMERCADO, VALENCIA","23,40",,"1.476,60"',
    f'{d(2)},{d(2)},BIZUM DE LUCIA,,"100,00","1.500,00"',
    f'{d(5)},{d(5)},RECIBO GIMNASIO,"29,90",,"1.400,00"',
]), encoding='utf-8')


def subir(pg, ruta):
    pg.goto('http://pulso.prueba/nueva/?demo#/inicio'); pg.wait_for_selector('.saludo')  # al salir de Añadir se descarta lo que hubiera a medias
    pg.goto('http://pulso.prueba/nueva/?demo#/anadir?pestana=extracto'); pg.wait_for_selector('input[data-cambio="archivo"]', state='attached')
    pg.set_input_files('input[data-cambio="archivo"]', str(ruta)); pg.wait_for_timeout(500)


with sync_playwright() as p:
    b = lanzar(p); errores = []
    pg = pagina(b, errores)

    # ── 1. Formato desconocido: asistente con una propuesta ──
    subir(pg, DESCONOCIDO)
    res.comprobar(pg.is_visible('text=No conocemos este formato'), 'un formato desconocido abre el asistente de columnas')
    valor = lambda campo: pg.eval_on_selector(f'select[data-campo="{campo}"]', 'e => e.value')
    res.comprobar([valor('fecha'), valor('concepto'), valor('importe'), valor('saldo')] == ['0', '1', '2', '3'], 'propone bien la fecha, el concepto, el importe y el saldo')
    vista = pg.inner_text('.tarjeta')
    res.comprobar('4 movimientos' in vista and 'Cafetería Luna' in vista and '812,40' in vista, 'y enseña cómo se leerá, con el saldo final')
    foto(pg, 'ob01_asistente')
    # Si se elige mal, la vista de cómo se leerá cambia al momento
    pg.select_option('select[data-campo="importe"]', '1'); pg.wait_for_timeout(150)
    res.comprobar('no se lee ningún movimiento' in pg.inner_text('.tarjeta'), 'al elegir mal una columna, se ve al momento que no se lee bien')
    pg.select_option('select[data-campo="importe"]', '2'); pg.wait_for_timeout(150)
    # Dos columnas: cambia los campos
    pg.click('[data-accion="formato-modo"][data-valor="dos"]'); pg.wait_for_timeout(150)
    res.comprobar(pg.is_visible('select[data-campo="cargo"]') and pg.is_visible('select[data-campo="abono"]'), '«En dos columnas» pide la de gastos y la de ingresos')
    pg.click('[data-accion="formato-modo"][data-valor="una"]'); pg.wait_for_timeout(150)
    pg.click('[data-accion="usar-formato"]'); pg.wait_for_selector('[data-accion="confirmar-importacion"]')
    vista = pg.inner_text('.pantalla-anadir')
    res.comprobar('Sabadell' in vista and 'Cuenta nueva' in vista, 'después, la vista previa de siempre (cuenta nueva, con el banco del IBAN)')
    res.comprobar('812,40' in vista, 'con el saldo del archivo')
    foto(pg, 'ob02_vista_previa')
    pg.click('[data-accion="confirmar-importacion"]'); pg.wait_for_selector('#lista-movs')
    res.comprobar(pg.locator('#lista-movs .fila:has-text("Cafetería Luna")').count() == 1, 'y se importan como los de cualquier extracto')

    # ── 2. El mismo formato otra vez: ya no pregunta ──
    subir(pg, DESCONOCIDO)
    res.comprobar(not pg.is_visible('text=No conocemos este formato') and pg.is_visible('[data-accion="cancelar-importacion"]'), 'la segunda vez recuerda las columnas y no pregunta')
    res.comprobar('ya estaban' in pg.inner_text('.pantalla-anadir').lower(), 'y lo ya importado no se repite')

    # ── 3. Debe y Haber con comas: se lee solo ──
    pg.evaluate("localStorage.removeItem('pj_formatos_extracto')")
    subir(pg, DEBE_HABER)
    vista = pg.inner_text('.pantalla-anadir')
    res.comprobar('No conocemos' not in vista and '−23,40' in vista and '+100,00' in vista and '1.476,60' in vista, 'un archivo con Debe y Haber (y comas) se lee solo, con el signo de cada columna')
    foto(pg, 'ob03_debe_haber')
    # Desde la vista previa se pueden elegir las columnas
    pg.click('[data-accion="elegir-columnas"]'); pg.wait_for_selector('select[data-campo="cargo"]')
    res.comprobar(valor('cargo') == '3' and valor('abono') == '4', '«Elige tú las columnas» abre el asistente con las que se han usado')
    foto(pg, 'ob04_dos_columnas')

    # ── 4. En el ordenador ──
    pg2 = pagina(b, errores, 1280, 900)
    pg2.goto('http://pulso.prueba/nueva/?demo#/anadir?pestana=extracto'); pg2.wait_for_selector('input[data-cambio="archivo"]', state='attached')
    pg2.set_input_files('input[data-cambio="archivo"]', str(DESCONOCIDO)); pg2.wait_for_selector('text=No conocemos este formato')
    foto(pg2, 'ob05_ordenador', False)
    pg2.close(); pg.close()

    # ── 5. Con sesión: el formato se guarda en la base de datos ──
    def con_base(base):
        pg = pagina(b, errores); con_sesion(pg, base)
        pg.goto('http://pulso.prueba/nueva/'); pg.wait_for_selector('.saludo')
        pg.goto('http://pulso.prueba/nueva/#/anadir?pestana=extracto'); pg.wait_for_selector('input[data-cambio="archivo"]', state='attached')
        pg.set_input_files('input[data-cambio="archivo"]', str(DESCONOCIDO)); pg.wait_for_timeout(600)
        return pg
    tablas = lambda: {'pj_transacciones': [], 'pj_cuentas': [], 'pj_presupuestos': [], 'pj_metas': [], 'pj_reglas_categoria': [], 'pj_fijos': []}
    t = tablas(); t['pj_formatos_extracto'] = []
    base = Supabase(t, por_defecto={'pj_formatos_extracto': {'user_id': 'u1'}})
    pg = con_base(base)
    pg.click('[data-accion="usar-formato"]'); pg.wait_for_selector('[data-accion="confirmar-importacion"]')
    guardados = base.tablas['pj_formatos_extracto']
    res.comprobar(len(guardados) == 1 and guardados[0]['firma'] == 'f. op.|operacion|euros|tras op.' and guardados[0]['formato']['importe'] == 2, 'con sesión, las columnas elegidas se guardan en la base de datos (solo los títulos, sin movimientos)')
    pg.close()
    pg = con_base(base)  # otro dispositivo: sin nada guardado en el navegador
    res.comprobar(not pg.is_visible('text=No conocemos este formato') and pg.is_visible('[data-accion="confirmar-importacion"]'), 'en otro dispositivo ya no pregunta')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error')
    pg.close()

    # ── 6. Sin la tabla: se recuerda en el mismo dispositivo ──
    pg = con_base(Supabase(tablas()))
    res.comprobar(pg.is_visible('text=No conocemos este formato'), 'sin la tabla de formatos, la primera vez pregunta')
    pg.click('[data-accion="usar-formato"]'); pg.wait_for_selector('[data-accion="confirmar-importacion"]')
    pg.click('[data-accion="cancelar-importacion"]')
    pg.set_input_files('input[data-cambio="archivo"]', str(DESCONOCIDO)); pg.wait_for_timeout(600)
    res.comprobar(not pg.is_visible('text=No conocemos este formato'), 'y la siguiente vez, en el mismo dispositivo, ya no')
    res.comprobar(not pg.is_visible('#aviso-error'), 'sin avisos de error (sin la tabla)')
    b.close()

res.terminar(errores)
