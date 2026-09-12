# Edge Functions

## momentumm-ai

O endpoint da Momentumm AI. Prompt, formato de saída e validação vivem em
`src/domain/ai/ai-prompts.ts` e são compartilhados com o app pelo import map
(`deno.json` desta função mapeia `@/` pra `src/`).

```bash
# uma vez, na máquina que faz o deploy
npm i -g supabase
supabase login
supabase link --project-ref hsgjlxetdopomeibdbho

# aplicar as migrations 0016, 0019 e 0020 (SQL editor ou `supabase db push`)

# segredos da função
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set MOMENTUMM_AI_MODEL=claude-opus-5   # opcional

# deploy (gera supabase/functions/momentumm-ai/shared.ts e sobe)
npm run ai:deploy
```

`shared.ts` é o domínio empacotado pelo esbuild a partir de
`src/domain/ai/edge-shared.ts`. O bundler do Supabase não resolve os imports
sem extensão do app (`./ai-context` em vez de `./ai-context.ts`), então a
função não importa `src/` direto: importa o pacote. Ele fica versionado pra o
deploy funcionar de qualquer checkout, e `npm run ai:bundle` o regenera —
rodar sempre que `ai-prompts`, `ai-context` ou `plan` mudarem.

Até o deploy, o app com Supabase configurado mostra "A Momentumm AI ainda não
está disponível nesse ambiente" em vez de fingir uma resposta. O modo demo
continua com a implementação simulada, avisada na tela.

Franquia mensal: `PLAN_LIMITS[tier].aiCallsPerMonth` (0 no gratuito, 150 no
PRO), contada em `ai_calls`, que só a função escreve. Sem franquia a função
responde `plan_required` antes de chamar o modelo.

Ritmo: `ai_calls_last_minute()` (migration 0020) limita a 5 chamadas por
minuto por pessoa (`rate_limited`), por cima da franquia mensal.

Kinds aceitos: `plan`, `day`, `progress`, `review`, `review_draft`,
`recovery` (a 0019 abre a constraint de `ai_calls.kind` pra eles).
