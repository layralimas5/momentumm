-- Momentumm AI: as portas contextuais.
--
-- A IA deixou de ter três funções e passou a ter uma por porta de entrada:
-- plano (Objetivos), dia (Hoje), progresso (Progresso), review e o rascunho
-- da review (Review semanal) e retomada (Modo Retomada). O registro de
-- chamadas precisa aceitar os tipos novos; o teto mensal conta todos juntos.
--
-- Aditiva: só a constraint muda. Nenhuma linha existente é tocada.

alter table public.ai_calls
  drop constraint if exists ai_calls_kind_check;

alter table public.ai_calls
  add constraint ai_calls_kind_check
  check (kind in ('plan', 'day', 'progress', 'review', 'review_draft', 'recovery'));

-- A franquia é mensal: a consulta da função filtra por `created_at` desde o
-- dia 1, e o índice por (user_id, created_at) da 0016 já cobre esse recorte.
