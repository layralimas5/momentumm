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

## admin-actions

A porta das ações administrativas sobre contas (painel `/admin`): suspender,
reativar, revogar sessões, reenviar confirmação de e-mail, iniciar e concluir
exclusão. Só owner e admin, com `aal2`, sessão administrativa dentro da hora
e verificação do TOTP nos últimos 5 minutos (o carimbo `amr` do JWT).

Suspender, reativar, revogar sessões e iniciar exclusão são delegados às
funções do banco com o JWT da pessoa (`assert_admin_step_up` roda de novo lá
dentro); a função só acrescenta IP e agente ao contexto da auditoria. Reenviar
confirmação e concluir exclusão falam com o GoTrue e o Storage com service
role, porque o SQL não alcança.

```bash
# migrations 0022 a 0028 (supabase db push)
supabase functions deploy admin-actions
# a momentumm-ai também mudou (tetos vindos de product_settings): redeploy
npm run ai:deploy
```

Primeiro owner: conceder direto no banco, uma vez, com a conta já com MFA:

```sql
insert into public.user_roles (user_id, role, reason)
values ('<uuid da conta>', 'owner', 'fundadora');
```

Depois disso todo papel é concedido pelo painel (Configurações), com auditoria.

Suíte de autorização do painel: `supabase/tests/admin-authorization.sql`
(109 casos, em transação com rollback).

## asaas-billing e asaas-webhook

A cobrança do PRO, pelo Asaas. Duas funções e um domínio compartilhado:

- `asaas-billing` — com o JWT da pessoa. `checkout` abre uma sessão de
  Checkout do Asaas (cartão ou Pix, CPF e endereço coletados lá) e devolve
  o link; `cancel` cancela a assinatura no Asaas e marca aqui. Nunca grava
  `subscriptions`.
- `asaas-webhook` — sem JWT (`verify_jwt = false` em `config.toml`);
  autenticada pelo header `asaas-access-token`. É a ÚNICA escrita em
  `subscriptions`: pagamento confirmado ativa, vencido derruba pra
  inadimplente, reembolso e assinatura apagada cancelam. `profiles.plan`
  segue por trigger (0026). Cada evento fica em `billing_webhook_events`
  pela chave do Asaas, o que resolve a entrega "pelo menos uma vez".
- `_shared/billing.ts` — o domínio empacotado (`npm run billing:bundle`,
  a partir de `src/domain/billing/edge-shared.ts`): preço, ciclo, a decisão
  de cada evento (`decideBillingEvent`, `transitionFor`) com teste em
  `asaas-events.test.ts`. `_shared/asaas.ts` é o cliente HTTP;
  `_shared/product-image.ts` é o ícone em base64 que o checkout exige
  (`npm run billing:image`).

```bash
# migration 0030 (supabase db push)

# segredos
supabase secrets set ASAAS_API_KEY=...            # a chave decide sandbox ou produção
supabase secrets set ASAAS_ENV=sandbox            # ou production
supabase secrets set ASAAS_WEBHOOK_TOKEN=...      # 32+ caracteres, o mesmo do painel do Asaas
supabase secrets set MOMENTUMM_APP_URL=https://www.momentumm.com.br   # pra onde o checkout devolve

# deploy (empacota o domínio e sobe as duas; o webhook sem verificação de JWT)
npm run billing:deploy
```

No painel do Asaas (Integrações > Webhooks), cadastrar:

- URL: `https://<project-ref>.supabase.co/functions/v1/asaas-webhook`
- Token de autenticação: o mesmo `ASAAS_WEBHOOK_TOKEN`
- Eventos: os de **cobrança** (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`,
  `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`,
  `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS`),
  os de **assinatura** (`SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED`)
  e os de **checkout** (`CHECKOUT_PAID`). Marcar mais não quebra: o resto é
  registrado como ignorado.
- Fila: sequencial, e com a opção de pausar em falha DESLIGADA se possível
  (a função sempre responde 200 depois de registrar).

Testar no sandbox: `ASAAS_ENV=sandbox` com a chave do
`sandbox.asaas.com`, assinar pela tela `/app/assinatura`, pagar com o
cartão de teste do Asaas e conferir `billing_webhook_events.outcome` e
`subscriptions`. Sem `ASAAS_API_KEY` a função responde `not_configured`
e a tela diz que a assinatura não está disponível nesse ambiente.

## push-reminders

O lembrete no celular pra quem não abriu o app no dia. Web Push, sem
Firebase e sem app nativo: o navegador (ou o app instalado na tela de
início) recebe o aviso na tela de bloqueio.

Como funciona: o app marca presença ao abrir (`touch_my_presence`, com o
fuso do aparelho) e grava o aparelho quando a pessoa liga o lembrete
(`push_subscriptions`). O `pg_cron` chama esta função a cada hora; ela lê
`push_reminders_due(19)`, que devolve só quem está às 19h do próprio fuso,
não abriu o app hoje e ainda não foi lembrado, e manda um aviso pra cada
aparelho. Endpoint morto (404/410) é apagado; outro erro marca `failed_at`.

```bash
# 1. migration 0036 (supabase db push)

# 2. chaves VAPID, uma vez. A pública vai também pro app (VITE_VAPID_PUBLIC_KEY
#    no Netlify); a privada só aqui. Trocar uma sem a outra invalida toda
#    assinatura existente.
npx web-push generate-vapid-keys

# 3. segredos da função
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:contato@momentumm.com.br
supabase secrets set PUSH_REMINDER_TOKEN=<32+ caracteres aleatórios>

# 4. deploy sem verificação de JWT: quem chama é o pg_cron, não uma pessoa
supabase functions deploy push-reminders --no-verify-jwt

# 5. o mesmo token no Vault, pra o agendador conseguir chamar (SQL editor)
#    select vault.create_secret('<PUSH_REMINDER_TOKEN>', 'push_reminder_token');

# 6. publicar o app com VITE_VAPID_PUBLIC_KEY preenchida
```

Testar à mão, sem esperar as 19h (a hora é a do fuso da pessoa; pra
disparar agora, passar a hora local atual):

```bash
curl -X POST "https://hsgjlxetdopomeibdbho.supabase.co/functions/v1/push-reminders?hour=$(date +%H)" \
  -H "x-reminder-token: <PUSH_REMINDER_TOKEN>"
# → {"hour":14,"due":1,"sent":1,"dropped":0,"failed":0}
```

Só recebe quem não abriu o app hoje: pra testar, abrir o app ontem (ou
`update public.user_presence set last_active_at = now() - interval '1 day'`).

iPhone: o Safari só entrega push com o site adicionado à tela de início
(iOS 16.4+). O manifest (`public/manifest.webmanifest`, `start_url=/app`)
é o que torna isso possível; a tela de Configurações explica o passo.

Testes do banco: `supabase/tests/pglite/push.mjs` (`npm run db:test`).
