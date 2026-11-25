"""«Crear cuenta» con las tres respuestas posibles de Supabase (simuladas), en la app nueva y en la antigua (app.html):
entra directamente si no hace falta confirmar el correo, avisa si hay que confirmarlo y explica en español si ya existe."""
import json
from playwright.sync_api import sync_playwright
from comun import Resultado, lanzar, pagina, CORS, SUPABASE, SESION

res = Resultado('Crear cuenta (app nueva y antigua)')
USUARIO = {**SESION['user'], 'id': 'u9', 'email': 'nueva@ejemplo.com', 'user_metadata': {'name': 'Lucía'}}
RESPUESTAS = {
    'entra_directa': (200, {**{k: SESION[k] for k in ('access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at')}, 'user': USUARIO}),
    'pide_confirmar': (200, {**USUARIO, 'confirmation_sent_at': '2026-11-25T10:00:00Z'}),
    'ya_existe': (422, {'code': 422, 'error_code': 'user_already_exists', 'msg': 'User already registered'}),
}
# Cómo se rellena y se lee cada app: (dirección, abrir «crear cuenta», nombre, email, contraseña, botón, dentro, saludo, mensaje)
APPS = {
    'nueva': ('nueva/', '[data-accion="modo-entrar"][data-valor="crear"]', '#acc-nombre', '#acc-email', '#acc-pass', '#form-entrar button[type=submit]', '.tarjeta-tinta', '.saludo', '#acc-msg'),
    'antigua': ('app.html', '.auth-tab:has-text("Crear cuenta")', '#reg-name', '#reg-email', '#reg-pass', 'text=Crear cuenta →', '#app.visible', '#header-name', '#auth-msg'),
}

with sync_playwright() as p:
    b = lanzar(p); todos = []
    for app, (url, pestaña, c_nombre, c_email, c_pass, boton, dentro, saludo, mensaje) in APPS.items():
        for caso, (estado, cuerpo) in RESPUESTAS.items():
            errores, enviado = [], {}
            pg = pagina(b, errores)
            pg.unroute(SUPABASE + '/**')
            def auth(r, _p=None, estado=estado, cuerpo=cuerpo):
                if r.request.method == 'OPTIONS': return r.fulfill(status=204, headers=CORS)
                alta = '/signup' in r.request.url
                if alta: enviado['url'] = r.request.url
                r.fulfill(status=estado if alta else 200, headers=CORS, content_type='application/json', body=json.dumps(cuerpo if alta else USUARIO))
            pg.route(SUPABASE + '/auth/**', auth)
            pg.route(SUPABASE + '/rest/**', lambda r: r.fulfill(status=204, headers=CORS) if r.request.method == 'OPTIONS' else r.fulfill(status=200, headers=CORS, content_type='application/json', body='[]'))
            pg.goto('http://pulso.prueba/' + url)
            pg.click(pestaña)
            pg.fill(c_nombre, 'Lucía'); pg.fill(c_email, 'nueva@ejemplo.com'); pg.fill(c_pass, 'secreto123')
            pg.click(boton); pg.wait_for_timeout(1500)
            texto = pg.text_content(mensaje) or '' if pg.query_selector(mensaje) else ''
            if caso == 'entra_directa':
                res.comprobar(pg.is_visible(dentro) and 'Lucía' in (pg.text_content(saludo) or ''), f'{app}: si no hace falta confirmar, entra y saluda')
            elif caso == 'pide_confirmar':
                res.comprobar(not pg.is_visible(dentro) and 'correo' in texto.lower(), f'{app}: si hay que confirmar, lo dice')
                res.comprobar('redirect_to=' in enviado.get('url', ''), f'{app}: el correo de confirmación vuelve a la app')
            else:
                res.comprobar(not pg.is_visible(dentro) and 'ya' in texto.lower(), f'{app}: si la cuenta ya existe, lo explica')
            todos += [e for e in errores if '422' not in e]
            pg.close()
    b.close()

res.terminar(todos)
