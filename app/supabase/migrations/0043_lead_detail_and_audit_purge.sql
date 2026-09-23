-- Momentumm — a ficha do contato do quiz, e a limpeza da auditoria.
--
-- 1. `admin_quiz_lead_detail` abre uma sessão do quiz inteira: contato,
--    respostas, diagnóstico que a pessoa viu, origem e a linha do tempo dos
--    eventos. É a ficha que a lista não cabe.
-- 2. `admin_purge_audit` apaga auditoria ANTIGA, por data de corte, e grava
--    o próprio expurgo. De propósito não existe apagar uma linha escolhida:
--    log onde se escolhe o que some não prova nada, e a primeira linha que
--    alguém apagaria seria justamente a que incrimina. Aqui dá pra limpar
--    ruído velho e continua dando pra provar que a limpeza aconteceu.

-- ---------------------------------------------------------------------------
-- ficha do contato
-- ---------------------------------------------------------------------------

create or replace function public.admin_quiz_lead_detail(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sessao public.quiz_sessions;
begin
  perform public.assert_admin_role('owner', 'admin', 'support');

  select * into sessao from public.quiz_sessions where id = p_session;
  if not found then
    raise exception 'contato não encontrado' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', sessao.id,
    'name', sessao.lead_name,
    'email', sessao.lead_email,
    'phone', sessao.lead_phone,
    'age', sessao.lead_age,
    'consent_at', sessao.lead_consent_at,
    'status', sessao.status::text,
    'step', sessao.current_step,
    'answers', sessao.answers,
    'diagnosis', sessao.diagnosis,
    'theme', sessao.theme,
    'source', jsonb_build_object(
      'utm_source', sessao.utm_source,
      'utm_medium', sessao.utm_medium,
      'utm_campaign', sessao.utm_campaign,
      'utm_content', sessao.utm_content
    ),
    'entered_at', sessao.entered_at,
    'completed_at', sessao.completed_at,
    'abandoned_at', sessao.abandoned_at,
    'linked_at', sessao.linked_at,
    'activated_at', sessao.activated_at,
    'has_account', sessao.user_id is not null,
    /*
      O id da conta só pra quem pode agir sobre conta: o suporte vê que
      virou conta, mas não ganha o atalho pra ficha pessoal por aqui.
    */
    'user_id', case when public.admin_role() in ('owner', 'admin') then to_jsonb(sessao.user_id) else 'null'::jsonb end,
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', e.name, 'step', e.step, 'at', e.created_at
      ) order by e.created_at)
        from public.quiz_events e
       where e.session_id = p_session
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_quiz_lead_detail(uuid) from public, anon;
grant execute on function public.admin_quiz_lead_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- expurgo da auditoria
-- ---------------------------------------------------------------------------

/* O corte mais recente que o expurgo aceita: nada dos últimos 90 dias sai. */
create or replace function public.audit_purge_floor()
returns interval
language sql
immutable
as $$ select interval '90 days' $$;

create or replace function public.admin_purge_audit(p_before date, p_reason text, p_context jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  corte timestamptz := p_before::timestamptz;
  apagados bigint;
begin
  perform public.assert_admin_step_up('owner');

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'o motivo é obrigatório' using errcode = '22023';
  end if;

  /*
    A janela recente é intocável.

    Sem esse piso, "limpar a auditoria" viraria o último passo de qualquer
    ação que alguém quisesse esconder, e o log deixaria de valer como prova
    justo no período em que ela importa.
  */
  if corte > now() - public.audit_purge_floor() then
    raise exception 'só dá pra apagar auditoria com mais de 90 dias' using errcode = '22023';
  end if;

  delete from public.audit_logs where created_at < corte;
  get diagnostics apagados = row_count;

  /* O expurgo entra no próprio log, e este registro não é apagável por ele mesmo. */
  perform public.record_admin_audit('audit.purge', 'audit_logs', null, null, 'ok', btrim(p_reason),
    null, jsonb_build_object('antes_de', p_before, 'linhas', apagados), p_context);

  return jsonb_build_object('deleted', apagados);
end;
$$;

revoke all on function public.admin_purge_audit(date, text, jsonb) from public, anon;
grant execute on function public.admin_purge_audit(date, text, jsonb) to authenticated;
