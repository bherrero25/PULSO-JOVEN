# Pruebas de la app nueva

Comprueban que la app nueva (`nueva/`) sigue funcionando después de cada cambio. **Nunca tocan la base de datos real:**
o usan el modo demo, o simulan Supabase respondiendo ellas mismas a las peticiones.

## Ejecutarlas

```bash
cd pruebas && npm install && cd ..          # la primera vez: supabase-js y xlsx para servirlos sin internet
pip install playwright openpyxl             # si no están (en Claude Code ya vienen; no hace falta «playwright install»)
python3 pruebas/ejecutar.py                 # todas (unos 40 segundos)
python3 pruebas/ejecutar.py cuentas fijos   # solo las que contienen esas palabras
python3 pruebas/ejecutar.py --sql           # además, los textos de sql/ en un PostgreSQL local
PRUEBAS_DETALLE=1 python3 pruebas/ejecutar.py importar   # enseña también lo que ha visto cada prueba
```

Si sale **✗**, algo se ha roto: no se publica hasta arreglarlo. Las capturas de pantalla quedan en `pruebas/capturas/`
(no se suben a GitHub).

## Qué comprueba cada una

| Archivo | Qué comprueba |
|---|---|
| `prueba_logica.mjs` | Los cálculos sin navegador: dinero de paso, traspasos, juntar lo apuntado con el extracto, varias cuentas, número de cuenta del extracto, «Tu dinero», movimientos fijos, nombres limpios y forma de pago |
| `prueba_recorrido.py` | Todas las pantallas en móvil y ordenador (demo): clasificar, buscar, apuntar, importar, resumen, presupuesto, metas, inversión |
| `prueba_sesion.py` | Con sesión: más de 1.000 movimientos, reglas aprendidas, altas, presupuestos y aviso si falla al guardar |
| `prueba_registro.py` | «Crear cuenta» en la app nueva y en la antigua con las tres respuestas de Supabase |
| `prueba_tu_dinero.py` | Cuentas, lo apuntado después del extracto, el desglose, el saldo al importar y sin la tabla de cuentas |
| `prueba_categorias.py` | Bizum en categorías reales, coche compartido descontado de la gasolina y la casilla «recordar» |
| `prueba_paso_traspaso.py` | Dinero de paso en los dos sentidos y traspasos (con deshacer) |
| `prueba_importar.py` | Retenidos (con y sin la columna), juntar lo apuntado a mano y lo de Apple Pay, volver a subir sin duplicar |
| `prueba_atajo.py` | Atajo de Apple Pay: clasificación al abrir, hoja con el código y sin la tabla |
| `prueba_apuntar.py` | Botones de apuntar rápido y textos que se adaptan a Bizum y transferencia |
| `prueba_cuenta_nueva.py` | Cuenta de banco añadida a mano (banco y 4 cifras, su extracto la reconoce), cuenta principal y sin la columna |
| `prueba_efectivo.py` | Efectivo: ingreso en mano o metido en el banco (juntarlo con el extracto), y la cuenta de efectivo de «Tu dinero» que se ajusta sola, pregunta o se deshace (preguntando) |
| `prueba_fijos.py` | Movimientos fijos: configurarlos, crear el previsto sin repetir y juntarlo con el real |
| `prueba_cuentas.py` | Varias cuentas: número del extracto, cuenta nueva, traspaso entre cuentas, cuenta al apuntar y filtro |
| `prueba_nombres.py` | Nombres limpios en la lista, concepto original al abrir, buscador y forma de pago al importar |
| `prueba_primeros.py` | Primeros pasos: bienvenida con la cuenta vacía, pasos que se marcan solos, botones, ocultar, sin tablas, demo y cuenta completa |
| `prueba_icono.py` | Manifiesto e iconos |
| `prueba_seguridad.py` | Conceptos, nombres y avisos con código dentro no se ejecutan en la app nueva, la antigua ni el informe |
| `sql/ejecutar_sql.sh` | Los textos de `sql/` en una base desechable: se pueden repetir y cada persona solo ve lo suyo |

## Cómo están hechas

- `comun.py` sirve la app desde los archivos del repositorio en `http://pulso.prueba/`, simula Supabase (clase
  `Supabase`, con tablas en memoria), genera extractos de prueba (formato de Bankinter) y junta las comprobaciones
  (`Resultado.comprobar`).
- Las comprobaciones miran cosas que no cambian con la fecha («el balance no cambia tras un traspaso»), no cifras de la
  demo, que dependen del día en que se ejecutan.
- Al añadir algo a la app, añade sus comprobaciones aquí (en el archivo que toque o en uno nuevo `prueba_*.py`).
