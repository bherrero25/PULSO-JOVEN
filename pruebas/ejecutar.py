"""Ejecuta todas las pruebas y resume cuáles van bien y cuáles fallan.

    python3 pruebas/ejecutar.py              todas (cálculos + navegador)
    python3 pruebas/ejecutar.py cuentas fijos solo las que contienen esas palabras
    python3 pruebas/ejecutar.py --sql         además, los textos SQL en un PostgreSQL local
    PRUEBAS_DETALLE=1 python3 pruebas/ejecutar.py ...   enseña también lo que ha visto cada prueba

Sale con error si alguna falla, así que sirve antes de publicar: si algo sale ✗, no se publica.
"""
import concurrent.futures, glob, os, subprocess, sys, time

AQUI = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
pruebas = [('node', os.path.join(AQUI, 'prueba_logica.mjs'))] + [(sys.executable, f) for f in sorted(glob.glob(os.path.join(AQUI, 'prueba_*.py')))]
if args: pruebas = [p for p in pruebas if any(a in os.path.basename(p[1]) for a in args)]


def ejecutar(prueba):
    prog, ruta = prueba
    inicio = time.time()
    try:
        r = subprocess.run([prog, ruta], cwd=AQUI, capture_output=True, text=True, timeout=600)
        salida, codigo = (r.stdout + r.stderr).strip(), r.returncode
    except subprocess.TimeoutExpired:
        salida, codigo = 'Se ha pasado de tiempo (10 minutos)', 1
    return os.path.basename(ruta), codigo, salida, time.time() - inicio


if not os.path.isdir(os.path.join(AQUI, 'node_modules')):
    sys.exit('Faltan las librerías: ejecuta «npm install» dentro de pruebas/ (ver pruebas/LEEME.md)')
print(f'Ejecutando {len(pruebas)} pruebas…\n')
fallan = []
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:  # tres navegadores a la vez
    for nombre, codigo, salida, segundos in pool.map(ejecutar, pruebas):
        if codigo == 0:
            print('\n'.join(l for l in salida.splitlines() if l.startswith(('✓', '  '))) + f'  ({segundos:.0f} s)')
        else:
            fallan.append(nombre)
            utiles = [l for l in salida.splitlines() if l.startswith(('✗', '  ✗', '✓'))]
            print('\n'.join(utiles) if utiles else f'✗ {nombre} no ha terminado:\n' + '\n'.join(salida.splitlines()[-12:]))
if '--sql' in sys.argv:
    print()
    if subprocess.run(['bash', os.path.join(AQUI, 'sql', 'ejecutar_sql.sh')]).returncode: fallan.append('textos SQL')
print(f'\n{"✓ Todo bien" if not fallan else "✗ Fallan: " + ", ".join(fallan)}')
sys.exit(1 if fallan else 0)
