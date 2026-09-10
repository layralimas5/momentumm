-- Momentumm — uma política por comando, e um molde pra próxima tabela.
--
-- ## O que muda de fato
--
-- Em termos de permissão, quase nada: as políticas `for all` existentes já
-- traziam `using` E `with check` com o mesmo predicado, o que já bloqueava
-- insert de linha alheia e troca de dono. Elas não eram um furo.
--
-- O que muda é a superfície de revisão. `for all` é um comando só que cobre
-- quatro, e o dia em que alguém precisar afrouxar a LEITURA (compartilhar um
-- objetivo, por exemplo) vai editar a mesma linha que governa o DELETE. Com
-- quatro políticas, afrouxar a leitura é escrever uma política de leitura, e
-- a de delete continua onde estava, intacta e óbvia.
--
-- E `for all` tem uma armadilha silenciosa: se alguém recriar a política sem
-- o `with check`, o Postgres passa a usar o `using` como checagem em UPDATE
-- mas o INSERT fica sem cláusula. A separação torna a omissão visível.
--
-- ## O molde
--
-- `apply_owner_policies` é o que garante que a tabela de amanhã — as de IA,
-- por exemplo, quando o Momentumm AI passar a guardar conversa — nasça com
-- exatamente estas quatro regras, em vez de com o que a pessoa lembrar de
-- escrever naquele dia.

create or replace function public.apply_owner_policies(
  p_table text,
  p_owner_column text default 'user_id'
)
returns void
language plpgsql
as $$
declare
  ident text := format('public.%I', p_table);
  owner text := quote_ident(p_owner_column);
begin
  execute format('alter table %s enable row level security', ident);

  execute format('drop policy if exists %I on %s', p_table || '_owner_select', ident);
  execute format('drop policy if exists %I on %s', p_table || '_owner_insert', ident);
  execute format('drop policy if exists %I on %s', p_table || '_owner_update', ident);
  execute format('drop policy if exists %I on %s', p_table || '_owner_delete', ident);

  -- `to authenticated` em todas: sem isso a política vale também pro papel
  -- `anon`, e ainda que `auth.uid()` seja nulo ali (o que já barra), deixar
  -- explícito é o que faz a intenção sobreviver a uma leitura rápida.
  execute format(
    'create policy %I on %s for select to authenticated using (auth.uid() = %s)',
    p_table || '_owner_select', ident, owner
  );

  execute format(
    'create policy %I on %s for insert to authenticated with check (auth.uid() = %s)',
    p_table || '_owner_insert', ident, owner
  );

  -- Os dois lados no update: `using` decide quais linhas podem ser tocadas,
  -- `with check` decide como elas podem ficar. É o segundo que impede
  -- transferir a linha pra outro dono.
  execute format(
    'create policy %I on %s for update to authenticated using (auth.uid() = %s) with check (auth.uid() = %s)',
    p_table || '_owner_update', ident, owner, owner
  );

  execute format(
    'create policy %I on %s for delete to authenticated using (auth.uid() = %s)',
    p_table || '_owner_delete', ident, owner
  );
end;
$$;

-- Molde é ferramenta de migration, não de runtime: ninguém autenticado
-- precisa poder reescrever política nenhuma.
revoke all on function public.apply_owner_policies(text, text) from public;
revoke all on function public.apply_owner_policies(text, text) from anon;
revoke all on function public.apply_owner_policies(text, text) from authenticated;

-- ---------------------------------------------------------------------------
-- aplicando nas tabelas que hoje usam `for all`
-- ---------------------------------------------------------------------------

do $$
declare
  alvo record;
begin
  for alvo in
    select * from (values
      ('goals',          'user_id'),
      ('check_ins',      'user_id'),
      ('habits',         'user_id'),
      ('habit_logs',     'user_id'),
      ('tasks',          'user_id'),
      ('wins',           'user_id'),
      ('objectives',     'user_id'),
      ('weekly_reviews', 'user_id'),
      ('plan_stages',    'user_id'),
      ('journey_events', 'user_id'),
      -- `follows` guarda a relação, e o dono da linha é quem segue.
      ('follows',        'follower_id')
    ) as t(nome, coluna)
  loop
    perform public.apply_owner_policies(alvo.nome, alvo.coluna);
  end loop;
end;
$$;

-- As antigas saem depois das novas entrarem: derrubar primeiro deixaria uma
-- janela, dentro da transação, em que a tabela fica sem política nenhuma.
drop policy if exists "usuário gerencia as próprias metas" on public.goals;
drop policy if exists "usuário gerencia os próprios check-ins" on public.check_ins;
drop policy if exists "usuário gerencia os próprios hábitos" on public.habits;
drop policy if exists "usuário gerencia os próprios registros de hábito" on public.habit_logs;
drop policy if exists "usuário gerencia as próprias ações" on public.tasks;
drop policy if exists "usuário gerencia as próprias vitórias" on public.wins;
drop policy if exists "usuário gerencia os próprios objetivos" on public.objectives;
drop policy if exists "usuário gerencia os próprios reviews" on public.weekly_reviews;
drop policy if exists "usuário gerencia as próprias etapas" on public.plan_stages;
drop policy if exists "usuário gerencia os próprios momentos" on public.journey_events;
drop policy if exists "usuário gerencia quem ele segue" on public.follows;

/*
  `journey_events` fica com DUAS políticas de select, e isso é intencional.

  A do molde ("o dono lê") e a do Círculo ("amigo lê o que foi compartilhado")
  são OR entre si, que é como o Postgres combina políticas permissivas. O
  resultado é o mesmo de antes; a diferença é que agora a regra social está
  escrita separada da regra de propriedade, e mexer numa não toca na outra.
*/

-- ---------------------------------------------------------------------------
-- excluir a conta
-- ---------------------------------------------------------------------------

/*
  Apagar a própria conta, com tudo que depende dela.

  Sai daqui e não do cliente porque `auth.users` não é acessível pela API
  pública — e não deve ser. A função roda como definer, apaga a si mesma
  (`auth.uid()`, nunca um id recebido) e deixa o cascade fazer o resto:
  `profiles` cai por referência, todas as tabelas do produto caem por
  referência a `profiles`, e o trigger de mídia apaga os arquivos antes.

  O registro de auditoria é gravado ANTES, porque depois não há mais autor —
  e ele guarda só o fato, sem nada da pessoa.
*/
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  quem uuid := auth.uid();
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  perform public.record_audit('conta.excluir', 'account', quem::text, 'ok', '{}'::jsonb);

  delete from auth.users where id = quem;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
