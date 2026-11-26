-- Para qué es el dinero de paso (sql/2026-11-paso.sql): la columna existe, vale vacía y no admite textos vacíos ni larguísimos
insert into public.pj_transacciones (user_id, fecha, descripcion, importe, tipo, categoria, paso) values
  ('11111111-1111-1111-1111-111111111111', '2026-11-20', 'TRANSFERENCIA DE MAMA', 800, 'ingreso', '↩️ Reenviado', 'Ordenador'),
  ('11111111-1111-1111-1111-111111111111', '2026-11-21', 'BIZUM A MAMA', 120, 'gasto', '↩️ Reenviado', null);
select public.debe_fallar($q$insert into public.pj_transacciones (user_id, fecha, descripcion, importe, paso) values ('11111111-1111-1111-1111-111111111111', '2026-11-01', 'X', 1, '')$q$);
select public.debe_fallar($q$insert into public.pj_transacciones (user_id, fecha, descripcion, importe, paso) values ('11111111-1111-1111-1111-111111111111', '2026-11-01', 'X', 1, repeat('a', 61))$q$);
do $$ begin assert (select count(*) from public.pj_transacciones where paso = 'Ordenador') = 1, 'se guarda para qué es'; end $$;
