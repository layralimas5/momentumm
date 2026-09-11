-- Momentumm — dias de descanso planejado.
--
-- O Momentum Score mede ritmo em 28 dias. Sem esta coluna, o domingo de quem
-- decidiu não trabalhar no domingo entra na conta como um dia vazio — e o
-- número passa a cobrar uma escolha que o produto diz respeitar.
--
-- A coluna guarda os dias da semana (0 = domingo … 6 = sábado). O domínio
-- limita a DOIS por semana (`MAX_REST_WEEKDAYS`): acima disso "descanso" vira
-- a maneira de tirar da conta os dias em que não se quer ser medido. O banco
-- repete o limite porque a regra que só vive no front é a regra que a API
-- pública não conhece.

alter table public.profiles
  add column if not exists rest_weekdays smallint[] not null default '{}';

alter table public.profiles
  drop constraint if exists profiles_rest_weekdays_valid;

alter table public.profiles
  add constraint profiles_rest_weekdays_valid check (
    cardinality(rest_weekdays) <= 2
    and rest_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  );
