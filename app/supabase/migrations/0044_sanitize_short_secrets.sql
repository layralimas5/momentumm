-- Momentumm — segredo curto também some do log de erros.
--
-- Um `refresh_token` do Supabase entrou na central de erros inteiro. Ele
-- veio na URL de recuperação de senha (`#access_token=...&refresh_token=...`)
-- junto de um SyntaxError, e passou por baixo de todas as regras: não é JWT,
-- não tem prefixo de chave conhecida e é curto demais pra regra de sequência
-- longa. Só que ele vale uma sessão inteira.
--
-- A regra nova olha o NOME do parâmetro em vez do formato do valor. O
-- cliente aplica a mesma coisa (`sanitizeErrorMessage`); esta aqui é a que
-- vale pra quem chamar a API na mão.
--
-- Os registros que já estão gravados são limpos no fim.

create or replace function public.sanitize_error_message(p_message text)
returns text
language sql
immutable
as $$
  select left(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(coalesce(p_message, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g'),
            'Bearer\s+[A-Za-z0-9._-]+', 'Bearer [token]', 'g'),
          'eyJ[A-Za-z0-9._-]{20,}', '[jwt]', 'g'),
        '(sk-ant-|sb_secret_|sbp_)[A-Za-z0-9_-]+', '[chave]', 'g'),
      '(access_token|refresh_token|id_token|token|code|secret|password|senha|api_?key)=[^&[:space:]''"]+',
      '\1=[oculto]', 'gi'),
    200
  );
$$;

/*
  O que já foi gravado continua gravado até aqui.

  Trocar a função protege o próximo erro, não o de ontem, e o token de
  ontem é tão válido quanto o de hoje enquanto a sessão dele viver.
*/
update public.app_errors
   set message = public.sanitize_error_message(message)
 where message ~* '(access_token|refresh_token|id_token|token|code|secret|password|senha|api_?key)=[^&[:space:]''"]+';

-- ---------------------------------------------------------------------------
-- filtro por ambiente na central de erros
-- ---------------------------------------------------------------------------

/*
  Dev e produção estavam no mesmo balde.

  Rodar `npm run dev` apontando pro Supabase real grava erro de
  desenvolvimento na mesma tabela que o erro de quem usa o app. Sem separar
  os dois, a central vira uma lista de coisas que só acontecem na máquina de
  quem programa, e o erro de verdade se perde no meio.
*/
create or replace function public.admin_list_errors(
  p_status public.error_status default null,
  p_severity public.error_severity default null,
  p_module text default null,
  p_page integer default 1,
  p_page_size integer default 25,
  p_environment text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  page integer := greatest(coalesce(p_page, 1), 1);
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  return jsonb_build_object(
    'total', (select count(*) from public.app_errors e
               where (p_status is null or e.status = p_status) and (p_severity is null or e.severity = p_severity)
                 and (p_module is null or e.module = p_module)
                 and (p_environment is null or e.environment = p_environment)),
    'items', coalesce((
      select jsonb_agg(to_jsonb(e) - 'fingerprint' order by e.last_seen_at desc)
      from (select * from public.app_errors e
             where (p_status is null or e.status = p_status) and (p_severity is null or e.severity = p_severity)
               and (p_module is null or e.module = p_module)
               and (p_environment is null or e.environment = p_environment)
             order by e.last_seen_at desc limit size offset (page - 1) * size) e
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_list_errors(public.error_status, public.error_severity, text, integer, integer, text) from public, anon;
grant execute on function public.admin_list_errors(public.error_status, public.error_severity, text, integer, integer, text) to authenticated;
