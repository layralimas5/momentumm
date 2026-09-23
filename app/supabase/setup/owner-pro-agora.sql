-- Me dá o PRO agora — sem esperar o `db push`.
--
-- Cole no SQL Editor do Supabase (projeto Momentumm). Rode UM BLOCO POR VEZ,
-- de cima pra baixo, e leia o resultado de cada um antes de seguir.
--
-- ## Por que a primeira versão deste arquivo não resolveu nada
--
-- Ela filtrava `where existe papel de owner/admin`. Se a conta NÃO tem papel
-- na tabela `user_roles` — que é o caso mais comum, porque owner é concedido
-- à mão —, a consulta voltava vazia e o update não pegava nenhuma linha.
-- Rodar não dava erro e não fazia nada: o pior tipo de script.
--
-- Agora o diagnóstico lista as contas SEMPRE, com ou sem papel, e diz o que
-- falta em cada uma.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — Diagnóstico. Rode e leia a coluna `o_que_falta`.
-- ---------------------------------------------------------------------------

select
  u.email,
  p.plan                                   as plano_em_cache,
  public.plan_for_user(p.id)               as plano_de_verdade,
  p.plan_courtesy_until::text              as cortesia_ate,
  coalesce(r.papeis, '{}')                 as papeis,
  t.status                                 as teste,
  t.ends_at::text                          as teste_acaba_em,
  -- Conta vazia manda pro onboarding ("Vamos montar seu plano"), e isso NÃO
  -- tem nada a ver com PRO. São dois avisos diferentes com nomes parecidos.
  (select count(*) from public.objectives o where o.user_id = p.id) as objetivos,
  (select count(*) from public.tasks x where x.user_id = p.id)      as acoes,
  case
    when r.papeis is null
      then 'NAO TEM PAPEL de owner/admin — rode o BLOCO 2'
    when p.plan_courtesy_until is null or p.plan_courtesy_until <= now()
      then 'tem papel, falta a cortesia — rode o BLOCO 3'
    when p.plan is distinct from 'pro'
      then 'tem cortesia, o cache ficou pra tras — rode o BLOCO 3'
    else 'PRO ok. Se o app ainda cobra, e sessao antiga: saia e entre de novo'
  end                                      as o_que_falta
from public.profiles p
join auth.users u on u.id = p.id
left join public.plan_trials t on t.user_id = p.id
left join (
  select user_id, array_agg(role::text order by role) papeis
    from public.user_roles group by user_id
) r on r.user_id = p.id
order by (r.papeis is null), u.created_at
limit 50;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — Não tem papel? Conceda owner. TROQUE O E-MAIL.
-- ---------------------------------------------------------------------------
--
-- Só rode se o BLOCO 1 disse "NAO TEM PAPEL". Owner é o papel mais alto do
-- painel: ele abre /admin inteiro, não só o PRO.

insert into public.user_roles (user_id, role)
select u.id, 'owner'
  from auth.users u
 where u.email = 'TROQUE@PELO.SEU.EMAIL'
on conflict (user_id) do update set role = 'owner';

-- ---------------------------------------------------------------------------
-- BLOCO 3 — A cortesia e o acerto do cache.
-- ---------------------------------------------------------------------------
--
-- `momentumm.plan_sync` é a chave que o trigger `guard_profile_privileges`
-- (0034) exige pra deixar esse campo ser escrito. Sem ela o banco recusa, que
-- é o que deve acontecer com qualquer outra tentativa de se dar PRO.
--
-- `plan` é CACHE: quem decide é `plan_for_user()`, e é `sync_plan_for_user()`
-- que grava o resultado. Escrever 'pro' na coluna direto dura até a próxima
-- sincronização, que roda em todo webhook de cobrança.

do $$
declare
  afetadas integer;
begin
  perform set_config('momentumm.plan_sync', '1', true);

  update public.profiles p
     set plan_courtesy_until = 'infinity'
   where (p.plan_courtesy_until is null or p.plan_courtesy_until <= now())
     and exists (
       select 1 from public.user_roles r
        where r.user_id = p.id and r.role in ('owner', 'admin')
     );

  get diagnostics afetadas = row_count;
  perform set_config('momentumm.plan_sync', '', true);

  perform public.sync_plan_for_user(r.user_id)
     from (select distinct user_id from public.user_roles
            where role in ('owner', 'admin')) r;

  -- O aviso aparece na aba Messages do SQL Editor. Zero aqui significa que
  -- ninguém tem papel de owner/admin — volte pro BLOCO 2.
  raise notice 'contas que receberam cortesia agora: %', afetadas;
end $$;

-- ---------------------------------------------------------------------------
-- BLOCO 4 — Conferir. Rode o BLOCO 1 de novo.
-- ---------------------------------------------------------------------------
--
-- Esperado na sua linha: plano_de_verdade = 'pro', cortesia_ate = 'infinity',
-- papeis contendo 'owner'.
--
-- Depois disso: SAIR E ENTRAR de novo no app. O plano vem no perfil, que é
-- carregado no login — a sessão aberta continua com o valor antigo.
--
-- A migration 0051 (na branch `feat/retencao-e-juntos`) deixa isso automático
-- pra sempre: ganhou o papel, ganhou a cortesia, no mesmo instante.
