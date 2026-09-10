-- Momentumm — testes de autorização.
--
-- Roda contra o banco REAL (local ou um projeto de teste), dentro de uma
-- transação que termina em rollback: nada sobra. Ele não é um teste unitário
-- de aplicação — é a prova de que a RLS resiste a requisição direta na API,
-- que é o único cenário que importa. Filtro de frontend não participa daqui.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/authorization.sql
--
-- Saída esperada: uma linha por caso, todas com `ok`. Qualquer `FALHOU`
-- interrompe (ON_ERROR_STOP) e o rollback devolve o banco ao estado anterior.
--
-- ## Como ele finge ser cada usuário
--
-- O PostgREST autentica trocando pro papel `authenticated` e colocando o JWT
-- em `request.jwt.claims`. É exatamente isso que `entrar_como()` faz abaixo,
-- então `auth.uid()` e `auth.jwt()` respondem como responderiam numa
-- requisição de verdade. Nenhuma política é desligada em nenhum momento.

begin;

set local client_min_messages to warning;

-- ---------------------------------------------------------------------------
-- utilidades
-- ---------------------------------------------------------------------------

create or replace function pg_temp.entrar_como(quem uuid, nivel text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', quem::text, 'role', 'authenticated', 'aal', nivel)::text,
    true
  );
end;
$$;

create or replace function pg_temp.entrar_anonimo()
returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;

create or replace function pg_temp.voltar_admin_do_banco()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function pg_temp.checar(caso text, condicao boolean)
returns void language plpgsql as $$
begin
  if condicao then
    raise notice '  ok    %', caso;
  else
    raise exception 'FALHOU: %', caso;
  end if;
end;
$$;

/* Roda um comando esperando que a autorização RECUSE. */
create or replace function pg_temp.deve_recusar(caso text, comando text)
returns void language plpgsql as $$
begin
  begin
    execute comando;
  exception
    when insufficient_privilege or raise_exception then
      raise notice '  ok    % (recusado pelo banco)', caso;
      return;
  end;
  raise exception 'FALHOU: % — o comando passou e não devia', caso;
end;
$$;

-- ---------------------------------------------------------------------------
-- massa de teste
-- ---------------------------------------------------------------------------

select pg_temp.voltar_admin_do_banco();

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@teste.momentumm', '', now(), '{"name":"Usuária A"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@teste.momentumm', '', now(), '{"name":"Usuário B"}'),
  ('cccccccc-0000-4000-8000-000000000003', 'c@teste.momentumm', '', now(), '{"name":"Admin C"}');

-- O trigger `on_auth_user_created` já criou os perfis.

insert into public.objectives (id, user_id, title, type_slug, target, started_on, deadline)
values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Objetivo da A', 'estudo', 600, current_date, current_date + 30),
  ('22222222-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
   'Objetivo do B', 'estudo', 600, current_date, current_date + 30);

insert into public.tasks (id, user_id, title, day)
values
  ('33333333-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ação da A', current_date),
  ('44444444-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'Ação do B', current_date);

insert into public.user_roles (user_id, role) values
  ('cccccccc-0000-4000-8000-000000000003', 'admin');

-- ---------------------------------------------------------------------------
-- 1. o dono acessa os próprios dados
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001');

select pg_temp.checar(
  'A lê o próprio objetivo',
  (select count(*) from public.objectives where id = '11111111-0000-4000-8000-000000000001') = 1
);

select pg_temp.checar(
  'A lê a própria ação',
  (select count(*) from public.tasks where id = '33333333-0000-4000-8000-000000000001') = 1
);

-- ---------------------------------------------------------------------------
-- 2. A não enxerga, não altera e não apaga o que é do B
-- ---------------------------------------------------------------------------

select pg_temp.checar(
  'A não lê objetivo do B',
  (select count(*) from public.objectives where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0
);

select pg_temp.checar(
  'A não lê ação do B',
  (select count(*) from public.tasks where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0
);

/*
  Update e delete de linha alheia não estouram: o `using` da política some com
  a linha antes do comando chegar nela, e o Postgres responde "0 linhas". Por
  isso o teste confere o EFEITO no banco, não o erro — um teste que só
  esperasse exceção passaria mesmo com a política aberta.
*/
update public.tasks set title = 'invadida' where id = '44444444-0000-4000-8000-000000000002';
delete from public.tasks where id = '44444444-0000-4000-8000-000000000002';
delete from public.objectives where id = '22222222-0000-4000-8000-000000000002';

select pg_temp.voltar_admin_do_banco();
select pg_temp.checar(
  'a ação do B continua intacta depois da tentativa de A',
  (select title from public.tasks where id = '44444444-0000-4000-8000-000000000002') = 'Ação do B'
);
select pg_temp.checar(
  'o objetivo do B não foi apagado por A',
  (select count(*) from public.objectives where id = '22222222-0000-4000-8000-000000000002') = 1
);

-- ---------------------------------------------------------------------------
-- 3. inserir em nome de outro
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001');

select pg_temp.deve_recusar(
  'A não cria ação em nome do B',
  $cmd$insert into public.tasks (user_id, title, day)
        values ('bbbbbbbb-0000-4000-8000-000000000002', 'plantada', current_date)$cmd$
);

-- ---------------------------------------------------------------------------
-- 4. transferir a propriedade de um registro
-- ---------------------------------------------------------------------------

select pg_temp.deve_recusar(
  'A não transfere a própria ação para o B',
  $cmd$update public.tasks
          set user_id = 'bbbbbbbb-0000-4000-8000-000000000002'
        where id = '33333333-0000-4000-8000-000000000001'$cmd$
);

-- ---------------------------------------------------------------------------
-- 5. escalar privilégio pelo campo editável do perfil
-- ---------------------------------------------------------------------------

select pg_temp.deve_recusar(
  'A não vira PRO editando o próprio perfil',
  $cmd$update public.profiles set plan = 'pro'
        where id = 'aaaaaaaa-0000-4000-8000-000000000001'$cmd$
);

select pg_temp.deve_recusar(
  'A não se concede papel de admin',
  $cmd$insert into public.user_roles (user_id, role)
        values ('aaaaaaaa-0000-4000-8000-000000000001', 'admin')$cmd$
);

select pg_temp.checar(
  'A não enxerga o papel de outra pessoa',
  (select count(*) from public.user_roles where user_id <> 'aaaaaaaa-0000-4000-8000-000000000001') = 0
);

-- ---------------------------------------------------------------------------
-- 6. anônimo não acessa nada privado
-- ---------------------------------------------------------------------------

select pg_temp.entrar_anonimo();

select pg_temp.checar('anônimo não lê objetivo', (select count(*) from public.objectives) = 0);
select pg_temp.checar('anônimo não lê ação',     (select count(*) from public.tasks) = 0);
select pg_temp.checar('anônimo não lê hábito',   (select count(*) from public.habits) = 0);
select pg_temp.checar('anônimo não lê perfil',   (select count(*) from public.profiles) = 0);
select pg_temp.checar('anônimo não lê auditoria',(select count(*) from public.audit_logs) = 0);

-- ---------------------------------------------------------------------------
-- 7. rota administrativa recusa usuário comum
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001', 'aal2');

select pg_temp.checar('usuário comum, mesmo em aal2, não é admin', public.is_admin() = false);
select pg_temp.deve_recusar('usuário comum não passa por assert_admin', $cmd$select public.assert_admin()$cmd$);
select pg_temp.checar('usuário comum não lê auditoria', (select count(*) from public.audit_logs) = 0);

-- ---------------------------------------------------------------------------
-- 8. admin SEM MFA não executa ação crítica
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal1');

select pg_temp.checar('admin em aal1 não conta como admin', public.is_admin() = false);
select pg_temp.deve_recusar(
  'admin sem segundo fator é recusado em ação crítica',
  $cmd$select public.assert_admin()$cmd$
);
select pg_temp.checar(
  'admin sem segundo fator não lê auditoria',
  (select count(*) from public.audit_logs) = 0
);
select pg_temp.deve_recusar(
  'admin sem segundo fator não muda plano de ninguém',
  $cmd$update public.profiles set plan = 'pro'
        where id = 'aaaaaaaa-0000-4000-8000-000000000001'$cmd$
);

-- ---------------------------------------------------------------------------
-- 9. admin COM MFA executa, e a auditoria registra
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');

select pg_temp.checar('admin em aal2 é admin', public.is_admin() = true);
select public.assert_admin();
select pg_temp.checar('admin em aal2 passa por assert_admin', true);

select public.record_audit('teste.acao', 'objective', '11111111-0000-4000-8000-000000000001', 'ok', '{"origem":"suite"}'::jsonb);

select pg_temp.checar(
  'a auditoria carimbou o autor pelo servidor',
  (select actor_id from public.audit_logs where action = 'teste.acao')
    = 'cccccccc-0000-4000-8000-000000000003'
);

-- ---------------------------------------------------------------------------
-- 10. a auditoria não é editável nem apagável pelo frontend
-- ---------------------------------------------------------------------------

update public.audit_logs set action = 'adulterada' where action = 'teste.acao';
delete from public.audit_logs where action = 'teste.acao';

select pg_temp.voltar_admin_do_banco();
select pg_temp.checar(
  'nem o admin altera ou apaga linha de auditoria pela API',
  (select count(*) from public.audit_logs where action = 'teste.acao') = 1
);

-- ---------------------------------------------------------------------------
-- 11. arquivos privados: nada de listar ou ler a pasta do outro
-- ---------------------------------------------------------------------------

select pg_temp.voltar_admin_do_banco();

select pg_temp.checar(
  'o bucket de mídia é privado',
  (select public from storage.buckets where id = 'user-media') = false
);

insert into storage.objects (bucket_id, name, owner)
values ('user-media', 'bbbbbbbb-0000-4000-8000-000000000002/segredo.jpg',
        'bbbbbbbb-0000-4000-8000-000000000002');

select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001');

select pg_temp.checar(
  'A não lista o arquivo do B',
  (select count(*) from storage.objects where bucket_id = 'user-media') = 0
);

select pg_temp.deve_recusar(
  'A não escreve dentro da pasta do B',
  $cmd$insert into storage.objects (bucket_id, name, owner)
        values ('user-media', 'bbbbbbbb-0000-4000-8000-000000000002/plantado.jpg',
                'aaaaaaaa-0000-4000-8000-000000000001')$cmd$
);

select pg_temp.deve_recusar(
  'A não escapa da própria pasta com ..',
  $cmd$insert into storage.objects (bucket_id, name, owner)
        values ('user-media', 'aaaaaaaa-0000-4000-8000-000000000001/../bbbbbbbb-0000-4000-8000-000000000002/x.jpg',
                'aaaaaaaa-0000-4000-8000-000000000001')$cmd$
);

delete from storage.objects where bucket_id = 'user-media';
select pg_temp.voltar_admin_do_banco();
select pg_temp.checar(
  'o arquivo do B sobreviveu à tentativa de exclusão por A',
  (select count(*) from storage.objects
    where name like 'bbbbbbbb-0000-4000-8000-000000000002/%') = 1
);

-- ---------------------------------------------------------------------------
-- 12. excluir a conta leva os dados e os arquivos junto
-- ---------------------------------------------------------------------------

select pg_temp.voltar_admin_do_banco();
delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000002';

select pg_temp.checar(
  'os dados do B sumiram com a conta',
  (select count(*) from public.tasks where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0
  and (select count(*) from public.objectives where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0
  and (select count(*) from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0
);

select pg_temp.checar(
  'os arquivos do B sumiram com a conta',
  (select count(*) from storage.objects
    where name like 'bbbbbbbb-0000-4000-8000-000000000002/%') = 0
);

-- ---------------------------------------------------------------------------
-- 13. toda tabela do produto está com RLS ligada
-- ---------------------------------------------------------------------------

select pg_temp.checar(
  'nenhuma tabela do schema public está sem RLS',
  (select count(*) from pg_tables t
     join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
    where t.schemaname = 'public'
      and c.relrowsecurity = false) = 0
);

rollback;

\echo ''
\echo 'Suíte de autorização concluída. Todas as linhas acima devem estar como ok.'
