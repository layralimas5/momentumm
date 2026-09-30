-- Momentumm — freio no contato do quiz.
--
-- O quiz é público e o contato (0039) grava uma vez por SESSÃO, mas a sessão
-- é um uuid que o navegador inventa. Um script gerando uuid novo a cada volta
-- enchia a lista de contatos do painel de lead falso: não vazava nada, mas
-- sujava o funil e o trabalho de quem responde os contatos.
--
-- Três freios, do mais estreito pro mais largo:
--
--   mesmo e-mail   já deixou contato nas últimas 24h: a segunda vez não
--                  grava e responde `false`, igual à sessão que já tem
--                  contato. Quem refaz o quiz não vira duas linhas.
--   mesmo IP       até 5 contatos por hora. Uma casa com três pessoas
--                  respondendo cabe; um script, não.
--   todo mundo     até 120 contatos por hora no total. É a válvula pro caso
--                  de o IP não vir no cabeçalho, ou vir de muitos lugares.
--
-- Estourar o limite é ERRO, não silêncio: o quiz principal guarda o contato
-- no navegador quando a gravação falha e tenta de novo depois
-- (`flushPendingLead`), então a pessoa de verdade que cair no limite não
-- perde nada, só grava mais tarde.
--
-- O IP não é guardado: vira um hash, e a linha morre em um dia.

create table if not exists public.quiz_lead_hits (
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists quiz_lead_hits_key_idx on public.quiz_lead_hits (key_hash, created_at desc);
create index if not exists quiz_lead_hits_created_idx on public.quiz_lead_hits (created_at);

-- O freio do e-mail repetido consulta por e-mail; sem índice seria varredura.
create index if not exists quiz_sessions_lead_email_idx
  on public.quiz_sessions (lead_email, lead_saved_at desc)
  where lead_email is not null;

alter table public.quiz_lead_hits enable row level security;
-- Sem política nenhuma: só a função abaixo, como dona, lê e escreve.
revoke all on table public.quiz_lead_hits from anon, authenticated;

comment on table public.quiz_lead_hits is
  'Contagem de contatos do quiz por origem (hash do IP), pro freio anti-spam. Vive um dia.';

/*
  De onde veio a chamada, pelo cabeçalho que o gateway do Supabase repassa.
  `null` quando não veio nada, e aí só o teto geral vale.
*/
create or replace function public.quiz_client_ip()
returns text
language sql
stable
set search_path = public
as $$
  select nullif(btrim(coalesce(
    h ->> 'cf-connecting-ip',
    h ->> 'x-real-ip',
    split_part(h ->> 'x-forwarded-for', ',', 1)
  )), '')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb as h) as req;
$$;

revoke all on function public.quiz_client_ip() from public, anon, authenticated;

create or replace function public.quiz_save_lead(
  p_session uuid,
  p_name text,
  p_email text,
  p_phone text default null,
  p_age integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.quiz_sessions%rowtype;
  v_name  text := nullif(btrim(left(coalesce(p_name, ''), 60)), '');
  v_email text := nullif(lower(btrim(left(coalesce(p_email, ''), 160))), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_age   smallint := case when p_age between 13 and 120 then p_age::smallint else null end;
  v_ip    text := public.quiz_client_ip();
  v_key   text;
begin
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'nome obrigatório' using errcode = '22023';
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][a-z]{2,}$' then
    raise exception 'e-mail inválido' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^[0-9]{10,15}$' then
    v_phone := null;
  end if;

  s := public.quiz_session_for_write(p_session);
  if s.id is null then
    raise exception 'sessão não encontrada' using errcode = '22023';
  end if;
  -- Já tem contato: a segunda tentativa não sobrescreve nem estoura.
  if s.lead_saved_at is not null then
    return false;
  end if;

  if exists (
    select 1 from public.quiz_sessions q
     where q.lead_email = v_email
       and q.lead_saved_at > now() - interval '24 hours'
  ) then
    return false;
  end if;

  delete from public.quiz_lead_hits where created_at < now() - interval '1 day';

  if (select count(*) from public.quiz_lead_hits where created_at > now() - interval '1 hour') >= 120 then
    raise exception 'muitos contatos agora, tente mais tarde' using errcode = 'P0001', hint = 'quiz_throttled';
  end if;

  if v_ip is not null then
    v_key := md5('quiz-lead:' || v_ip);
    if (
      select count(*) from public.quiz_lead_hits
       where key_hash = v_key and created_at > now() - interval '1 hour'
    ) >= 5 then
      raise exception 'muitos contatos agora, tente mais tarde' using errcode = 'P0001', hint = 'quiz_throttled';
    end if;
  end if;

  insert into public.quiz_lead_hits (key_hash) values (coalesce(v_key, 'sem-ip'));

  update public.quiz_sessions
     set lead_name = v_name,
         lead_email = v_email,
         lead_phone = v_phone,
         lead_age = v_age,
         lead_consent_at = now(),
         lead_saved_at = now(),
         updated_at = now()
   where id = p_session;

  return true;
end;
$$;

revoke all on function public.quiz_save_lead(uuid, text, text, text, integer) from public;
grant execute on function public.quiz_save_lead(uuid, text, text, text, integer) to anon, authenticated;
