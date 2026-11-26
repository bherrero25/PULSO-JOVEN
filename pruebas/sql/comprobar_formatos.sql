-- Formatos de extracto (sql/2026-11-formatos-extracto.sql): uno por firma y persona, y cada persona solo los suyos
grant select, insert, update, delete on public.pj_formatos_extracto to authenticated;
set role authenticated;
select set_config('prueba.uid', '11111111-1111-1111-1111-111111111111', false);
insert into public.pj_formatos_extracto (firma, formato) values ('f. op.|operacion|euros|tras op.', '{"cabecera": 3, "fecha": 0, "concepto": 1, "importe": 2}');
select public.debe_fallar($q$insert into public.pj_formatos_extracto (firma, formato) values ('f. op.|operacion|euros|tras op.', '{}')$q$);  -- la misma firma dos veces
select public.debe_fallar($q$insert into public.pj_formatos_extracto (firma, formato) values ('x', '[1, 2]')$q$);                            -- el formato es un objeto
insert into public.pj_formatos_extracto (firma, formato) values ('f. op.|operacion|euros|tras op.', '{"cabecera": 3, "fecha": 0, "concepto": 1, "importe": 2, "saldo": 3}')
  on conflict (user_id, firma) do update set formato = excluded.formato, actualizado = now();                                            -- así guarda la app
select set_config('prueba.uid', '22222222-2222-2222-2222-222222222222', false);
do $$ begin assert (select count(*) from public.pj_formatos_extracto) = 0, 'la persona 2 no ve formatos ajenos'; end $$;
insert into public.pj_formatos_extracto (firma, formato) values ('f. op.|operacion|euros|tras op.', '{"fecha": 1}');                      -- la suya, con la misma firma
update public.pj_formatos_extracto set formato = '{}' where firma like 'f. op.%';
select public.debe_fallar($q$insert into public.pj_formatos_extracto (user_id, firma, formato) values ('11111111-1111-1111-1111-111111111111', 'intruso', '{}')$q$);
reset role;
do $$ begin
  assert (select count(*) from public.pj_formatos_extracto) = 2, 'una fila por persona';
  assert (select formato->>'saldo' from public.pj_formatos_extracto where user_id = '11111111-1111-1111-1111-111111111111') = '3', 'el formato de la persona 1 se actualizó y el de la 2 no lo tocó';
end $$;
