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

## Pendências a decidir antes de escrever código

1. Nome definitivo do repositório remoto (hoje ainda é `layralimas5/aura`)
2. Público: manter o recorte feminino do Aura ou abrir geral
3. Eixos da fase 1 (sugestão: leitura, estudo, treino, meditação)
4. Identidade visual (a do Aura era preto, vinho e off-white; decidir se fica)

## Estado atual

Repositório limpo, só documentação. O scaffold novo começa quando a Lay disser
**"vamos desenvolver o momentumm"**.
