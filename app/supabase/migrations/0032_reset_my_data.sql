-- ===========================================================================
-- 0032 — Recomeçar do zero sem perder a conta
-- ===========================================================================
--
-- "Excluir a conta" apaga `auth.users`, e com ele o login, o plano, o papel
-- de admin e a assinatura. Quem só queria limpar o progresso pra começar de
-- novo ficava sem conta. Esta função apaga SÓ o conteúdo: objetivos, plano,
-- hábitos, ações, registros, momentos, desafios próprios, XP e conquistas.
-- Perfil, e-mail, senha, plano, papéis, amizades e aceites ficam.
--
-- Roda como `security definer` porque atravessa tabelas em que o dono só
-- tem política de leitura (`xp_transactions`, `user_evolution`). O `auth.uid()`
-- é a única identidade aceita: não existe parâmetro de usuário.
-- ===========================================================================

create or replace function public.reset_my_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := auth.uid();
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  perform public.record_audit('conta.recomecar', 'account', quem::text, 'ok', '{}'::jsonb);

  -- Sociais primeiro: o que a pessoa criou some; o que ela recebeu de amigos
  -- (participação em desafio de outra pessoa, apoio de outra pessoa) some
  -- junto porque aponta pra um momento ou desafio que deixa de existir.
  delete from public.challenge_participants where user_id = quem;
  delete from public.challenges where owner_id = quem;
  delete from public.journey_event_supports where user_id = quem;
  delete from public.journey_events where user_id = quem;

  -- O ciclo do produto. As etapas caem com o objetivo e os logs com o hábito.
  delete from public.tasks where user_id = quem;
  delete from public.objectives where user_id = quem;
  delete from public.goals where user_id = quem;
  delete from public.habits where user_id = quem;
  delete from public.activities where user_id = quem;
  delete from public.check_ins where user_id = quem;
  delete from public.wins where user_id = quem;
  delete from public.weekly_reviews where user_id = quem;

  -- Os eixos que ela criou. Os de fábrica não têm dono e ficam.
  delete from public.activity_types where user_id = quem;

  -- A evolução volta ao nível 1: recomeçar é recomeçar.
  delete from public.xp_transactions where user_id = quem;
  delete from public.user_achievements where user_id = quem;
  delete from public.user_evolution where user_id = quem;

  -- Os arquivos. Mesmo contrato da exclusão: o cliente já limpa pela API
  -- antes, e aqui é a garantia caso o storage aceite.
  begin
    delete from storage.objects
     where bucket_id = 'user-media'
       and (storage.foldername(name))[1] = quem::text;
  exception
    when others then
      raise warning 'reset_my_data: storage recusou apagar a pasta de % (%).', quem, sqlerrm;
  end;
end;
$$;

revoke all on function public.reset_my_data() from public;
revoke all on function public.reset_my_data() from anon;
grant execute on function public.reset_my_data() to authenticated;
