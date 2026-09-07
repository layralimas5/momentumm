-- Momentumm — fecha `are_friends` pra quem não está logado.
--
-- ## O que estava errado
--
-- A migration 0009 já dizia a intenção:
--
--   revoke all on function public.are_friends(uuid, uuid) from public;
--   grant execute on function public.are_friends(uuid, uuid) to authenticated;
--
-- Só que o Supabase mantém DEFAULT PRIVILEGES no schema `public` concedendo
-- EXECUTE em toda função nova pros papéis `anon` e `authenticated`. Esse grant
-- é feito ao papel `anon` diretamente, e não ao pseudo-papel PUBLIC — então o
-- `revoke ... from public` não o alcança. A função nasceu aberta.
--
-- Confirmado chamando o endpoint com a chave anônima: ela respondeu `false` em
-- vez de recusar.
--
-- ## Por que isso importa
--
-- `are_friends` é `security definer`: ela responde ignorando a RLS de
-- `friendships`. E a chave anônima é pública por natureza — ela viaja dentro
-- do bundle JavaScript, qualquer pessoa que abrir o app tem a dela.
--
-- Junte com a política de `profiles`, que permite leitura por qualquer um
-- desde a 0001: dá pra listar os ids de todo mundo e depois perguntar, par a
-- par, quem é amigo de quem. O grafo inteiro de amizades do produto, sem
-- login. Nenhuma linha vaza — mas a RELAÇÃO vaza, e ela é justamente o dado
-- que o Círculo existe pra proteger.

revoke execute on function public.are_friends(uuid, uuid) from anon;
revoke execute on function public.are_friends(uuid, uuid) from public;

-- Continua valendo pra quem está logado: é ela que sustenta a política de
-- leitura dos momentos compartilhados com o círculo.
grant execute on function public.are_friends(uuid, uuid) to authenticated;
