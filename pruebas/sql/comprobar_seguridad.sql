-- Permisos sin sesión (sql/2026-11-seguridad.sql): anon no tiene acceso a ninguna tabla de Pulso Joven; authenticated sí,
-- y el atajo de Apple Pay sigue funcionando sin sesión
do $$ begin
  assert not exists (select 1 from pg_tables where schemaname = 'public' and tablename like 'pj\_%'
                     and (has_table_privilege('anon', format('public.%I', tablename), 'select') or has_table_privilege('anon', format('public.%I', tablename), 'insert'))),
         'anon no tiene acceso a ninguna tabla pj_';
  assert not exists (select 1 from pg_tables where schemaname = 'public' and tablename like 'pj\_%' and not has_table_privilege('authenticated', format('public.%I', tablename), 'select')),
         'authenticated conserva el acceso (RLS decide qué filas)';
  assert has_function_privilege('anon', 'public.pj_apuntar_pago(uuid, text, text)', 'execute'), 'el atajo se puede llamar sin sesión';
end $$;
set role anon;
select public.debe_fallar('select count(*) from public.pj_transacciones');
select public.debe_fallar('select count(*) from public.pj_cuentas');
reset role;
