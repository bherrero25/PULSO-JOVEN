-- Pulso Joven · Cuenta principal: con varias cuentas de banco, cada persona elige cuál es la suya de siempre
-- Se ejecuta una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema. Necesita sql/2026-11-cuentas.sql.
--
-- pj_cuentas.principal: la cuenta a la que va por defecto lo que se apunta a mano, y la que recibe lo apuntado sin cuenta y
-- los pagos del atajo de Apple Pay. Como mucho una por persona. Si nadie la elige, la app usa la del extracto más reciente.
-- Sin esta columna la app funciona igual que antes (sin poder elegirla).

alter table public.pj_cuentas add column if not exists principal boolean not null default false;
create unique index if not exists pj_cuentas_una_principal on public.pj_cuentas (user_id) where principal;
