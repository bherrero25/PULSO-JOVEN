#!/bin/bash
# Prueba los textos de sql/ en un PostgreSQL local (base desechable «pulso_prueba»): cada texto se aplica dos veces
# (deben poder repetirse) y después se ejecutan sus comprobaciones. Uso: bash pruebas/sql/ejecutar_sql.sh
# Necesita psql y un usuario que pueda crear bases de datos (por defecto, «postgres» con sudo; se cambia con PSQL="psql -U yo").
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"; SQL="$AQUI/../../sql"
PSQL="${PSQL:-sudo -u postgres psql}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT; cp "$AQUI"/*.sql "$SQL"/2026-11-*.sql "$TMP"/; chmod -R a+rX "$TMP"; cd "$TMP"
$PSQL -q -v ON_ERROR_STOP=1 -f preparar.sql >/dev/null 2>"$TMP/err" || { cat "$TMP/err"; echo "✗ No se ha podido preparar la base de prueba"; exit 1; }
fallos=0
for texto in 2026-11-retenidos 2026-11-atajo-apple-pay 2026-11-cuentas 2026-11-cuenta-principal 2026-11-fijos 2026-11-seguridad; do
  for vez in 1 2; do
    $PSQL -q -d pulso_prueba -v ON_ERROR_STOP=1 -f "$texto.sql" >/dev/null 2>"$TMP/err" || { grep -v NOTICE "$TMP/err"; echo "✗ $texto.sql falla al aplicarlo (vez $vez)"; fallos=$((fallos+1)); }
  done
done
for prueba in retenidos atajo cuentas principal fijos seguridad; do
  if $PSQL -q -d pulso_prueba -v ON_ERROR_STOP=1 -f "comprobar_$prueba.sql" >/dev/null 2>"$TMP/err"; then echo "  ✓ $prueba"
  else grep -v NOTICE "$TMP/err" | sed 's/^/    /'; echo "  ✗ $prueba"; fallos=$((fallos+1)); fi
done
$PSQL -q -c 'drop database if exists pulso_prueba' >/dev/null 2>&1
[ $fallos -eq 0 ] && echo "✓ Textos SQL: todo bien" || echo "✗ Textos SQL: $fallos fallos"
exit $fallos
