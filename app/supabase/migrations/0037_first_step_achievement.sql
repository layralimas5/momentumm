-- Momentumm — a conquista "Primeiro Passo".
--
-- A primeira ação concluída. É o fecho do primeiro resultado do teste
-- grátis: meta → plano → passo de hoje → feito → XP → "você começou de
-- verdade". Sem esse fecho o trial vira cadastro parado.
--
-- Vale 10 XP. A regra é a mesma do domínio (`ACHIEVEMENTS` em
-- `domain/entities/evolution.ts`) e do engine do demo: existe qualquer
-- transação `task_done` ou `priority_done`. O trigger `tasks_evolution`
-- já chama `evolution_settle` depois de cada ação feita, então a conquista
-- entra sozinha na primeira. Quem já tem ação feita ganha na próxima
-- concluída, sem retroagir XP.

insert into public.achievement_rules (key, points, required_level)
values ('primeiro_passo', 10, null)
on conflict (key) do nothing;

create or replace function public.evolution_qualifies(p_user uuid, p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rule  public.achievement_rules%rowtype;
  v_level integer;
begin
  select * into v_rule from public.achievement_rules where key = p_key;
  if not found then
    return false;
  end if;

  if v_rule.required_level is not null then
    select level into v_level from public.user_evolution where user_id = p_user;
    return coalesce(v_level, 1) >= v_rule.required_level;
  end if;

  return case p_key
    when 'primeiro_passo'   then exists (select 1 from public.xp_transactions where user_id = p_user and kind in ('task_done', 'priority_done'))
    when 'primeira_semana'  then exists (select 1 from public.xp_transactions where user_id = p_user and kind = 'review_done')
    when 'primeiro_marco'   then exists (select 1 from public.xp_transactions where user_id = p_user and kind = 'stage_done')
    when 'primeira_vitoria' then exists (select 1 from public.xp_transactions where user_id = p_user and kind = 'objective_done')
    when 'de_volta_ao_jogo' then exists (select 1 from public.xp_transactions where user_id = p_user and kind = 'comeback')
    when 'momentum'         then exists (select 1 from public.xp_transactions where user_id = p_user and kind = 'week_consistent')
    when 'pegou_ritmo'      then (
      select count(distinct day) from public.xp_transactions
       where user_id = p_user and kind = 'priority_done'
    ) >= 7
    else false
  end;
end;
$$;
