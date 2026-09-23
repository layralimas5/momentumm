-- Momentumm — quem opera o produto nunca cai pro gratuito.
--
-- A 0034 já dava cortesia infinita (`plan_courtesy_until = 'infinity'`) pra
-- owner e admin, mas fazia isso UMA VEZ, num backfill: quem recebeu o papel
-- DEPOIS daquela migration ficou de fora e passou a ver "isso faz parte do
-- PRO" dentro do próprio produto.
--
-- Backfill resolve o passado e não promete nada sobre o futuro. A regra que
-- faltava é a que vale daqui pra frente: ganhou o papel, ganhou a cortesia,
-- no mesmo instante e sem ninguém precisar lembrar.
--
-- ## O que NÃO acontece aqui
--
-- Perder o papel não tira a cortesia. Revogar sozinho derrubaria alguém pro
-- gratuito no meio do uso por causa de uma mudança administrativa, e isso é
-- decisão de gente, não de trigger. Tirar é um `update` à mão, com a pessoa
-- sabendo.
--
-- ## Por que não é só `profiles.plan = 'pro'`
--
-- `plan` é CACHE: `plan_for_user()` é quem decide, olhando assinatura,
-- cortesia e teste, e `sync_plan_for_user()` grava o resultado. Escrever
-- 'pro' na coluna direto duraria até a próxima sincronização — que roda em
-- todo webhook de cobrança e em todo acerto de plano.

-- ---------------------------------------------------------------------------
-- a regra, daqui pra frente
-- ---------------------------------------------------------------------------

create or replace function public.grant_courtesy_to_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role not in ('owner', 'admin') then
    return new;
  end if;

  /*
    `momentumm.plan_sync` é a chave que `guard_profile_privileges` (0034)
    exige pra deixar a cortesia ser escrita. Sem ela o trigger de perfil
    recusa a própria concessão — que é exatamente o que deve acontecer com
    qualquer outra escrita nesse campo.
  */
  perform set_config('momentumm.plan_sync', '1', true);

  update public.profiles
     set plan_courtesy_until = 'infinity'
   where id = new.user_id
     and (plan_courtesy_until is null or plan_courtesy_until <= now());

  perform set_config('momentumm.plan_sync', '', true);

  -- O cache do plano acompanha na hora: sem isso a pessoa continua vendo o
  -- aviso de PRO até a próxima sincronização, que pode demorar dias.
  perform public.sync_plan_for_user(new.user_id);

  return new;
end;
$$;

revoke all on function public.grant_courtesy_to_staff() from public;
revoke all on function public.grant_courtesy_to_staff() from anon;
revoke all on function public.grant_courtesy_to_staff() from authenticated;

drop trigger if exists user_roles_courtesy on public.user_roles;
create trigger user_roles_courtesy
  after insert or update of role on public.user_roles
  for each row execute function public.grant_courtesy_to_staff();

-- ---------------------------------------------------------------------------
-- e o passado, de novo
-- ---------------------------------------------------------------------------

/*
  O mesmo backfill da 0034, agora idempotente e rodando outra vez.

  Ele pega quem virou owner ou admin no intervalo entre as duas migrations —
  o caso que criou este arquivo. Rodar duas vezes não muda nada: a condição
  é "não tem cortesia válida".
*/
do $$
begin
  perform set_config('momentumm.plan_sync', '1', true);

  update public.profiles p
     set plan_courtesy_until = 'infinity'
   where (p.plan_courtesy_until is null or p.plan_courtesy_until <= now())
     and exists (
       select 1 from public.user_roles r
        where r.user_id = p.id and r.role in ('owner', 'admin')
     );

  perform set_config('momentumm.plan_sync', '', true);

  -- Sincroniza só quem tem papel: varrer a base inteira aqui seria trabalho
  -- por nada, já que ninguém mais mudou de situação.
  perform public.sync_plan_for_user(r.user_id)
     from (select distinct user_id from public.user_roles where role in ('owner', 'admin')) r;
end $$;
