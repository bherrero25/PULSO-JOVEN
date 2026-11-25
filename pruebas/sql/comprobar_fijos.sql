-- Movimientos fijos (sql/2026-11-fijos.sql): comprobaciones de datos y cada persona solo los suyos
grant select, insert, update, delete on public.pj_fijos to authenticated;
set role authenticated;
select set_config('prueba.uid', '11111111-1111-1111-1111-111111111111', false);
insert into public.pj_fijos (nombre, tipo, categoria, importe, dia, ultimo) values ('Mensualidad', 'ingreso', '💰 Mensualidad', 470, 28, '2026-10-28');
insert into public.pj_fijos (nombre, tipo, categoria, importe, dia) values ('Alquiler', 'gasto', '🏠 Alquiler', 350, 1);
select public.debe_fallar($q$insert into public.pj_fijos (nombre, tipo, categoria, importe, dia) values ('Mal día', 'ingreso', '💰 Nómina', 10, 32)$q$);
select public.debe_fallar($q$insert into public.pj_fijos (nombre, tipo, categoria, importe, dia) values ('Gratis', 'ingreso', '💰 Nómina', 0, 5)$q$);
select public.debe_fallar($q$insert into public.pj_fijos (nombre, tipo, categoria, importe, dia) values ('Raro', 'traspaso', '💰 Nómina', 5, 5)$q$);
update public.pj_fijos set ultimo = '2026-11-28' where nombre = 'Mensualidad';
select set_config('prueba.uid', '22222222-2222-2222-2222-222222222222', false);
do $$ begin assert (select count(*) from public.pj_fijos) = 0, 'la persona 2 no ve fijos ajenos'; end $$;
update public.pj_fijos set importe = 1;
delete from public.pj_fijos;
select public.debe_fallar($q$insert into public.pj_fijos (user_id, nombre, categoria, importe, dia) values ('11111111-1111-1111-1111-111111111111', 'Intruso', 'x', 1, 1)$q$);
reset role;
do $$ begin
  assert (select count(*) from public.pj_fijos) = 2, 'la persona 1 conserva sus dos fijos';
  assert (select ultimo from public.pj_fijos where nombre = 'Mensualidad') = '2026-11-28', 'su cambio se guardó';
  assert (select min(medio) from public.pj_fijos) = 'transferencia' and (select bool_and(activo) from public.pj_fijos), 'valores por defecto: transferencia y activo';
end $$;
