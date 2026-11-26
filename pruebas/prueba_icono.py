"""Icono y modo app: la página enlaza el manifiesto y los iconos, y todos se pueden descargar."""
from playwright.sync_api import sync_playwright
from comun import Resultado, lanzar, pagina

res = Resultado('Icono y manifiesto')

with sync_playwright() as p:
    b = lanzar(p); errores = []
    pg = pagina(b, errores)
    pg.goto('http://pulso.prueba/nueva/?demo'); pg.wait_for_selector('.saludo')
    enlaces = pg.evaluate("[...document.querySelectorAll('link[rel=manifest], link[rel=icon], link[rel=apple-touch-icon]')].map(l => l.href)")
    man = pg.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
    res.comprobar(len(enlaces) == 4, 'la página enlaza el manifiesto, los dos favicon y el icono del iPhone')
    res.comprobar(man['name'] == 'Pulso Joven' and man['display'] == 'standalone', 'el manifiesto se llama «Pulso Joven» y abre como app')
    res.comprobar(len(man.get('shortcuts', [])) == 4, 'el manifiesto tiene los accesos de apuntar rápido')
    urls = enlaces + [pg.url.split('?')[0] + i['src'] for i in man['icons']]
    estados = pg.evaluate("async urls => Promise.all(urls.map(async u => (await fetch(u)).status))", urls)
    res.comprobar(all(s == 200 for s in estados), 'todos los iconos se descargan')
    b.close()

res.terminar(errores)
