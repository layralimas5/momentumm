-- Momentumm — "Ajuda com o app" passa a ser do PRO. O resto do canal não.
--
-- O canal de suporte (0025) atende oito categorias e sempre atendeu todo mundo.
-- A regra de produto mudou pra UMA delas: `suporte`, que é ajuda com o app, vira
-- benefício de plano.
--
-- ## O que NÃO muda, e por quê
--
-- As outras sete continuam abertas em qualquer plano:
--
--   exclusao, exportacao, privacidade   obrigação legal. Trancar isso atrás do
--                                       PRO é cobrar assinatura pra alguém
--                                       exercer um direito.
--   seguranca                           quem encontra uma falha precisa
--                                       conseguir contar. Um relato que não
--                                       chega é uma falha que fica.
--   pagamento, acesso                   a porta de quem foi cobrado errado ou
--                                       não consegue entrar. Exigir PRO de
--                                       quem não consegue pagar nem entrar é
--                                       um beco sem saída por desenho.
--   denuncia                            num produto com camada social, só quem
--                                       paga poder denunciar é problema de
--                                       segurança, não de plano.
--
-- Nada de papel administrativo entra nesta conta. Quem decide é
-- `plan_for_user()` — assinatura, cortesia ou teste. Suporte do produto é
-- recurso de PLANO, e painel administrativo é PERMISSÃO: são dois eixos, e
-- misturá-los faria a equipe perder o PRO ao perder o papel, ou ganhar acesso
-- administrativo por assinar.
--
-- ## Por que no servidor
--
-- O seletor da tela esconde a categoria, e esconder não é impedir: `rpc
-- open_support_request` está em `grant execute ... to authenticated`, então
-- qualquer sessão consegue chamar com a categoria que quiser. A recusa mora
-- aqui.

/*
  Igual à 0025, com uma checagem a mais e nada removido.

  A checagem vem DEPOIS da sessão e ANTES do teto diário, de propósito: gastar
  uma das cinco tentativas do dia numa categoria que a conta nem pode abrir
  puniria a pessoa por um limite que ela não tinha como conhecer.

  O código é 22023, que `rpc.ts` deixa subir com o texto original — a mensagem
  abaixo é escrita pra ser lida na tela, e ela precisa dizer o que AINDA dá pra
  fazer, senão vira "não pode" sem saída.
*/
create or replace function public.open_support_request(
  p_category public.support_category,
  p_subject text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.support_requests%rowtype;
  priority public.support_priority;
begin
  if auth.uid() is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  if p_category = 'suporte' and public.plan_for_user(auth.uid()) <> 'pro' then
    raise exception 'Ajuda com o app faz parte do PRO. Conta, cobrança, acesso, privacidade, segurança, denúncia, exportação e exclusão continuam abertas no teu plano.'
      using errcode = '22023';
  end if;

  if (select count(*) from public.support_requests r
       where r.user_id = auth.uid() and r.opened_at > now() - interval '1 day') >= 5 then
    raise exception 'limite de solicitações por dia atingido' using errcode = '22023';
  end if;

  priority := case p_category
    when 'seguranca' then 'urgente'::public.support_priority
    when 'acesso' then 'alta'
    when 'exclusao' then 'alta'
    when 'pagamento' then 'alta'
    else 'normal'
  end;

  insert into public.support_requests (protocol, user_id, category, priority, subject, description, due_at)
  values (
    public.next_support_protocol(), auth.uid(), p_category, priority,
    btrim(p_subject), btrim(p_description), now() + public.support_due_for(priority)
  )
  returning * into created;

  insert into public.support_request_events (request_id, actor_id, actor_kind, type)
  values (created.id, auth.uid(), 'usuario', 'aberta');

  return jsonb_build_object('id', created.id, 'protocol', created.protocol);
end;
$$;

/* Os mesmos grants da 0025: o `create or replace` não os altera, e repetir é barato. */
revoke all on function public.open_support_request(public.support_category, text, text) from public;
revoke all on function public.open_support_request(public.support_category, text, text) from anon;
grant execute on function public.open_support_request(public.support_category, text, text) to authenticated;

comment on function public.open_support_request(public.support_category, text, text) is
  'Abre uma solicitação. "suporte" (ajuda com o app) exige PRO; as outras categorias valem em qualquer plano, porque são direito.';
