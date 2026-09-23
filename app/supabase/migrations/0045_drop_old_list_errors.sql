-- Momentumm — tira a versão velha de `admin_list_errors`.
--
-- A 0044 acrescentou `p_environment`. Como isso muda a ASSINATURA, o
-- `create or replace` não substituiu nada: criou uma segunda função e
-- deixou a de cinco parâmetros no lugar. Com duas candidatas, o PostgREST
-- se recusa a escolher e devolve erro, que na tela vira "Não consegui
-- salvar agora" — a aba inteira parava por causa disso.
--
-- A lição que vale pras próximas: acrescentar parâmetro a uma função que o
-- PostgREST chama exige derrubar a assinatura antiga na mesma migration.

drop function if exists public.admin_list_errors(
  public.error_status, public.error_severity, text, integer, integer
);
