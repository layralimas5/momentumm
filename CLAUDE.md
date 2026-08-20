# Momentumm — contexto do projeto

Repositório zerado em 13/08/2026 para a reestruturação completa. O código do Aura
foi removido; o histórico continua no git (tag `aura-final` e branch
`feat/journey-modules`, ambas no GitHub).

## Quem

**Layra Lima** (Lay) — solopreneur, criadora solo. O **Momentumm** é o SaaS próprio dela.

## Produto — Momentumm

Rede social de evolução pessoal. O modelo é o Strava: em vez de corrida e pedal, a
pessoa registra e compartilha o que faz pra crescer.

**Multi eixo desde o começo:** leitura, estudo, treino, meditação, escrita, hábitos,
metas. Leitura é um eixo, não o produto inteiro.

Conceito completo, modelo de dados, fases e plano de aquisição em
`../saas-ideias/momentumm.md`. Ler antes de qualquer decisão de escopo.

## A decisão de arquitetura que manda em tudo

O Aura era feito de **módulos separados** (metas de um lado, leituras do outro).
O Momentumm tem **uma unidade só: a atividade**.

`activities`: user_id, type_id, valor, unidade, duração, nota, ocorreu_em, visibilidade, origem

Todo eixo novo é uma linha em `activity_types`, não um módulo novo. Feed, streak,
ranking, desafio e recap funcionam pra qualquer eixo sem código novo. Se algum
recurso exigir tabela por eixo, é sinal de que o desenho saiu do trilho.

## Regra de ouro

**O produto precisa entregar valor com uma pessoa só usando.** Registro, streak,
metas, estatísticas e estante têm que ser bons sozinhos. Camada social entra depois
que existir base. Feed vazio afasta usuário.

## Stack e padrões

- **Frontend:** React + TypeScript (strict) + Vite + Tailwind CSS v4 + Framer Motion
- **Backend/dados:** Supabase (Postgres + Auth + RLS)
- **Arquitetura:** Clean Architecture (domínio / aplicação / infraestrutura /
  apresentação), regra de dependência sempre pra dentro
- **RLS desde o primeiro commit.** Visibilidade de atividade é regra de RLS, não
  filtro no front
- Comunicação em português (BR); código, commits e termos técnicos em inglês
- UI premium e minimalista, mobile-first, acessível (AA)
- Branch por feature, Conventional Commits, nunca commitar `.env`

## Decisões tomadas em 13/08/2026

1. **Público geral.** O recorte feminino do Aura foi aberto: rede social precisa dos dois lados.
2. **Eixos da fase 1:** leitura, estudo, treino, meditação.
3. **Identidade nova.** Dark first: preto profundo, off-white, violeta de marca
   (`--color-brand`) e laranja reservado **exclusivamente** pra streak. Cada eixo tem
   cor fixa. Tokens em `app/src/index.css`.
4. **Repositório remoto** segue `layralimas5/aura` até a Lay renomear no GitHub.

## Estado atual

Fase 1 em pé, em `app/`. Roda em **modo demo** sem configurar nada (dados em
`localStorage`) e vira contas reais ao preencher `.env.local` com o Supabase.

Pronto: domínio completo com 42 testes, migration com RLS, repositórios demo e
Supabase, auth com rota protegida, registro rápido, cronômetro de sessão, streak
dos últimos 7 dias, histórico com filtro por eixo, metas com progresso e perfil
editável. Landing nova e rota `/ferramentas` (calculadoras abertas, sem login).

O cronômetro guarda a sessão no `localStorage` (`momentumm.timer.v1`), sobrevive a
recarregar a página e calcula o tempo por timestamp, nunca por contador de tique.
Eixo medido em páginas pede o valor no fim; os medidos em minutos registram
direto. A atividade nasce com `source: 'timer'`.

Pendente da fase 1: importações (Kindle, Health, Fit) — a tabela de fases as
coloca na fase 4, então não bloqueiam o resto. Fase 2 (feed, follows, kudos,
recap) ainda não começou.

**Otimização conhecida:** o cliente do Supabase entra no bundle mesmo em modo demo.
Quando incomodar, trocar por import dinâmico dentro do `container`.

## Como rodar

```bash
cd app
npm install
npm run dev     # modo demo, sem configurar nada
npm test        # 29 testes de domínio
npm run build
```
