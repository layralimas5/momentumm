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
4. **Repositório remoto:** `layralimas5/momentumm`. O `layralimas5/aura` continua
   existindo como histórico e responde pelo remote `aura` neste clone.

## Estado atual

Fase 1 em pé, em `app/`. Roda em **modo demo** sem configurar nada (dados em
`localStorage`) e vira contas reais ao preencher `.env.local` com o Supabase.

Pronto: domínio completo com 158 testes, três migrations com RLS, repositórios demo e
Supabase, auth com rota protegida, registro rápido, cronômetro de sessão, streak
dos últimos 7 dias, histórico com filtro por eixo, metas com progresso e perfil
editável. Landing nova e rota `/ferramentas` (calculadoras abertas, sem login).

### Dashboard (camada de planejamento)

A tela `Hoje` responde quatro perguntas, nessa ordem: como estou hoje, o que
importa agora, qual é a próxima ação, estou avançando de verdade. As seções não
são independentes — o check-in define a capacidade do dia, a capacidade calibra a
recomendação, hábitos e ações alimentam o momentum, o momentum vira progresso
semanal e o conjunto gera o insight, que devolve um ajuste aplicável.

Entidades novas (`app/src/domain/entities/`):

- `checkin` — estado, energia (1-5) e foco do dia. Deriva a **capacidade**
  (`minima` / `moderada` / `plena`), que é o que faz o app sugerir a versão
  mínima em vez de empurrar o plano cheio num dia ruim
- `habit` + `HabitLog` — repetição com frequência, versão mínima e sequência
  própria. `pulado` e `adiado` são estados legítimos: perder um dia não é punido
- `task` — a ação que liga meta a movimento. Uma única **prioridade principal**
  por dia, com versão mínima pra dia ruim
- `momentum` — pontuação de 0 a 100 com classificação, comparação com os 7 dias
  anteriores, explicação e recomendação. Constância pesa mais que volume
- `week` — série de sete dias mais a conclusão escrita
- `insight` — regras determinísticas sobre os dados reais. Sem padrão detectado
  não há insight: nada de frase motivacional genérica
- `win` — uma vitória por dia
- `plan` — limites de `free` e `pro`. O PRO amplia profundidade, **nunca**
  libera o básico: o dashboard não é bloqueado por banner

Estado único em `presentation/planner/PlannerProvider` (carrega tudo de uma vez,
escritas otimistas). A sessão de foco vive em `presentation/focus/FocusProvider`
e é uma só no app inteiro: a prioridade e o card de foco são duas portas pro
mesmo cronômetro. Rotas: `/app`, `/app/jornada`, `/app/habitos`, `/app/metas`,
`/app/foco`, `/app/review`, `/app/insights`, `/app/configuracoes` (as antigas `/app/atividades`
e `/app/perfil` redirecionam).

### A jornada principal

O produto é um ciclo de três telas, nessa ordem:

**1. Onboarding.** Quatro passos: **áreas, tempo, objetivos, plano**. Conta nova
não vê cards vazios — escolhe o que quer mudar (uma área ou várias, uma por
eixo), diz quanto tempo por dia consegue dar, escreve os objetivos com prazo e
recebe um plano pronto pra virar hábito e ação. O último passo é o primeiro dia
começando, não um resumo.

O **tempo vem antes dos objetivos** de propósito: é ele que calibra cada alvo
sugerido, e perguntar depois faria o app propor números que ele já sabe que não
cabem. Com mais de um objetivo, o tempo do dia é dividido em partes iguais e o
veredito soma o que os planos pedem — o dia não estica.

**2. Dashboard (`Hoje`).** Saudação, momentum, progresso dos objetivos,
prioridade do dia, hábitos, ações e check-in. O objetivo vem alto de propósito:
sem destino na frente, a pessoa cumpre a lista e não chega em lugar nenhum.

**3. Review (`/app/review`).** Semanal: como foi, % de execução, onde perdeu
ritmo, onde evoluiu, e uma recomendação pra semana seguinte. Tela separada —
relatório dentro do dia transforma execução em contabilidade.

Entidades da jornada:

- `objective` — o que a pessoa quer mudar, **com prazo**. Difere de `goal` por
  natureza: a meta é um ritmo que se repete, o objetivo termina. Um ativo por
  eixo (índice único no banco). O progresso soma as `activities` do eixo dentro
  da janela, sem tabela de vínculo: a atividade continua sendo a unidade única
- `plan-builder` — o gerador de plano. Aritmética pura sobre alvo, prazo, dias
  por semana e **minutos por dia**; o mesmo pedido gera sempre o mesmo plano. O
  tempo declarado é teto: nenhuma sessão pode passar dele. **Avisa quando não
  cabe** e oferece as duas saídas honestas — o prazo que caberia (nunca um que o
  objetivo recusaria) ou o alvo que cabe no prazo atual. `buildCombinedPlan`
  faz o mesmo pra vários objetivos e diz se o conjunto cabe no dia
- `review` — a leitura da semana. Regras determinísticas: sem padrão detectado,
  o bloco não escreve nada. Não cobra dias anteriores à criação do hábito

O rascunho e os planos vivem em `presentation/planner/use-journey-draft`,
compartilhados entre o onboarding (em passos, várias áreas) e o
`ObjectiveDialog` (numa tela só, uma área). Os blocos de formulário também são
os mesmos: `AxisPicker`, `ObjectiveFields`, `TimeBudgetFields` e
`CombinedPlanPreview`.

`PlannerProvider.applyPlan` recebe a lista de planos e grava tudo numa operação:
objetivo, ritmo semanal, hábitos e ações já apontando pra meta criada. **Só a
primeira ação do primeiro plano vira prioridade principal** — é uma por dia, e
três objetivos não podem virar três prioridades disputando o mesmo dia.

No modo demo, Configurações tem **Recomeçar do zero** — é o caminho pra rever o
onboarding sem abrir o devtools.

### Celular

O dashboard do celular é uma **árvore de componentes própria**
(`presentation/components/mobile/`), escolhida em tempo de execução por
`useIsDesktop()`. Não é o desktop encolhido: a ordem muda pra registrar,
decidir e começar, e a análise vem depois.

- Barra inferior com cinco lugares (Hoje, Jornada, +, Foco, Perfil). Hábitos,
  Metas e Insights não cabem lá e ficam nos atalhos do Perfil
- Check-in resolve em **um toque**. A energia só é perguntada nos estados
  baixos, onde a resposta muda o plano (`defaultsForMood`)
- Camada modal do celular é o `BottomSheet`, não o `Dialog`
- Gesto sempre tem alternativa visível: deslizar pra adiar existe, mas a mesma
  ação está no menu "⋯" da linha
- `pb-tabbar`, `pb-safe` e `pt-safe` cuidam do notch e do risco de gestos;
  o `index.html` usa `viewport-fit=cover`
- Botão flutuante aparece só quando o card que oferece a mesma ação saiu da
  tela (IntersectionObserver), nunca competindo com a barra de baixo
- Limite de plano vira `ProSheet` contextual, jamais pop-up ao abrir o app

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
npm test        # 158 testes de domínio
npm run build
```
