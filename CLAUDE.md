# Aura — contexto do projeto

Contexto que vale pra qualquer trabalho neste repositório. O código do app está
em [`aura/`](aura/) — detalhes técnicos e como rodar em [`aura/README.md`](aura/README.md).

## Quem

**Layra Lima** — solopreneur / criadora solo, marca pessoal. Desenvolve sites,
aplicativos, sistemas e projetos digitais com foco em vendas e conversão. O
**Aura** é o SaaS próprio dela.

## Produto — Aura

SaaS de **transformação pessoal** (público feminino).

> A jornada entre a mulher que você é hoje e a mulher que decidiu se tornar.

Reúne **metas**, **leituras** e a **jornada** (painel único) num só lugar.

**Modelo de negócio:** checkout direto (paga pra entrar), acesso liberado por
e-mail após a compra. Duas áreas internas: **usuária** (o app) e **admin** (Layra).

**Planos:**

| Plano | Valor | Equivalente mensal |
|---|---|---|
| Fundadora (10 primeiras) | R$ 14,90/mês (travado pra sempre) | R$ 14,90 |
| Mensal | R$ 29,90/mês | R$ 29,90 |
| Trimestral | R$ 69,90/3 meses | R$ 23,30 |
| Anual | R$ 179,90/ano | R$ 14,99 |

Escassez **real** das 10 vagas de fundadora — nunca usar contador falso.

## Tom de voz (qualquer texto em nome do Aura / da Layra)

Informal, direto e energético, com pegada **motivacional e inspiradora**.
Primeira pessoa inclusiva ("nós"), próximo, que puxa pra ação. Sem travas
fortes de estilo — flexível. Exemplos reais da escrita da Layra:

- "Simbora!"
- "A realização de nossos sonhos depende exclusivamente de nós."

## Stack e padrões

- **Frontend:** React + TypeScript (strict) + Vite + Tailwind CSS v4 + Framer Motion.
- **Backend/dados:** Supabase (Postgres + Auth + RLS).
- **Arquitetura:** Clean Architecture — domínio / aplicação / infraestrutura /
  apresentação, com a regra de dependência sempre pra dentro.
- Comunicação em **português (BR)**; código, commits e termos técnicos em **inglês**.
- UI premium e minimalista, mobile-first, acessível (AA). Segurança desde o início
  (RLS por usuária, validação de input, segredos só em env).

## Estado atual

Pronto: landing de conversão (dark, humanizada, planos), autenticação real
(Supabase Auth) com modo demo de fallback, perfis com papel + status de
assinatura e RLS, gating (`/app` exige assinatura ativa, `/admin` exige papel
admin), área de admin (métricas, contas, liberar/bloquear), módulos de Metas e
Leituras com persistência por usuária.

Roda em **modo demo** sem configurar nada; vira contas reais ao configurar o
Supabase (ver `aura/README.md` e `aura/supabase/migrations/`).

## Próximos passos

- Escolher a plataforma de checkout (Kiwify/Hotmart/Stripe) + webhook que ativa
  a conta e dispara o e-mail de acesso (a config já existe em
  `aura/src/presentation/components/landing/checkout.ts`).
- Gerenciar conteúdo no admin (frases do dia, sugestões de livros).
- Identidade visual definitiva (logo, cores, fonte) — hoje os tokens são
  provisórios em `aura/src/index.css`.
