-- Momentumm — testes de autorização do painel administrativo.
--
-- Roda contra o banco REAL, dentro de uma transação que termina em
-- rollback. Cada caso finge ser uma sessão (papel `authenticated` + claims
-- do JWT), exatamente como o PostgREST faz: `auth.uid()`, `auth.jwt()->>'aal'`
-- e o `amr` são lidos pelas funções como seriam numa requisição de verdade.
--
--   supabase db query --linked -f supabase/tests/admin-authorization.sql
--
-- Saída esperada: uma linha por caso, todas com `ok`. Qualquer `FALHOU`
-- interrompe e o rollback devolve o banco ao estado anterior.
--
-- O que ele prova (item 15 da especificação do painel):
--   1. usuário comum não acessa nada do painel
--   2. analista não executa ação operacional
--   3. suporte não altera plano, configuração nem papel
--   4. admin não acessa conteúdo pessoal (RLS + funções sem título/texto)
--   5. admin sem MFA, com sessão vencida ou sem verificação recente é barrado
--   6. ação crítica fica na auditoria, com autor, alvo e motivo
--   7. IA aparece só como métrica
--   8. logs de erro não guardam e-mail, token nem chave
--   9. acesso excepcional exige consentimento, expira e é revogável
--  10. exportação administrativa e exclusão seguem o fluxo autorizado
--  11. eventos de uso: só por função, só da lista, sem leitura pelo dono

begin;

set local client_min_messages to warning;

-- ---------------------------------------------------------------------------
-- utilidades
-- ---------------------------------------------------------------------------

create or replace function pg_temp.entrar_como(quem uuid, nivel text default 'aal1', minutos_desde_mfa integer default 0)
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', quem::text, 'role', 'authenticated', 'aal', nivel,
      'amr', case when nivel = 'aal2'
        then json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint - minutos_desde_mfa * 60))
        else json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint))
      end
    )::text,
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

create or replace function pg_temp.entrar_service_role()
returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
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

/* Roda um comando esperando que a autorização RECUSE, e confere a mensagem quando pedida. */
create or replace function pg_temp.deve_recusar(caso text, comando text, trecho text default null)
returns void language plpgsql as $$
begin
  begin
    execute comando;
  exception
    when others then
      if trecho is not null and position(trecho in sqlerrm) = 0 then
        raise exception 'FALHOU: % — recusou, mas com outra mensagem: %', caso, sqlerrm;
      end if;
      raise notice '  ok    % (recusado: %)', caso, left(sqlerrm, 60);
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
  ('cccccccc-0000-4000-8000-000000000003', 'c@teste.momentumm', '', now(), '{"name":"Admin C"}'),
  ('dddddddd-0000-4000-8000-000000000004', 'd@teste.momentumm', '', now(), '{"name":"Suporte D"}'),
  ('eeeeeeee-0000-4000-8000-000000000005', 'e@teste.momentumm', '', now(), '{"name":"Analista E"}'),
  ('ffffffff-0000-4000-8000-000000000006', 'f@teste.momentumm', '', now(), '{"name":"Owner F"}');

-- O trigger `on_auth_user_created` já criou os perfis.

insert into public.objectives (id, user_id, title, axis_slug, target, started_on, deadline)
values ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
        'Objetivo secreto da A', 'estudo', 600, current_date, current_date + 30);

insert into public.tasks (id, user_id, title, day)
values ('33333333-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ação secreta da A', current_date);

insert into public.user_roles (user_id, role) values
  ('cccccccc-0000-4000-8000-000000000003', 'admin'),
  ('dddddddd-0000-4000-8000-000000000004', 'support'),
  ('eeeeeeee-0000-4000-8000-000000000005', 'analyst'),
  ('ffffffff-0000-4000-8000-000000000006', 'owner');

-- Chamadas de IA da A, como a Edge Function grava (service role).
insert into public.ai_calls (user_id, kind, model, input_tokens, output_tokens, status, duration_ms)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'plan', 'claude-opus-5', 1200, 300, 'ok', 1800),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'day', 'claude-opus-5', 900, 200, 'ok', 1500),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'day', 'claude-opus-5', 0, 0, 'limite', null);

-- ---------------------------------------------------------------------------
-- 1. usuário comum não acessa o painel
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001', 'aal2');

select pg_temp.checar('usuário comum não tem papel', public.admin_role() is null);
select pg_temp.checar('usuário comum não é admin nem em aal2', public.is_admin() = false);
select pg_temp.deve_recusar('usuário comum não lê a visão geral', $c$select public.admin_overview(current_date - 7, current_date)$c$, 'sem permissão');
select pg_temp.deve_recusar('usuário comum não lista usuários', $c$select public.admin_list_users()$c$, 'sem permissão');
select pg_temp.deve_recusar('usuário comum não lê solicitações da fila', $c$select public.admin_list_requests()$c$, 'sem permissão');
select pg_temp.deve_recusar('usuário comum não lê configurações', $c$select public.admin_get_settings()$c$, 'sem permissão');
select pg_temp.deve_recusar('usuário comum não grava auditoria', $c$select public.record_admin_audit('x.y', 'user')$c$, 'sem permissão');
select pg_temp.checar('usuário comum não lê auditoria', (select count(*) from public.audit_logs) = 0);
select pg_temp.checar('usuário comum não lê eventos de uso', (select count(*) from public.product_events) = 0);
select pg_temp.checar('usuário comum não lê a central de erros', (select count(*) from public.app_errors) = 0);
select pg_temp.deve_recusar('usuário comum não lê configuração interna', $c$select public.setting_value('ai.limits')$c$);

select pg_temp.entrar_anonimo();
select pg_temp.deve_recusar('anônimo não pergunta quem é no painel', $c$select public.admin_me()$c$);
select pg_temp.deve_recusar('anônimo não registra evento', $c$select public.track_event('session_start')$c$);
select pg_temp.checar('anônimo lê só as configurações públicas', (public.public_settings() ? 'maintenance') and not (public.public_settings() ? 'ai.limits'));

-- ---------------------------------------------------------------------------
-- 2. analista: só métrica agregada
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('eeeeeeee-0000-4000-8000-000000000005', 'aal2');

select pg_temp.checar('analista lê a visão geral', (public.admin_overview(current_date - 7, current_date) -> 'totals' ->> 'users')::int >= 6);
select pg_temp.checar('analista lê métricas da IA', (public.admin_ai_metrics(current_date - 7, current_date) ->> 'calls')::int = 2);
select pg_temp.deve_recusar('analista não lista usuários', $c$select public.admin_list_users()$c$, 'sem permissão');
select pg_temp.deve_recusar('analista não abre detalhe de conta', $c$select public.admin_user_detail('aaaaaaaa-0000-4000-8000-000000000001')$c$, 'sem permissão');
select pg_temp.deve_recusar('analista não suspende', $c$select public.admin_suspend_user('aaaaaaaa-0000-4000-8000-000000000001', 'motivo qualquer')$c$, 'sem permissão');
select pg_temp.deve_recusar('analista não trabalha solicitação', $c$select public.admin_update_request('11111111-0000-4000-8000-000000000001', 'resolvida')$c$, 'sem permissão');
select pg_temp.deve_recusar('analista não altera erro', $c$select public.admin_set_error_status(gen_random_uuid(), 'resolvido')$c$, 'sem permissão');
select pg_temp.deve_recusar('analista não lê auditoria por função', $c$select public.admin_audit_list()$c$, 'sem permissão');
select pg_temp.checar('analista não lê auditoria por tabela', (select count(*) from public.audit_logs) = 0);
select pg_temp.checar('analista vê cancelamentos sem a lista de pessoas',
  jsonb_array_length(public.admin_cancellations(current_date - 30, current_date) -> 'items') = 0);

-- ---------------------------------------------------------------------------
-- 3. suporte: solicitações sim; plano, configuração e papel não
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('dddddddd-0000-4000-8000-000000000004', 'aal2');

select pg_temp.checar('suporte lê a fila', (public.admin_list_requests() ->> 'total')::int >= 0);
select pg_temp.checar('suporte lista usuários', (public.admin_list_users() ->> 'total')::int >= 6);
select pg_temp.deve_recusar('suporte não altera configuração', $c$select public.admin_update_setting('maintenance', '{"enabled":true,"message":""}'::jsonb, 'motivo qualquer')$c$, 'sem permissão');
select pg_temp.deve_recusar('suporte não concede papel', $c$select public.admin_grant_role('a@teste.momentumm', 'admin', 'motivo qualquer')$c$, 'sem permissão');
-- A política de update de profiles é do dono: pro suporte a linha nem aparece.
update public.profiles set plan = 'pro' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select pg_temp.voltar_admin_do_banco();
select pg_temp.checar('suporte não altera plano direto na tabela', (select plan from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001') = 'free');
select pg_temp.entrar_como('dddddddd-0000-4000-8000-000000000004', 'aal2');
select pg_temp.deve_recusar('suporte não suspende conta', $c$select public.admin_suspend_user('aaaaaaaa-0000-4000-8000-000000000001', 'motivo qualquer')$c$, 'sem permissão');
select pg_temp.deve_recusar('suporte não bloqueia IA', $c$select public.admin_block_ai('aaaaaaaa-0000-4000-8000-000000000001', 60, 'motivo qualquer')$c$, 'sem permissão');
select pg_temp.deve_recusar('suporte não exporta dado administrativo', $c$select public.admin_export_user_admin_data('aaaaaaaa-0000-4000-8000-000000000001', 'motivo qualquer')$c$, 'sem permissão');
select pg_temp.checar('suporte não lê auditoria', (select count(*) from public.audit_logs) = 0);
select pg_temp.checar('suporte não recebe assinatura no detalhe',
  not (public.admin_user_detail('aaaaaaaa-0000-4000-8000-000000000001') ? 'subscriptions'));

-- ---------------------------------------------------------------------------
-- 4. admin não acessa conteúdo pessoal
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');

select pg_temp.checar('admin em aal2 é admin', public.is_admin() = true);
select pg_temp.checar('admin não lê objetivo de ninguém pela tabela', (select count(*) from public.objectives) = 0);
select pg_temp.checar('admin não lê ação de ninguém pela tabela', (select count(*) from public.tasks) = 0);
select pg_temp.checar('admin não lê review de ninguém pela tabela', (select count(*) from public.weekly_reviews) = 0);
select pg_temp.checar('admin não lê registro de ninguém pela tabela', (select count(*) from public.activities where user_id <> auth.uid()) = 0);
select pg_temp.checar('detalhe da conta traz contagem, não título',
  (public.admin_user_detail('aaaaaaaa-0000-4000-8000-000000000001') ->> 'objectives_count')::int = 1
  and position('Objetivo secreto' in public.admin_user_detail('aaaaaaaa-0000-4000-8000-000000000001')::text) = 0
  and position('Ação secreta' in public.admin_user_detail('aaaaaaaa-0000-4000-8000-000000000001')::text) = 0);
select pg_temp.checar('lista de usuários não carrega título nem texto',
  position('secret' in public.admin_list_users()::text) = 0);
select pg_temp.checar('e-mail sai mascarado', public.admin_user_detail('aaaaaaaa-0000-4000-8000-000000000001') ->> 'email_masked' = 'a***@te***.momentumm');
select pg_temp.checar('e-mail inteiro não aparece', position('a@teste.momentumm' in public.admin_list_users()::text) = 0);

-- ---------------------------------------------------------------------------
-- 5. admin sem MFA, sessão vencida, verificação antiga
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal1');
select pg_temp.checar('admin em aal1 não é admin', public.is_admin() = false);
select pg_temp.deve_recusar('admin em aal1 não lê a visão geral', $c$select public.admin_overview(current_date - 7, current_date)$c$, 'duas etapas');
select pg_temp.deve_recusar('admin em aal1 não suspende', $c$select public.admin_suspend_user('aaaaaaaa-0000-4000-8000-000000000001', 'motivo qualquer')$c$, 'duas etapas');
select pg_temp.checar('admin em aal1 não lê auditoria', (select count(*) from public.audit_logs) = 0);

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2', 61);
select pg_temp.checar('sessão administrativa vence em uma hora', public.admin_session_valid() = false);
select pg_temp.deve_recusar('com verificação de 61 min a leitura é recusada', $c$select public.admin_list_users()$c$, 'expirada');

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2', 10);
select pg_temp.checar('com verificação de 10 min a leitura passa', (public.admin_list_users() ->> 'total')::int >= 6);
select pg_temp.checar('mas o step-up não vale', public.admin_step_up_valid() = false);
select pg_temp.deve_recusar('ação crítica exige verificação de até 5 min', $c$select public.admin_suspend_user('aaaaaaaa-0000-4000-8000-000000000001', 'motivo qualquer')$c$, 'novamente');
select pg_temp.deve_recusar('exportação administrativa exige verificação recente', $c$select public.admin_export_user_admin_data('aaaaaaaa-0000-4000-8000-000000000001', 'motivo qualquer')$c$, 'novamente');

-- ---------------------------------------------------------------------------
-- 6. ação crítica fica registrada
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');

select pg_temp.deve_recusar('sem motivo não suspende', $c$select public.admin_suspend_user('aaaaaaaa-0000-4000-8000-000000000001', 'x')$c$, 'motivo');
select pg_temp.deve_recusar('admin não suspende a si mesmo', $c$select public.admin_suspend_user('cccccccc-0000-4000-8000-000000000003', 'motivo qualquer')$c$);
select pg_temp.deve_recusar('admin não suspende o owner', $c$select public.admin_suspend_user('ffffffff-0000-4000-8000-000000000006', 'motivo qualquer')$c$);

select public.admin_suspend_user('aaaaaaaa-0000-4000-8000-000000000001', 'suspeita de conta invadida', '{"ip":"203.0.113.9"}'::jsonb);

-- As tabelas do GoTrue e o estado da conta não são legíveis pelo admin
-- pela API (nem devem ser): a conferência é feita como dono do banco.
select pg_temp.voltar_admin_do_banco();
select pg_temp.checar('suspensão bloqueia o login no GoTrue',
  (select banned_until from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001') > now());
select pg_temp.checar('suspensão fica no estado da conta',
  (select status from public.account_status where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 'suspensa');
select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select pg_temp.checar('a auditoria tem autor, papel, alvo, motivo e contexto',
  exists (select 1 from public.audit_logs
           where action = 'user.suspend'
             and actor_id = 'cccccccc-0000-4000-8000-000000000003'
             and actor_role = 'admin'
             and target_user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
             and reason = 'suspeita de conta invadida'
             and context ->> 'ip' = '203.0.113.9'));
-- Sem política de update/delete a RLS não explode: ela ignora a linha. A
-- prova é a linha continuar igual depois da tentativa.
update public.audit_logs set reason = 'outro' where action = 'user.suspend';
select pg_temp.checar('admin não edita a auditoria', (select count(*) from public.audit_logs where action = 'user.suspend' and reason = 'suspeita de conta invadida') = 1);
delete from public.audit_logs where action = 'user.suspend';
select pg_temp.checar('admin não apaga a auditoria', (select count(*) from public.audit_logs where action = 'user.suspend') = 1);
select pg_temp.deve_recusar('admin não insere auditoria falsa direto na tabela', $c$insert into public.audit_logs (actor_id, action, resource_type) values ('ffffffff-0000-4000-8000-000000000006', 'user.suspend', 'user')$c$);

select public.admin_reactivate_user('aaaaaaaa-0000-4000-8000-000000000001', 'falso alarme');
select pg_temp.checar('reativação fica na auditoria', exists (select 1 from public.audit_logs where action = 'user.reactivate'));
select pg_temp.voltar_admin_do_banco();
select pg_temp.checar('reativação limpa o bloqueio', (select banned_until from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001') is null);
select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');

-- ---------------------------------------------------------------------------
-- 7. IA só como métrica
-- ---------------------------------------------------------------------------

select pg_temp.checar('métricas da IA contam só as concluídas',
  (public.admin_ai_metrics(current_date - 7, current_date) ->> 'calls')::int = 2
  and (public.admin_ai_metrics(current_date - 7, current_date) ->> 'limits_hit')::int = 1
  and (public.admin_ai_metrics(current_date - 7, current_date) -> 'by_kind' -> 'day' ->> 'ok')::int = 1);
select pg_temp.checar('uso de IA da conta é contagem por função',
  (public.admin_user_detail('aaaaaaaa-0000-4000-8000-000000000001') ->> 'ai_calls_total')::int = 2);
select pg_temp.checar('a tabela de chamadas não tem coluna de prompt nem resposta',
  not exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'ai_calls'
                 and column_name in ('prompt', 'response', 'context', 'content', 'messages')));

-- ---------------------------------------------------------------------------
-- 8. logs sem conteúdo privado
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001', 'aal1');
select public.report_error('planner.save_failed', 'planner',
  'Falha para fulana@exemplo.com com Bearer abc.def.ghi e chave sk-ant-api03-xyz e eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
  'producao', '0.1.0', 'alta');

-- A tabela de erros não tem política de leitura nem pra admin: o painel lê
-- pela função. A conferência do que foi gravado é feita como dono do banco.
select pg_temp.voltar_admin_do_banco();
select pg_temp.checar('o erro entrou sem e-mail, token nem chave',
  exists (select 1 from public.app_errors e
           where e.code = 'planner.save_failed'
             and position('fulana@' in e.message) = 0
             and position('abc.def.ghi' in e.message) = 0
             and position('sk-ant-' in e.message) = 0
             and position('eyJhbGci' in e.message) = 0
             and position('[email]' in e.message) > 0));
select pg_temp.checar('a pessoa afetada vira hash, não id',
  exists (select 1 from public.app_error_occurrences o
           where o.user_hash is not null and o.user_hash <> 'aaaaaaaa-0000-4000-8000-000000000001' and length(o.user_hash) = 64));

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select pg_temp.checar('admin não lê a tabela de erros direto', (select count(*) from public.app_errors) = 0);
select pg_temp.checar('a central mostra o erro agregado, já sanitizado',
  (public.admin_list_errors() ->> 'total')::int >= 1
  and position('fulana@' in public.admin_list_errors()::text) = 0);
select pg_temp.deve_recusar('auditoria recusa metadado grande (não é depósito de payload)',
  $c$select public.record_admin_audit('x.y', 'user', null, null, 'ok', null, null, ('{"dump":"' || repeat('a', 5000) || '"}')::jsonb)$c$);

-- ---------------------------------------------------------------------------
-- 9. acesso excepcional: consentimento, expiração, revogação
-- ---------------------------------------------------------------------------

-- A abre uma solicitação.
select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001', 'aal1');
select set_config('momentumm_test.t_req', public.open_support_request('suporte', 'Meu plano sumiu', 'Depois de atualizar, o plano do objetivo desapareceu.') ->> 'id', true);
select pg_temp.checar('a solicitação nasce com protocolo e prazo',
  exists (select 1 from public.support_requests r where r.id = current_setting('momentumm_test.t_req')::uuid and r.protocol like 'MM-%' and r.due_at > now()));
select pg_temp.checar('A lê a própria solicitação', (select count(*) from public.support_requests) = 1);

-- B não vê a solicitação da A.
select pg_temp.entrar_como('bbbbbbbb-0000-4000-8000-000000000002', 'aal1');
select pg_temp.checar('B não lê a solicitação da A', (select count(*) from public.support_requests) = 0);
select pg_temp.deve_recusar('B não responde na solicitação da A', $c$select public.add_support_message(current_setting('momentumm_test.t_req')::uuid, 'oi')$c$);

-- C (admin) pede acesso. Sem step-up recente, não.
select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2', 10);
select pg_temp.deve_recusar('pedir acesso exige verificação recente',
  $c$select public.admin_request_content_access(current_setting('momentumm_test.t_req')::uuid, 'preciso ver o plano pra reproduzir', array['objetivos','acoes']::public.content_scope[], 24)$c$, 'novamente');

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select set_config('momentumm_test.t_grant', public.admin_request_content_access(current_setting('momentumm_test.t_req')::uuid, 'preciso ver o plano pra reproduzir', array['objetivos','acoes']::public.content_scope[], 24) ->> 'id', true);
select pg_temp.deve_recusar('pendente não pode ser lido', $c$select public.admin_read_scoped_content(current_setting('momentumm_test.t_grant')::uuid)$c$, 'não está ativo');
select pg_temp.deve_recusar('não abre um segundo pedido na mesma solicitação',
  $c$select public.admin_request_content_access(current_setting('momentumm_test.t_req')::uuid, 'outro motivo qualquer', array['reviews']::public.content_scope[], 24)$c$, 'em aberto');

-- A consente.
select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001', 'aal1');
select pg_temp.checar('A vê o pedido pendente', (public.my_content_access_grants() -> 0 ->> 'status') = 'pendente');
select public.respond_content_access(current_setting('momentumm_test.t_grant')::uuid, 'consentir');
select pg_temp.checar('A vê o acesso ativo', (public.my_content_access_grants() -> 0 ->> 'status') = 'ativo');
select pg_temp.voltar_admin_do_banco();
select pg_temp.checar('o acesso ficou ativo com prazo de 24h',
  exists (select 1 from public.support_access_grants g where g.id = current_setting('momentumm_test.t_grant')::uuid and g.status = 'ativo' and g.expires_at between now() + interval '23 hours' and now() + interval '25 hours'));

-- D (suporte) não lê o acesso que C pediu.
select pg_temp.entrar_como('dddddddd-0000-4000-8000-000000000004', 'aal2');
select pg_temp.deve_recusar('só quem pediu lê', $c$select public.admin_read_scoped_content(current_setting('momentumm_test.t_grant')::uuid)$c$, 'quem pediu');

-- C lê: só o escopo, e a leitura fica registrada.
select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select pg_temp.checar('a leitura devolve só o escopo consentido',
  (public.admin_read_scoped_content(current_setting('momentumm_test.t_grant')::uuid) ? 'objetivos')
  and (public.admin_read_scoped_content(current_setting('momentumm_test.t_grant')::uuid) ? 'acoes')
  and not (public.admin_read_scoped_content(current_setting('momentumm_test.t_grant')::uuid) ? 'reviews'));
select pg_temp.checar('cada leitura vira uma linha de auditoria com o escopo',
  (select count(*) from public.audit_logs where action = 'content_access.read' and result = 'ok'
     and target_user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and after -> 'scopes' is not null) >= 1);

-- Expira: o prazo passa e a leitura para.
select pg_temp.voltar_admin_do_banco();
update public.support_access_grants set expires_at = now() - interval '1 minute' where id = current_setting('momentumm_test.t_grant')::uuid;
select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select pg_temp.deve_recusar('acesso vencido não lê mais', $c$select public.admin_read_scoped_content(current_setting('momentumm_test.t_grant')::uuid)$c$, 'não está ativo');
select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001', 'aal1');
select pg_temp.checar('a pessoa vê como expirado', (select public.access_grant_effective_status(g) from public.support_access_grants g where g.id = current_setting('momentumm_test.t_grant')::uuid) = 'expirado');

-- Revoga: novo pedido, consentido, e a pessoa revoga antes do prazo.
select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select set_config('momentumm_test.t_grant2', public.admin_request_content_access(current_setting('momentumm_test.t_req')::uuid, 'ainda preciso conferir o plano', array['objetivos']::public.content_scope[], 2) ->> 'id', true);
select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001', 'aal1');
select public.respond_content_access(current_setting('momentumm_test.t_grant2')::uuid, 'consentir');
select public.respond_content_access(current_setting('momentumm_test.t_grant2')::uuid, 'revogar');
select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select pg_temp.deve_recusar('acesso revogado não lê', $c$select public.admin_read_scoped_content(current_setting('momentumm_test.t_grant2')::uuid)$c$, 'não está ativo');

-- Ninguém pede acesso ao próprio conteúdo.
select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal1');
select set_config('momentumm_test.t_req_c', public.open_support_request('suporte', 'Minha própria dúvida', 'Texto.') ->> 'id', true);
select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select pg_temp.deve_recusar('admin não pede acesso ao próprio conteúdo',
  $c$select public.admin_request_content_access(current_setting('momentumm_test.t_req_c')::uuid, 'quero ver o meu mesmo', array['objetivos']::public.content_scope[], 24)$c$, 'próprio');

-- ---------------------------------------------------------------------------
-- 10. exportação e exclusão seguem o fluxo
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select pg_temp.deve_recusar('exclusão sem solicitação da pessoa é recusada',
  $c$select public.admin_start_deletion('aaaaaaaa-0000-4000-8000-000000000001', current_setting('momentumm_test.t_req')::uuid, 'pediu por e-mail')$c$, 'aberta pela própria pessoa');

select pg_temp.entrar_como('aaaaaaaa-0000-4000-8000-000000000001', 'aal1');
select set_config('momentumm_test.t_del', public.open_support_request('exclusao', 'Quero apagar minha conta', 'Não uso mais.') ->> 'id', true);

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select public.admin_start_deletion('aaaaaaaa-0000-4000-8000-000000000001', current_setting('momentumm_test.t_del')::uuid, 'solicitação da própria pessoa');
select pg_temp.checar('exclusão ficou na auditoria com a solicitação',
  exists (select 1 from public.audit_logs where action = 'user.deletion_start' and after ->> 'request_id' = current_setting('momentumm_test.t_del')));
select pg_temp.voltar_admin_do_banco();
select pg_temp.checar('exclusão agendada pra 7 dias, com login bloqueado',
  exists (select 1 from public.account_status s where s.user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
           and s.status = 'exclusao_solicitada' and s.scheduled_for between now() + interval '6 days' and now() + interval '8 days')
  and (select banned_until from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001') > now());
select pg_temp.entrar_service_role();
select pg_temp.checar('a remoção física ainda não está liberada', public.deletion_ready('aaaaaaaa-0000-4000-8000-000000000001') = false);

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select set_config('momentumm_test.export', public.admin_export_user_admin_data('aaaaaaaa-0000-4000-8000-000000000001', 'auditoria interna')::text, true);
select pg_temp.checar('exportação administrativa sai sem conteúdo pessoal',
  position('secret' in current_setting('momentumm_test.export')) = 0
  and position('a@teste.momentumm' in current_setting('momentumm_test.export')) = 0
  and current_setting('momentumm_test.export') like '%momentumm.admin-export.v1%');
select pg_temp.checar('exportação administrativa fica registrada',
  exists (select 1 from public.audit_logs where action = 'user.export_admin_data' and target_user_id = 'aaaaaaaa-0000-4000-8000-000000000001'));

-- ---------------------------------------------------------------------------
-- 11. eventos de uso e configurações
-- ---------------------------------------------------------------------------

select pg_temp.entrar_como('bbbbbbbb-0000-4000-8000-000000000002', 'aal1');
select public.track_event('feature_view', 'hoje', '{"kind":"x","note":"texto que não deve entrar"}'::jsonb);
select pg_temp.deve_recusar('evento fora da lista é recusado', $c$select public.track_event('digitou_texto')$c$, 'desconhecido');
select pg_temp.deve_recusar('dono não insere evento direto', $c$insert into public.product_events (user_id, name) values (auth.uid(), 'session_start')$c$);
select pg_temp.checar('dono não lê os próprios eventos', (select count(*) from public.product_events) = 0);

select pg_temp.voltar_admin_do_banco();
select pg_temp.checar('metadado desconhecido foi descartado',
  exists (select 1 from public.product_events e where e.user_id = 'bbbbbbbb-0000-4000-8000-000000000002'
           and e.metadata ? 'kind' and not (e.metadata ? 'note')));

select pg_temp.entrar_como('ffffffff-0000-4000-8000-000000000006', 'aal2');
select public.admin_update_setting('maintenance', '{"enabled":true,"message":"Voltamos em 10 minutos"}'::jsonb, 'deploy da 0028');
select pg_temp.checar('owner altera configuração e o antes/depois fica na auditoria',
  exists (select 1 from public.audit_logs where action = 'setting.update' and resource_id = 'maintenance'
           and (before ->> 'enabled')::boolean = false and (after ->> 'enabled')::boolean = true));
select pg_temp.deve_recusar('configuração fora do formato é recusada',
  $c$select public.admin_update_setting('maintenance', '{"enabled":"sim"}'::jsonb, 'motivo qualquer')$c$, 'formato');
select pg_temp.deve_recusar('owner não altera o próprio papel', $c$select public.admin_revoke_role('ffffffff-0000-4000-8000-000000000006', 'motivo qualquer')$c$);
select pg_temp.deve_recusar('papel exige MFA ativo na conta alvo', $c$select public.admin_grant_role('b@teste.momentumm', 'support', 'entrou na equipe')$c$, 'duas etapas');
-- Cancelamento: B vira PRO pelo caminho da assinatura e pede pra sair.
select pg_temp.voltar_admin_do_banco();
select set_config('momentumm.plan_sync', '1', true);
update public.profiles set plan = 'pro' where id = 'bbbbbbbb-0000-4000-8000-000000000002';
select set_config('momentumm.plan_sync', '', true);
select pg_temp.entrar_como('bbbbbbbb-0000-4000-8000-000000000002', 'aal1');
select public.request_cancellation('preco', 'comentário privado da B');
select pg_temp.deve_recusar('um pedido de cancelamento por vez', $c$select public.request_cancellation('outro', null)$c$, 'em andamento');

select pg_temp.entrar_como('ffffffff-0000-4000-8000-000000000006', 'aal2');
select pg_temp.checar('owner lê o comentário do cancelamento',
  (public.admin_cancellations(current_date - 1, current_date) -> 'items' -> 0 ->> 'comment') = 'comentário privado da B');
select pg_temp.entrar_como('dddddddd-0000-4000-8000-000000000004', 'aal2');
select pg_temp.checar('suporte vê o pedido sem o comentário',
  (public.admin_cancellations(current_date - 1, current_date) -> 'items' -> 0 ->> 'reason') = 'preco'
  and (public.admin_cancellations(current_date - 1, current_date) -> 'items' -> 0 -> 'comment') = 'null'::jsonb);
select pg_temp.entrar_como('ffffffff-0000-4000-8000-000000000006', 'aal2');

select pg_temp.entrar_como('cccccccc-0000-4000-8000-000000000003', 'aal2');
select pg_temp.deve_recusar('admin não altera configuração', $c$select public.admin_update_setting('maintenance', '{"enabled":false,"message":""}'::jsonb, 'motivo qualquer')$c$, 'sem permissão');
select pg_temp.deve_recusar('admin não concede papel', $c$select public.admin_grant_role('b@teste.momentumm', 'support', 'motivo qualquer')$c$, 'sem permissão');

select pg_temp.entrar_anonimo();
select pg_temp.checar('manutenção ligada aparece pra qualquer sessão', (public.public_settings() -> 'maintenance' ->> 'enabled')::boolean = true);

select pg_temp.voltar_admin_do_banco();

rollback;
