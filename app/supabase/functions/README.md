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

# aplicar a migration 0016 (SQL editor ou `supabase db push`)

# segredos da função
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set MOMENTUMM_AI_MODEL=claude-opus-5   # opcional

# deploy
supabase functions deploy momentumm-ai
```

Até o deploy, o app com Supabase configurado mostra "A Momentumm AI ainda não
está disponível nesse ambiente" em vez de fingir uma resposta. O modo demo
continua com a implementação simulada, avisada na tela.

Teto por dia: `PLAN_LIMITS[tier].aiCallsPerDay` (5 no gratuito, 40 no PRO),
contado em `ai_calls`, que só a função escreve.
