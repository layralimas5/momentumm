-- Momentumm — a landing entra no funil.
--
-- Até aqui o funil começava no quiz: `quiz_viewed` era a primeira linha, e
-- quem chegava na página inicial, lia tudo e ia embora sem clicar não existia
-- em lugar nenhum. Sem esse pedaço não dá pra responder a pergunta que decide
-- o conteúdo: qual carrossel trouxe gente que começou o quiz, e qual trouxe
-- gente que só passou.
--
-- Os seis nomes novos são os da própria página. Eles usam a MESMA sessão do
-- quiz (`quiz_sessions.id`, guardada no navegador), de propósito: é o vínculo
-- que liga a visita ao quiz, ao cadastro e à assinatura numa linha só. Os
-- `utm_*` continuam entrando na criação da sessão, então a origem passa a ser
-- registrada já na visita, e não só quando a pessoa abre o quiz.
--
-- Efeito colateral aceito: `quiz_sessions` passa a ter uma linha por visita
-- da landing, não só por visita do quiz. O painel não quebra (ele conta por
-- nome de evento), e a quebra por `utm_source` passa a cobrir a página
-- inteira, que é o que se queria medir. O teto de 60 eventos por sessão, a
-- limpeza periódica e as políticas de escrita continuam valendo sem mudança.
--
-- Nada de dado pessoal entra aqui: os nomes são fechados nesta lista, e o
-- payload é só origem (utm) e passo.
--
-- A lista abaixo é a mesma de `funnel-events.ts`, e `funnel-events.test.ts`
-- compara as duas lendo este arquivo. O teste procura o ÚLTIMO trecho com
-- `function public.quiz_event_names()` e lê até o `$$;` seguinte, então nada
-- pode citar o nome da função depois do corpo dela (um `comment on function`
-- aqui embaixo, por exemplo, quebra a leitura).

create or replace function public.quiz_event_names()
returns text[]
language sql
immutable
as $$
  select array[
    'landing_viewed', 'hero_cta_clicked', 'secondary_cta_clicked',
    'pricing_viewed', 'pricing_cta_clicked', 'faq_opened',
    'quiz_viewed', 'quiz_started', 'quiz_question_answered', 'quiz_completed',
    'quiz_abandoned', 'lead_captured', 'diagnosis_viewed', 'plan_preview_viewed',
    'signup_started', 'signup_completed', 'plan_activated',
    'first_action_completed', 'trial_started', 'checkout_started',
    'subscription_completed'
  ];
$$;
