-- Atajo de Apple Pay (sql/2026-11-atajo-apple-pay.sql): cada persona ve solo su código y el atajo apunta pagos sin sesión
grant select, insert, update on public.pj_codigos_atajo to authenticated;
set role authenticated;
select set_config('prueba.uid', '11111111-1111-1111-1111-111111111111', false);
insert into public.pj_codigos_atajo (user_id) values (auth.uid());
do $$ begin assert (select count(*) from public.pj_codigos_atajo) = 1, 'la persona 1 ve su código'; end $$;
select set_config('prueba.uid', '22222222-2222-2222-2222-222222222222', false);
do $$ begin assert (select count(*) from public.pj_codigos_atajo) = 0, 'la persona 2 no ve el código de la 1'; end $$;
select public.debe_fallar($q$insert into public.pj_codigos_atajo (user_id) values ('11111111-1111-1111-1111-111111111111')$q$);
reset role;

select codigo as cod from public.pj_codigos_atajo \gset
set role anon;
select public.pj_apuntar_pago(:'cod', '12,50 €', 'MERCADONA VALENCIA');
select public.pj_apuntar_pago(:'cod', '€8.90', 'Cines Yelmo');
select public.pj_apuntar_pago(:'cod', '1.234,56 €', 'Zara');
select public.pj_apuntar_pago(:'cod', '-3,20 €', '');
select public.debe_fallar(format('select public.pj_apuntar_pago(%L, %L, %L)', :'cod', 'hola', 'X'));
select public.debe_fallar($q$select public.pj_apuntar_pago('00000000-0000-0000-0000-000000000000', '5 €', 'Intruso')$q$);
select public.debe_fallar('select count(*) from public.pj_codigos_atajo');
reset role;

do $$ begin
  assert (select array_agg(importe order by id) from public.pj_transacciones where cuenta = 'apple_pay') = array[12.50, 8.90, 1234.56, 3.20]::numeric[], 'los importes se entienden en todos los formatos';
  assert (select count(*) = 4 and bool_and(tipo = 'gasto' and categoria = '🔧 Otros' and user_id = '11111111-1111-1111-1111-111111111111') from public.pj_transacciones where cuenta = 'apple_pay'), 'entran como gasto de Apple Pay de la persona del código';
  assert (select descripcion from public.pj_transacciones where cuenta = 'apple_pay' order by id desc limit 1) = 'Pago con Apple Pay', 'sin comercio, se llama «Pago con Apple Pay»';
end $$;
