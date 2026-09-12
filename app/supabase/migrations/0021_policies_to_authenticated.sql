-- Momentumm — nenhuma política vale pro papel anônimo.
--
-- A suíte de autorização, rodada contra o banco de verdade, encontrou dois
-- restos das primeiras migrations:
--
--   1. "follows são legíveis por todos": a tabela `follows` (0001) continuava
--      com uma política de SELECT sem condição. Quem segue quem era legível
--      sem login. A 0015 já tinha dado a ela as políticas de dono; esta
--      linha era o furo que sobrou.
--   2. Todas as políticas escritas antes da 0015 valem pro papel `public`,
--      que inclui `anon`. Pra anônimo `auth.uid()` é nulo e a condição já
--      barra — mas a política que chama `are_friends()` não chega a barrar:
--      explode com "permission denied for function", porque o anônimo não
--      tem execute nela. Não vaza nada, mas é erro onde deveria ser "zero
--      linhas", e é o tipo de política que alguém afrouxa sem perceber que
--      está afrouxando pro anônimo junto.
--
-- Daqui em diante toda política é `to authenticated`. O anônimo não tem
-- nenhuma, e a ausência é a proteção. Re-executável.

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and 'public' = any (roles)
  loop
    execute format('alter policy %I on %I.%I to authenticated', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

-- O furo de verdade: a leitura aberta de `follows`. As políticas de dono da
-- 0015 continuam valendo; esta é a que não deveria existir.
drop policy if exists "follows são legíveis por todos" on public.follows;

-- Os eixos de fábrica não precisam de leitura anônima: a landing não lê o
-- banco, e o app só existe com sessão. Fica como as outras.
