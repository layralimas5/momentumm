-- Momentumm — a camada de segurança está mesmo no banco?
--
-- Roda no SQL Editor do Supabase e NÃO altera nada: é só leitura de catálogo.
-- Serve pra confirmar que as migrations 0013, 0014 e 0015 chegaram inteiras —
-- aplicar SQL colando no editor é o caminho normal aqui, e o caminho normal
-- também é o que falha na metade sem avisar.
--
-- Leitura: toda linha precisa dizer `ok`. Qualquer `FALTA` é uma peça da
-- proteção que não está lá, e o nome da linha diz qual.

select item, case when presente then 'ok' else 'FALTA' end as estado
from (

  -- ---- 0013: papéis --------------------------------------------------------
  select 'tabela: user_roles' as item,
         to_regclass('public.user_roles') is not null as presente, 1 as ordem
  union all
  select 'RLS ligada: user_roles',
         coalesce((select relrowsecurity from pg_class
                    where oid = to_regclass('public.user_roles')), false), 2
  union all
  -- Uma política só, e de leitura: conceder papel não pode passar pela API.
  select 'user_roles tem SÓ política de leitura',
         (select count(*) from pg_policies
           where schemaname = 'public' and tablename = 'user_roles') = 1
         and exists (select 1 from pg_policies
                      where schemaname = 'public' and tablename = 'user_roles'
                        and cmd = 'SELECT'), 3

  -- ---- 0013: as duas perguntas --------------------------------------------
  union all
  select 'função: is_admin()',
         to_regprocedure('public.is_admin()') is not null, 4
  union all
  select 'função: assert_admin()',
         to_regprocedure('public.assert_admin()') is not null, 5
  union all
  -- Sem isso o "MFA obrigatório pra admin" não existe: seria só papel.
  select 'is_admin() exige aal2 (segundo fator)',
         coalesce((select prosrc like '%aal2%'
                     from pg_proc where oid = to_regprocedure('public.is_admin()')), false), 6
  union all
  select 'anon NÃO executa is_admin()',
         not coalesce(has_function_privilege('anon', to_regprocedure('public.is_admin()'), 'execute'), false), 7

  -- ---- 0013: auditoria -----------------------------------------------------
  union all
  select 'tabela: audit_logs',
         to_regclass('public.audit_logs') is not null, 8
  union all
  select 'RLS ligada: audit_logs',
         coalesce((select relrowsecurity from pg_class
                    where oid = to_regclass('public.audit_logs')), false), 9
  union all
  -- A ausência de política de escrita É a proteção: com RLS ligada, o que não
  -- tem política é negado. Se aparecer INSERT/UPDATE/DELETE aqui, alguém abriu.
  select 'audit_logs não aceita escrita pela API',
         (select count(*) from pg_policies
           where schemaname = 'public' and tablename = 'audit_logs'
             and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')) = 0, 10
  union all
  select 'função: record_audit()',
         to_regprocedure('public.record_audit(text,text,text,text,jsonb)') is not null, 11

  -- ---- 0013: a falha que motivou tudo --------------------------------------
  union all
  select 'trigger que fecha profiles.plan',
         exists (select 1 from pg_trigger
                  where tgname = 'profiles_guard_privileges' and not tgisinternal), 12
  union all
  select 'limite de tamanho do avatar',
         exists (select 1 from pg_constraint where conname = 'profiles_avatar_size'), 13

  -- ---- 0014: storage privado -----------------------------------------------
  union all
  select 'bucket user-media existe',
         exists (select 1 from storage.buckets where id = 'user-media'), 14
  union all
  select 'bucket user-media é PRIVADO',
         coalesce((select not public from storage.buckets where id = 'user-media'), false), 15
  union all
  select 'bucket tem limite de tamanho e de tipo',
         coalesce((select file_size_limit is not null and allowed_mime_types is not null
                     from storage.buckets where id = 'user-media'), false), 16
  union all
  select 'as 4 políticas de storage por dono',
         (select count(*) from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and policyname like 'user-media%') = 4, 17
  union all
  select 'arquivo é apagado junto com a conta',
         exists (select 1 from pg_trigger
                  where tgname = 'profiles_purge_media' and not tgisinternal), 18

  -- ---- 0015: políticas por comando -----------------------------------------
  union all
  select 'molde: apply_owner_policies()',
         to_regprocedure('public.apply_owner_policies(text,text)') is not null, 19
  union all
  -- 11 tabelas x 4 comandos. Menos que isso significa que o laço não rodou
  -- inteiro, e alguma tabela ficou com a política antiga ou com nenhuma.
  select 'as 44 políticas de dono (11 tabelas x 4)',
         (select count(*) from pg_policies
           where schemaname = 'public'
             and (policyname like '%\_owner\_select' or policyname like '%\_owner\_insert'
               or policyname like '%\_owner\_update' or policyname like '%\_owner\_delete')) = 44, 20
  union all
  select 'nenhuma política `for all` sobrou nas tabelas de dono',
         (select count(*) from pg_policies
           where schemaname = 'public' and cmd = 'ALL'
             and tablename in ('goals','check_ins','habits','habit_logs','tasks','wins',
                               'objectives','weekly_reviews','plan_stages','journey_events',
                               'follows')) = 0, 21
  union all
  select 'função: delete_my_account()',
         to_regprocedure('public.delete_my_account()') is not null, 22

  -- ---- o piso que nunca pode cair ------------------------------------------
  union all
  select 'TODA tabela do schema public com RLS ligada',
         (select count(*) from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
             and not c.relrowsecurity) = 0, 23

) as checagem
order by ordem;

-- ---------------------------------------------------------------------------
-- Se alguma linha acima falhar, esta lista diz quais tabelas estão sem RLS.
-- ---------------------------------------------------------------------------

select c.relname as tabela_sem_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
   and not c.relrowsecurity
 order by 1;
