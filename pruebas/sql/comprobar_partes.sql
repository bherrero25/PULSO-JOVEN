-- Dividir un movimiento (sql/2026-11-partes.sql): la columna guarda una lista de partes y nada más
insert into public.pj_transacciones (user_id, fecha, descripcion, importe, tipo, categoria, partes) values
  ('11111111-1111-1111-1111-111111111111', '2026-10-30', 'TRANSFERENCIA DE PAPA', 686, 'ingreso', '💰 Mensualidad', '[{"importe": 300, "categoria": "↩️ Reenviado", "paso": "Alquiler"}]');
select public.debe_fallar($q$insert into public.pj_transacciones (user_id, fecha, descripcion, importe, partes) values ('11111111-1111-1111-1111-111111111111', '2026-11-01', 'X', 1, '{"importe": 1}')$q$);
do $$ begin assert (select partes->0->>'paso' from public.pj_transacciones where descripcion = 'TRANSFERENCIA DE PAPA' and partes is not null) = 'Alquiler', 'se guardan las partes'; end $$;
