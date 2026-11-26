"""Piezas comunes de las pruebas de la app nueva (nueva/).

Las pruebas abren la app en un Chromium sin ventana (Playwright), servida desde los archivos del repositorio en una
dirección inventada (http://pulso.prueba/). Nunca tocan la base de datos real: o usan el modo demo, o simulan Supabase
respondiendo ellas mismas a las peticiones REST. supabase-js y xlsx se sirven desde pruebas/node_modules (npm install),
así que no hace falta internet. Ver LEEME.md.
"""
import base64, datetime, glob, json, mimetypes, os, sys, urllib.parse

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(AQUI)
SAL = os.path.join(AQUI, 'capturas')      # capturas de pantalla (no se suben)
TMP = os.path.join(AQUI, 'tmp')           # extractos de prueba generados (no se suben)
LIBS = os.path.join(AQUI, 'node_modules')
os.makedirs(SAL, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

SUPABASE = 'https://tqjukdleqgbpseaipfel.supabase.co'
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': '*'}
hoy = datetime.date.today()
iso = lambda n: (hoy - datetime.timedelta(days=n)).isoformat()          # fecha de hace n días, 2026-11-25
dmy = lambda n: (hoy - datetime.timedelta(days=n)).strftime('%d/%m/%Y')  # la misma, como la escriben los bancos


# ─── NAVEGADOR ───
def lanzar(p):
    """Chromium de Playwright. En los entornos de Claude Code ya hay uno en /opt/pw-browsers."""
    ruta = glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome')
    return p.chromium.launch(executable_path=ruta[0]) if ruta else p.chromium.launch()


def _servir(route):
    ruta = route.request.url.split('pulso.prueba/', 1)[1].split('?')[0].split('#')[0] or 'index.html'
    archivo = os.path.join(REPO, urllib.parse.unquote(ruta))
    if os.path.isdir(archivo): archivo = os.path.join(archivo, 'index.html')
    if not os.path.isfile(archivo): return route.fulfill(status=404, body='')
    tipo = mimetypes.guess_type(archivo)[0] or 'application/octet-stream'
    if archivo.endswith('.js'): tipo = 'text/javascript'
    route.fulfill(path=archivo, content_type=tipo)


def _cdn(route):
    url = route.request.url
    if 'supabase-js' in url: return route.fulfill(path=os.path.join(LIBS, '@supabase/supabase-js/dist/umd/supabase.js'), content_type='text/javascript')
    if 'xlsx' in url: return route.fulfill(path=os.path.join(LIBS, 'xlsx/dist/xlsx.full.min.js'), content_type='text/javascript')
    if 'chart.js' in url: return route.fulfill(path=os.path.join(LIBS, 'chart.js/dist/chart.umd.js'), content_type='text/javascript')
    route.abort()


def preparar(pg, errores):
    """Sirve la app desde el repositorio, corta todo lo externo y apunta los errores de JavaScript en `errores`."""
    if not os.path.isdir(LIBS):
        sys.exit('Faltan las librerías: ejecuta «npm install» dentro de pruebas/ (ver LEEME.md)')
    pg.on('pageerror', lambda e: errores.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errores.append('console: ' + m.text) if m.type == 'error' else None)
    pg.route('http://pulso.prueba/**', _servir)
    pg.route('https://cdn.jsdelivr.net/**', _cdn)
    pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    pg.route('https://fonts.gstatic.com/**', lambda r: r.abort())
    pg.route(SUPABASE + '/**', lambda r: r.abort())


def foto(pg, nombre, completa=True):
    pg.wait_for_timeout(350)
    pg.screenshot(path=os.path.join(SAL, nombre + '.png'), full_page=completa)


def pagina(b, errores, ancho=390, alto=844):
    pg = b.new_page(viewport={'width': ancho, 'height': alto}, device_scale_factor=2 if ancho < 1000 else 1, locale='es-ES')
    preparar(pg, errores)
    return pg


# ─── SUPABASE SIMULADO ───
_b64 = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
SESION = {'access_token': _b64({'alg': 'HS256'}) + '.' + _b64({'sub': 'u1', 'exp': 4102444800}) + '.f', 'refresh_token': 'r', 'token_type': 'bearer',
          'expires_in': 3600, 'expires_at': 4102444800,
          'user': {'id': 'u1', 'email': 'p@e.com', 'aud': 'authenticated', 'role': 'authenticated', 'user_metadata': {'name': 'Prueba'}}}
fila = lambda **k: {'user_id': 'u1', 'tipo': 'gasto', 'medio': 'tarjeta', 'cuenta': 'bankinter', 'pendiente': False, **k}


class Supabase:
    """Base de datos de mentira: `tablas` = {nombre: [filas]}. Entiende lecturas con filtros eq/in y páginas,
    altas, cambios y borrados, como PostgREST. Las tablas que no están responden «no existe» (PGRST205).
    `log` guarda cada petición que no es de lectura, para comprobar qué se habría guardado."""

    def __init__(self, tablas, sin_columna=None, por_defecto=None):
        self.tablas, self.log, self.sin_columna = tablas, [], sin_columna  # sin_columna: (tabla, columna) que «no existe»
        self.por_defecto = por_defecto or {}  # {tabla: {columna: valor}} que pondría la base de datos al crear
        self.fallar = False   # True: las escrituras responden «sesión caducada» (401)
        self.lecturas = {}    # páginas leídas por tabla

    @staticmethod
    def filtrar(filas, params):
        ops = {'eq': lambda a, b: str(a) == b, 'neq': lambda a, b: str(a) != b, 'lte': lambda a, b: str(a) <= b,
               'lt': lambda a, b: str(a) < b, 'gte': lambda a, b: str(a) >= b, 'gt': lambda a, b: str(a) > b}
        for col, vals in params.items():
            if col in ('select', 'order', 'offset', 'limit', 'on_conflict', 'columns'): continue
            for v in vals:
                op, _, val = v.partition('.')
                if op == 'in': conj = set(val.strip('()').split(',')); filas = [x for x in filas if str(x.get(col)) in conj]
                else: filas = [x for x in filas if ops[op](x.get(col), val)]
        return filas

    def responder(self, r, _p=None):
        req = r.request
        if req.method == 'OPTIONS': return r.fulfill(status=204, headers=CORS)
        u = urllib.parse.urlparse(req.url); tabla = u.path.rsplit('/', 1)[-1]; params = urllib.parse.parse_qs(u.query)
        if tabla not in self.tablas:
            return r.fulfill(status=404, headers=CORS, content_type='application/json', body=json.dumps({'code': 'PGRST205', 'message': f"Could not find the table 'public.{tabla}'"}))
        if self.sin_columna and tabla == self.sin_columna[0] and self.sin_columna[1] in params.get('select', [''])[0]:
            return r.fulfill(status=400, headers=CORS, content_type='application/json', body=json.dumps({'code': '42703', 'message': f'column {tabla}.{self.sin_columna[1]} does not exist'}))
        datos = self.tablas[tabla]; uno = 'vnd.pgrst.object' in (req.headers.get('accept') or '')
        filas = self.filtrar(datos, params)
        if req.method != 'GET': self.log.append(f'{req.method} {tabla} {req.post_data or ""}')
        if req.method == 'GET':
            for o in reversed(params.get('order', [''])[0].split(',')):
                if o:
                    c, _, sentido = o.partition('.')
                    filas = sorted(filas, key=lambda x: str(x.get(c)), reverse=sentido.startswith('desc'))
            ini = int(params.get('offset', ['0'])[0]); lim = min(int(params.get('limit', ['1000'])[0]), 1000)  # como Supabase: 1.000 como mucho
            self.lecturas[tabla] = self.lecturas.get(tabla, 0) + 1
            return r.fulfill(status=200, headers=CORS, content_type='application/json', body=json.dumps(filas[ini:ini + lim]))
        if self.fallar:
            return r.fulfill(status=401, headers=CORS, content_type='application/json', body=json.dumps({'code': 'PGRST301', 'message': 'JWT expired'}))
        if req.method == 'POST':
            nuevas = json.loads(req.post_data); nuevas = nuevas if isinstance(nuevas, list) else [nuevas]
            for i, n in enumerate(nuevas):
                n.setdefault('id', 100 + len(datos) + i)
                for k, v in self.por_defecto.get(tabla, {}).items(): n.setdefault(k, v)
                if tabla == 'pj_transacciones' and not self.sin_columna: n.setdefault('pendiente', False)
            if tabla == 'pj_reglas_categoria': datos[:] = [x for x in datos if x.get('concepto') != nuevas[0].get('concepto')]
            if 'on_conflict' in params:  # upsert: sustituye la fila con la misma clave
                claves = params['on_conflict'][0].split(',')
                datos[:] = [x for x in datos if not all(str(x.get(c)) == str(nuevas[0].get(c)) for c in claves)]
            datos.extend(nuevas)
            return r.fulfill(status=201, headers=CORS, content_type='application/json', body=json.dumps(nuevas[0] if uno else nuevas))
        if req.method == 'PATCH':
            for x in filas: x.update(json.loads(req.post_data))
            return r.fulfill(status=200, headers=CORS, content_type='application/json', body=json.dumps(filas[0] if uno and filas else filas))
        if req.method == 'DELETE':
            quitar = {id(x) for x in filas}; datos[:] = [x for x in datos if id(x) not in quitar]
            return r.fulfill(status=204, headers=CORS)

    def escrituras(self, que=''):
        return [l for l in self.log if que in l]


def con_sesion(pg, base):
    """Abre la app con una sesión iniciada y `base` (Supabase) contestando en lugar del servidor real."""
    pg.unroute(SUPABASE + '/**')
    pg.route(SUPABASE + '/rest/**', base.responder)
    pg.route(SUPABASE + '/auth/**', lambda r: r.fulfill(status=200, headers=CORS, content_type='application/json', body=json.dumps(SESION['user'])))
    pg.add_init_script(f"localStorage.setItem('sb-tqjukdleqgbpseaipfel-auth-token', {json.dumps(json.dumps(SESION))})")


# ─── EXTRACTOS DE PRUEBA (formato de Bankinter: el único probado con archivos reales) ───
def extracto(nombre, filas, retenidos=None, numero=None):
    """filas: [fecha dd/mm/aaaa, descripción, importe, saldo]; retenidos: [fecha, descripción, importe]; numero: IBAN encima."""
    from openpyxl import Workbook
    wb = Workbook(); ws = wb.active
    if numero: ws.append(['Cuenta', numero]); ws.append([])
    if retenidos:
        ws.append(['Movimientos pendientes']); ws.append(['Fecha', 'Descripción', 'Importe', 'Divisa'])
        for f, d, i in retenidos: ws.append([f, d, i, 'EUR'])
        ws.append([])
    ws.append(['Fecha contable', 'Fecha valor', 'Descripción', 'Importe', 'Saldo', 'Divisa'])
    for f, d, i, s in filas: ws.append([f, f, d, i, s, 'EUR'])
    ruta = os.path.join(TMP, nombre + '.xlsx'); wb.save(ruta)
    return ruta


# ─── ACCIONES QUE SE REPITEN ───
def apuntar(pg, tipo, teclas, cat, fecha, medio, concepto, url='http://pulso.prueba/nueva/?demo#/anadir'):
    """Apunta un movimiento a mano desde «Añadir»."""
    if '#/anadir' not in pg.url: pg.goto(url)
    pg.wait_for_selector('.teclado')
    pg.click(f'[data-accion="tipo-nuevo"][data-valor="{tipo}"]')
    pg.click(f'.formas button[data-valor="{medio}"]')
    for k in teclas: pg.click(f'.teclado [data-valor="{k}"]')
    pg.click(f'[data-accion="cat-nuevo"][data-valor="{cat}"]')
    pg.fill('input[data-entrada="fecha-nuevo"]', fecha)
    pg.fill('input[data-entrada="concepto-nuevo"]', concepto)
    pg.click('[data-accion="guardar-nuevo"]')
    pg.wait_for_selector('.tarjeta-tinta')


def importar(pg, ruta, url='http://pulso.prueba/nueva/#/anadir'):
    """Sube un extracto y devuelve el texto de la vista previa, línea a línea."""
    pg.goto(url); pg.click('[data-accion="tab-anadir"][data-valor="extracto"]')
    if pg.locator('[data-accion="cancelar-importacion"]').count(): pg.click('[data-accion="cancelar-importacion"]')  # queda una vista previa abierta
    try: pg.wait_for_selector('input[data-cambio="archivo"]', state='attached', timeout=5000)
    except Exception: pg.screenshot(path=os.path.join(SAL, 'error_importar.png')); raise
    pg.set_input_files('input[data-cambio="archivo"]', ruta)
    pg.wait_for_selector('.anadir-cuerpo section.tarjeta'); pg.wait_for_timeout(300)
    return [l for l in pg.inner_text('.anadir-cuerpo').split('\n') if l.strip()]


def euros(texto):
    """'−1.234,56 €' → -1234.56"""
    t = texto.strip().replace('−', '-').replace('€', '').replace('.', '').replace(',', '.').replace('+', '').strip()
    return float(t)


# ─── COMPROBACIONES ───
class Resultado:
    """Junta lo observado (se imprime) y las comprobaciones; al terminar sale con error si alguna falló."""

    def __init__(self, nombre):
        self.nombre, self.datos, self.fallos, self.bien = nombre, {}, [], 0

    def __setitem__(self, k, v): self.datos[k] = v
    def __getitem__(self, k): return self.datos[k]

    def comprobar(self, condicion, que):
        if condicion: self.bien += 1
        else: self.fallos.append(que)

    def terminar(self, errores=()):
        # Las tablas que «no existen» se simulan con 404, la sesión caducada con 401 y las columnas que faltan con 400
        errores = [e for e in errores if not any(f'status of {c}' in e for c in (400, 401, 404)) and 'JWT expired' not in e]
        self.comprobar(not errores, f'sin errores de JavaScript ({errores})')
        if os.environ.get('PRUEBAS_DETALLE'):
            for k, v in self.datos.items(): print(f'  {k}: {v}')
        for f in self.fallos: print(f'  ✗ {f}')
        print(f'{"✓" if not self.fallos else "✗"} {self.nombre}: {self.bien} comprobaciones bien, {len(self.fallos)} mal')
        sys.exit(1 if self.fallos else 0)
