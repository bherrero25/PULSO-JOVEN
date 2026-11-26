-- Cuenta principal (sql/2026-11-cuenta-principal.sql): como mucho una por persona, y cada una elige la suya
grant select, insert, update, delete on public.pj_cuentas to authenticated;
set role authenticated;
select set_config('prueba.uid', '11111111-1111-1111-1111-111111111111', false);
insert into public.pj_cuentas (nombre, tipo, clave, saldo) values ('Nómina', 'banco', 'bankinter·1234', 100), ('Ahorro', 'banco', 'bankinter·5678', 200);
do $$ begin assert (select count(*) from public.pj_cuentas where principal) = 0, 'sin elegir, ninguna es principal'; end $$;
update public.pj_cuentas set principal = true where clave = 'bankinter·5678';
select public.debe_fallar($q$update public.pj_cuentas set principal = true where clave = 'bankinter·1234'$q$);  -- dos principales no
update public.pj_cuentas set principal = false where principal;                                                   -- cambiarla: primero quitar
update public.pj_cuentas set principal = true where clave = 'bankinter·1234';
select set_config('prueba.uid', '22222222-2222-2222-2222-222222222222', false);
insert into public.pj_cuentas (nombre, tipo, clave, saldo, principal) values ('BBVA', 'banco', 'bbva·0001', 5, true);  -- otra persona, su propia principal
reset role;
do $$ begin
  assert (select clave from public.pj_cuentas where principal and user_id = '11111111-1111-1111-1111-111111111111') = 'bankinter·1234', 'la persona 1 cambió su principal';
  assert (select count(*) from public.pj_cuentas where principal) = 2, 'una principal por persona';
end $$;
