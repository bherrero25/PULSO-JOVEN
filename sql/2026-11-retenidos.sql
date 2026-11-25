-- Pulso Joven · Movimientos retenidos (pendientes de cobrar) del extracto del banco
-- Se ejecuta una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.
--
-- pendiente = true: el banco aún no lo ha cobrado del todo. Cuenta ya en los gastos e ingresos del mes;
-- al importar un extracto posterior, la app lo convierte en el movimiento definitivo o lo quita si ya no aparece.

alter table public.pj_transacciones add column if not exists pendiente boolean not null default false;
