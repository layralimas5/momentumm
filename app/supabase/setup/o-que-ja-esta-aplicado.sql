-- Momentumm — o que o banco REALMENTE tem, migration por migration.
--
-- Existe porque as duas respostas divergiram: `supabase migration list` diz
-- que o histórico parou na 0032, e o banco tem objetos da 0049, da 0050 e até
-- da 0056. Quase tudo foi aplicado pelo SQL Editor, que não escreve em
-- `supabase_migrations.schema_migrations`.
--
-- A diferença importa porque `supabase db push` confia no histórico: com ele
-- desatualizado, o push tenta reaplicar da 0033 em diante. Reaplicar é quase
-- sempre inofensivo aqui (as migrations usam `if not exists` e
-- `create or replace`), MENOS a 0052, que faz `update product_settings set
-- juntos = true` sem condição: ela LIGA o Juntos de novo, mesmo que ele
-- esteja desligado de propósito, e devolve os tetos de incentivo ao padrão.
--
-- Rodar no SQL Editor do painel e mandar o resultado. É UMA consulta, só
-- leitura, e o resultado cabe em duas linhas: uma com o que falta, outra com
-- as configurações que um push cego mexeria.

with objetos(versao, tipo, nome) as (
  values
    ('0033', 'constraint', 'ai_calls_kind_check'),
    ('0034', 'tabela',     'plan_trials'),
    ('0035', 'coluna',     'profiles.status_emoji'),
    ('0036', 'tabela',     'user_presence'),
    ('0037', 'funcao',     'evolution_qualifies'),
    ('0038', 'tabela',     'quiz_sessions'),
    ('0039', 'coluna',     'quiz_sessions.lead_name'),
    ('0040', 'coluna',     'plan_trials.notice_sent_at'),
    ('0041', 'funcao',     'admin_retention'),
    ('0042', 'funcao',     'admin_mrr_cents'),
    ('0043', 'funcao',     'admin_quiz_lead_detail'),
    ('0044', 'funcao',     'sanitize_error_message'),
    ('0045', 'funcao',     'admin_list_errors'),
    ('0046', 'tabela',     'quizzes'),
    ('0047', 'funcao',     'admin_session_max_age'),
    ('0048', 'funcao',     'meaningful_event_names'),
    ('0049', 'tabela',     'pair_invites'),
    ('0050', 'tabela',     'notification_preferences'),
    ('0051', 'funcao',     'grant_courtesy_to_staff'),
    ('0052', 'chave',      'plans.free/pairEncouragementsPerDay'),
    ('0053', 'funcao',     'pair_capacity_for'),
    ('0054', 'funcao',     'trial_notices_due'),
    ('0055', 'funcao',     'quiz_event_names'),
    ('0056', 'tabela',     'notification_rules')
),
conferido as (
  select
    o.versao,
    case o.tipo
      when 'tabela' then
        to_regclass('public.' || o.nome) is not null
      when 'funcao' then
        exists (
          select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = o.nome
        )
      when 'coluna' then
        exists (
          select 1 from information_schema.columns c
          where c.table_schema = 'public'
            and c.table_name = split_part(o.nome, '.', 1)
            and c.column_name = split_part(o.nome, '.', 2)
        )
      when 'constraint' then
        exists (select 1 from pg_constraint where conname = o.nome)
      when 'chave' then
        exists (
          select 1 from public.product_settings s
          where s.key = split_part(o.nome, '/', 1)
            and s.value ? split_part(o.nome, '/', 2)
        )
    end as aplicada
  from objetos o
)
select
  coalesce(
    (select string_agg(versao, ' ' order by versao) from conferido where not aplicada),
    'nenhuma'
  ) as faltando,
  (select count(*) from conferido where aplicada) as aplicadas_de_24,
  (select value ->> 'juntos' from public.product_settings where key = 'features') as juntos_ligado,
  (select value ->> 'sessionMinutes' from public.product_settings where key = 'admin.security') as sessao_admin_min;
