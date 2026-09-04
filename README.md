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

Fase 1 funcionando. A jornada principal é um ciclo de três telas:

1. **Onboarding** — área, objetivo, prazo e um plano gerado que já vira hábito
   e ação, com o primeiro dia começando ali mesmo.
2. **Hoje** — momentum, progresso dos objetivos, prioridade do dia, hábitos,
   ações e check-in.
3. **Review** — a semana em números: quanto do planejado saiu, onde o ritmo
   caiu, onde evoluiu e o que mudar na semana seguinte.

Além disso: sessão de foco, insights, metas com progresso, histórico e perfil.
Fase 2 (feed, follows, kudos, recap mensal) ainda não começou.

O plano nunca finge que cabe: quando o prazo exige mais do que se sustenta por
semanas, ele avisa e sugere a data que funcionaria.

O dashboard trata o dia como variável: o check-in define a capacidade e, num dia
de energia baixa, o app sugere a versão mínima do plano em vez de incentivar o
abandono.

Conceito, modelo de dados e plano de aquisição em `../saas-ideias/momentumm.md`.

## Histórico

Este repositório era o **Aura**. O código anterior continua acessível:

```bash
git checkout aura-final
```
