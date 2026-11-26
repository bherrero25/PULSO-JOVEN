-- Pulso Joven · Dividir un movimiento en partes con otra categoría
-- Se ejecuta una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.
--
-- pj_transacciones.partes: las partes de un movimiento que tienen otra categoría, como lista [{importe, categoria, paso}]
-- (por ejemplo, los 300 € del alquiler que vienen dentro de la mensualidad, como dinero de paso «Alquiler»). Lo que queda
-- sigue con la categoría del movimiento. En la base de datos sigue siendo un solo movimiento, igual que en el banco, así
-- que al volver a subir el extracto no se duplica. Sin esta columna la app funciona, pero sin poder dividir.

alter table public.pj_transacciones add column if not exists partes jsonb check (partes is null or jsonb_typeof(partes) = 'array');
