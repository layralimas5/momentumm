# Momentumm

Rede social de evolução pessoal. O que o Strava é pra corrida, o Momentumm é pra
quem quer crescer: leitura, estudo, treino e meditação registrados, acompanhados
e compartilhados no mesmo lugar.

## Como rodar

```bash
cd app
npm install
npm run dev
```

Abre em modo demo, sem configurar nada: os dados ficam no `localStorage` do
navegador. Pra ativar contas reais, copie `app/.env.example` para `app/.env.local`,
preencha com o projeto do Supabase e rode a migration de `app/supabase/migrations/`.

```bash
npm test        # testes de domínio
npm run build   # build de produção
```

## Arquitetura

Clean Architecture, com a regra de dependência sempre pra dentro:

```
app/src/
  domain/          entidades e portas (não importa React nem Supabase)
  infrastructure/  Supabase, modo demo e o container que escolhe entre os dois
  presentation/    React: páginas, componentes, hooks
  shared/          erros e utilitários
```

**A decisão que manda em tudo:** existe uma unidade só, a atividade. Leitura,
estudo, treino e meditação são a mesma entidade com `type` diferente. Eixo novo é
uma entrada em `activity_types`, nunca um módulo novo. Streak, meta, histórico e (na
fase 2) feed e ranking funcionam pra qualquer eixo sem código adicional.

Visibilidade de atividade é regra de RLS no banco, não filtro no front.

## Status

Fase 1 funcionando: registro rápido, sequência, metas com progresso, histórico e
perfil. Fase 2 (feed, follows, kudos, recap mensal) ainda não começou.

Conceito, modelo de dados e plano de aquisição em `../saas-ideias/momentumm.md`.

## Histórico

Este repositório era o **Aura**. O código anterior continua acessível:

```bash
git checkout aura-final
```
