-- «Tu dinero» (sql/2026-11-cuentas.sql): cada persona ve y cambia solo sus cuentas
grant select, insert, update, delete on public.pj_cuentas to authenticated;
set role authenticated;
select set_config('prueba.uid', '11111111-1111-1111-1111-111111111111', false);
insert into public.pj_cuentas (nombre, tipo, saldo) values ('Efectivo ahorrado', 'efectivo', 600);
insert into public.pj_cuentas (nombre, tipo, clave, saldo, fecha_saldo) values ('Bankinter', 'banco', 'bankinter', 1234.56, '2026-11-20');
select public.debe_fallar($q$insert into public.pj_cuentas (nombre, tipo, clave, saldo) values ('Otra', 'banco', 'bankinter', 1)$q$);  -- clave repetida
select public.debe_fallar($q$insert into public.pj_cuentas (nombre, tipo, saldo) values ('Hucha', 'bitcoin', 5)$q$);                     -- tipo que no existe
update public.pj_cuentas set saldo = 650 where nombre = 'Efectivo ahorrado';
select set_config('prueba.uid', '22222222-2222-2222-2222-222222222222', false);
do $$ begin assert (select count(*) from public.pj_cuentas) = 0, 'la persona 2 no ve cuentas ajenas'; end $$;
update public.pj_cuentas set saldo = 0;
select public.debe_fallar($q$insert into public.pj_cuentas (user_id, nombre, saldo) values ('11111111-1111-1111-1111-111111111111', 'Intruso', 1)$q$);
reset role;
do $$ begin
  assert (select count(*) from public.pj_cuentas) = 2, 'la persona 1 tiene sus dos cuentas';
  assert (select saldo from public.pj_cuentas where nombre = 'Efectivo ahorrado') = 650, 'su cambio se guardó y el de la persona 2 no';
end $$;
