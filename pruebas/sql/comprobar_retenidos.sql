-- Retenidos (sql/2026-11-retenidos.sql): la columna existe y los movimientos de siempre quedan como no retenidos
insert into public.pj_transacciones (user_id, fecha, descripcion, importe) values ('11111111-1111-1111-1111-111111111111', '2026-11-01', 'ANTIGUO', 1);
do $$ begin assert (select pendiente from public.pj_transacciones where descripcion = 'ANTIGUO') = false, 'un movimiento sin indicar queda como no retenido'; end $$;
select public.debe_fallar($q$insert into public.pj_transacciones (user_id, fecha, descripcion, importe, pendiente) values ('11111111-1111-1111-1111-111111111111', '2026-11-01', 'NULO', 1, null)$q$);
