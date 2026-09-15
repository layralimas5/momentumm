-- ===========================================================================
-- 0033 — Momentumm AI: o toque do coach
-- ===========================================================================
--
-- Novo tipo de chamada, `coach`: três linhas duras no fim das métricas, só
-- pro PRO. Entra na mesma franquia mensal dos outros tipos e é registrado em
-- `ai_calls` como qualquer chamada, então a constraint precisa conhecê-lo.
-- ===========================================================================

alter table public.ai_calls
  drop constraint if exists ai_calls_kind_check;

alter table public.ai_calls
  add constraint ai_calls_kind_check
  check (kind in ('plan', 'day', 'progress', 'review', 'review_draft', 'recovery', 'coach'));
