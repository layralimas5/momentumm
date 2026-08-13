# Momentumm

Rede social de evolução pessoal. O que o Strava é pra corrida, o Momentumm é pra
quem quer crescer: leitura, estudo, treino, meditação, escrita, hábitos e metas
registrados, acompanhados e compartilhados no mesmo lugar.

## Status

Repositório zerado em 13/08/2026 para reestruturação. O app ainda não foi
reconstruído.

## De onde veio

Este repositório era o **Aura** (SaaS de transformação pessoal com metas, leituras
e jornada). O produto foi reposicionado e a estrutura será refeita em torno de uma
unidade única de atividade, o que permite ser multi eixo de verdade.

O código do Aura continua acessível no histórico:

```bash
git checkout aura-final          # estado final do Aura
git checkout feat/journey-modules
```

## Documentação

- `CLAUDE.md` — contexto, arquitetura e padrões do projeto
- `../saas-ideias/momentumm.md` — conceito, modelo de dados, fases e aquisição

## Stack

React + TypeScript (strict) + Vite + Tailwind CSS v4 + Framer Motion no front.
Supabase (Postgres, Auth, RLS) nos dados. Clean Architecture.
