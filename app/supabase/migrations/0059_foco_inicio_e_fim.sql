-- Momentumm — a sessão de foco passa a guardar quando começou.
--
-- Até aqui, terminar o cronômetro gravava só o instante do FIM (`occurred_at`)
-- e a duração. A aba Foco conseguia dizer "25 min às 14:27" e não conseguia
-- dizer "das 14:00 às 14:27" — a pergunta que a pessoa faz quando olha a
-- semana e quer saber a que horas ela realmente senta pra trabalhar.
--
-- Derivar o início de `occurred_at - duration_min` seria mentira: pausar o
-- cronômetro tira tempo da duração sem tirar do relógio. Uma sessão com 20
-- minutos de pausa apareceria começando 20 minutos depois do que começou.
--
-- A coluna é ANULÁVEL de propósito:
--
--   registro manual       não tem início — a pessoa informa o que fez, não a
--                         hora em que sentou.
--   sessões antigas       ficam em null. O histórico anterior a esta migration
--                         não tem esse dado e inventar um seria pior que a
--                         ausência; a tela cai no formato antigo quando é null.

alter table public.activities
  add column if not exists started_at timestamptz;

comment on column public.activities.started_at is
  'Início da sessão de foco. Null em registro manual e em sessão anterior à 0059.';

-- Início depois do fim é dado corrompido, não preferência de tela.
alter table public.activities drop constraint if exists activities_started_before_occurred;
alter table public.activities
  add constraint activities_started_before_occurred
  check (started_at is null or started_at <= occurred_at);
