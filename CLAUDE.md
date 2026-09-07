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

Pronto: domínio completo com 316 testes, quatro migrations com RLS, repositórios demo e
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

**Atalho de dev:** `VITE_AUTH_BYPASS=true` no `.env.local` abre o app já
autenticado na sessão demo, sem passar pelo login. Só vale em `vite dev` — em
build de produção a flag é ignorada.

### A hierarquia (o que amarra tudo)

O produto deixou de ser módulos vizinhos e virou um ciclo só:

**Objetivo → Plano (etapas) → Ações e hábitos → Execução do dia → Progresso →
Insight → Ajuste.**

- `plan-stage` — a **etapa**, o degrau que faltava. Tem peso (o quanto vale do
  objetivo), ordem, situação e data prevista. Os pesos **somam 100 sempre**; o
  domínio recusa um conjunto que não fecha, e criar ou apagar etapa
  redistribui sozinho. `atrasada` é derivada de `due_on`, nunca guardada — a
  mesma decisão de estado x status que `objective` já tinha
- `plan-progress` — a **única** resposta pra "quanto do objetivo está feito".
  A conta sobe pela hierarquia: ação (peso) → etapa (peso) → objetivo. Detecta
  o **gargalo** e a **próxima ação**. Hábito NÃO entra: execução é execução.
  Objetivo sem etapa cai no volume registrado, e a tela diz isso em voz alta
- `forecast` — **previsão** pela velocidade das últimas duas semanas. Sem sete
  dias de história, duas conclusões e avanço na janela, ela se cala. A frase é
  sempre condicional ("mantendo esse ritmo")
- Ação ganhou `stageId`, `weight` e `isRequired`; hábito ganhou `stageId`
  (opcional: hábito que atravessa o plano não deve ser recriado a cada fase)
- Ação sem objetivo é legítima e vira **caixa de entrada**: ela não empurra
  progresso nenhum até ganhar destino, e o plano cobra isso
- `momentum` ganhou três fatores — plano cumprido (atraso e adiamento),
  revisões e avanço dos objetivos. Todos **neutros** quando não há o que
  cobrar: conta nova não perde ponto por rotina que ainda não teve
- `insight` ganhou oito regras que leem etapa, peso e previsão (gargalo, ritmo
  contra prazo, ação que destrava a etapa seguinte, semana maior que a
  capacidade, queda de constância, hábito que puxa execução, caixa de entrada,
  retomada reconhecida)

**Etapa concluída é decisão da pessoa.** O app sugere quando todas as ações
obrigatórias saíram, e só. O único avanço automático é a etapa sair de "não
iniciada" na primeira ação concluída.

O plano de cada objetivo é calculado **uma vez** no `PlannerProvider` e lido por
todas as telas (`plans`). Foi a divergência entre elas — o plano dividia ações
concluídas pelo total, o detalhe mostrava volume sobre alvo — que motivou tudo
isso; recalcular por tela traz o problema de volta.

Migration `0007_plan_stages.sql`: aditiva, com RLS, trigger que recusa etapa de
outro objetivo e trigger que carimba a data de conclusão.

### Share Studio e a camada de momentos

O produto ganhou a ponte entre progresso e conteúdo: transformar o que a pessoa
fez em imagem compartilhável. A referência é o Strava, aplicada a rotina,
objetivo, constância e Momentum.

**A entidade nova NÃO se chama `Activity`.** `activity` já é a unidade do
Momentumm — esforço registrado, "leu 32 páginas" — e é ela que alimenta streak,
meta e histórico. O que o Share Studio precisa é de outra coisa: o EVENTO que
vale contar. Reaproveitar o nome faria as duas tabelas discordarem sobre o que
"atividade" significa, e o feed futuro leria a errada.

- `journey-event` — o momento notável. Nove tipos (`day_completed`,
  `routine_completed`, `goal_progress`, `goal_completed`, `milestone`,
  `weekly_review`, `comeback`, `momentum_record`, `habit_completed`), com
  `sourceType` + `sourceId`, progresso antes/depois, momentum antes/depois,
  percentual, duração e metadata **tipada** (nada de `Record<string, unknown>`).
  A variação do momentum é DERIVADA, nunca guardada
- `visibility` já tem os quatro degraus (`privada`, `amigos`, `comunidade`,
  `publica`), mas todo evento nasce **privado** e nenhuma tela escreve outra
  coisa. Ela existe pra o feed não exigir migration destrutiva depois.
  Compartilhar a imagem no Instagram **não** muda a visibilidade do dado
- Migration `0008_journey_events.sql`: enums, RLS restritiva (ninguém lê o
  momento de outra pessoa nesta versão, nem marcado `publica`), índice único
  parcial de deduplicação por (user, tipo, origem, dia) e trigger de carimbo

**Dois caminhos, um destino.** Transição gravada vira linha no banco
(objetivo concluído no `PlannerProvider`, review concluído no `saveWeeklyReview`,
dia fechado no `DashboardPage` — que é quem sabe quando o dia fecha). "Compartilhar
meu dia às 15h de uma terça comum" não é fato, é uma FOTO do estado: sai de
`domain/share/journey-event-builders`, é efêmero e não vai pro banco. O Share
Studio não sabe de onde veio o evento — que é o desacoplamento que o feed vai
precisar.

**A cadeia é `JourneyEvent → ShareCardData → template → exportação`**, e cada
elo só conhece o anterior. `share-card-adapter` é o único lugar que decide o que
um evento vira dentro de uma imagem; nenhum template conhece hábito, objetivo ou
etapa.

**Privacidade por menor exposição.** Nome do objetivo, lista de hábitos e nome
da pessoa começam **desligados** — são os três campos que carregam texto escrito
por ela. Campo desligado não vira placeholder: ele some. Um card com "Objetivo
oculto" denunciaria que havia algo escondido. Toggle que o tipo de evento não
suporta não aparece: toggle que não muda nada ensina a desconfiar dos outros.

**Renderização em canvas, não HTML fotografado.** As bibliotecas que fotografam
DOM erram em `oklch` (o padrão do Tailwind v4) e `foreignObject` em SVG quebra
no Safari do iPhone — o aparelho onde o Stories acontece. Existe UM renderizador
(`render-share-card`) num espaço fixo de 1080 de largura; o preview é o mesmo
desenho em escala menor. "O que você vê é o que sai" fica garantido por
construção, não por disciplina.

Os cinco templates (Dark, Light, Gradient, Minimal, Transparent) são **temas** —
paleta, alinhamento, densidade e fundo — sobre o mesmo layout. Cinco funções de
desenho independentes seriam cinco lugares pra corrigir, e quatro ficariam pra
trás. Transparent exporta PNG com alpha real, pra ir sobre a foto da pessoa.

**Foto de fundo, no modelo do Strava.** A pessoa escolhe uma foto do aparelho e
ela vira o fundo do card. Três decisões sustentam isso:

- A foto **nunca sai do aparelho**. É lida pelo navegador, desenhada no canvas e
  vira parte do PNG. Não existe upload, bucket nem servidor sabendo dela
- Com foto, o conteúdo **desce e encosta no rodapé** em vez de ficar centrado.
  Os dois terços de cima da foto ficam limpos — o rosto, o lugar, o treino — e o
  texto cai sobre a faixa que o véu escurece. Centralizado, o número cobriria
  justamente o que a foto tem de melhor
- Com foto, o template decide só **alinhamento e densidade**: a paleta vira
  branco com sombra. Não existe resposta certa pra texto preto sobre uma foto
  que pode ser noturna

O card também emagreceu. Saiu a barra de progresso (o "87%" já é a informação),
o selo do momentum virou uma linha sem caixa — moldura desenhada por cima da
foto de alguém é o que denuncia "isto saiu de um app" — e a frase do Momentumm
virou um toggle **desligado por padrão**. O card que a pessoa posta precisa
parecer dela, não o print de um dashboard.

**O produto é de celular.** O Share Studio nasceu mobile-first e é ali que ele é
afinado; o desktop tem o layout de duas colunas e funciona, mas não recebe
investimento novo.

Saída sempre em PNG (1080×1920 / 1080×1350 / 1080×1080). Compartilhamento pelo
share sheet nativo (Web Share API com arquivo) e download como saída quando ele
não existe — sem SDK de Instagram, TikTok ou WhatsApp. Analytics tem contrato e
ponto único de saída (`share-analytics`), com payload FECHADO: tipo, template e
formato, nunca conteúdo escrito pela pessoa.

Botões em `Hoje` (dia, rotina, retomada, momentum, conforme o que o dia
oferece), no detalhe do objetivo, no fim do review e nos insights. O estúdio mora
acima das páginas (`ShareStudioProvider`): cinco telas abrindo o mesmo modal, em
vez de cinco modais que divergem em dois meses.

**Não implementado de propósito:** feed, amigos, curtidas, comentários,
comunidade, ranking e perfil público. A arquitetura está pronta pra eles; o
produto continua single-player.

### O gravador de momentos e o Perfil

A camada de momentos deixou de depender de alguém lembrar de gravar. Quem
decide o que vira registro é `journey-recorder`, uma função **pura**: recebe o
estado do dia mais os eventos já gravados e devolve só o que falta. Rodar de
novo não duplica nada, e dá pra provar isso em teste sem banco — que é o
oposto de espalhar `record(...)` por sete componentes.

Ele cobre hábito concluído, rotina fechada, dia cumprido, retomada, recorde de
momentum, objetivo cruzando uma faixa e marco alcançado. Objetivo concluído e
review fechado continuam gravados no `PlannerProvider`, no clique: são
transições com hora marcada, e adiá-las pro próximo carregamento do dashboard
carimbaria o horário errado no que um dia vai ser o feed.

**Duas chaves de repetição, e a diferença importa.** Evento de DIA (hábito,
rotina, dia, retomada, momentum) repete a cada dia novo: a chave inclui a data.
Evento de VIDA (marco, objetivo cruzando 25/50/75%) acontece uma vez só: a
chave ignora a data, senão "100 hábitos concluídos" seria gravado de novo toda
vez que a pessoa abrisse o app no dia seguinte.

`milestone` guarda as regras dos marcos — faixas poucas e espaçadas de
propósito, porque marco a cada dez vira ruído, e ruído é o oposto de conquista.
A sequência usa o RECORDE e não a atual: conquista que some quando a pessoa
perde um dia é conquista que o app tira de volta.

**O Perfil (`/app/perfil`)** é um painel da evolução pessoal, não uma página de
rede social. Ele responde "o quanto eu mudei desde que comecei", não "quem me
segue", e funciona inteiro com uma pessoa só usando o app: momentum,
constância, semanas de progresso, sequência, objetivos ativos, conquistas com o
próximo marco e o progresso recente. Nenhum número é calculado aqui — todos vêm
de onde já eram calculados, porque duas telas contando "constância" com contas
diferentes é como um app começa a discordar de si mesmo.

Nome, foto e bio se editam ali; @ e visibilidade padrão continuam em
Configurações, que é onde moram os ajustes de conta.

**A foto vive na coluna `avatar_url`**, reduzida a 256px e codificada como data
URL (~20KB) antes de sair do aparelho. Evita um bucket de Storage inteiro —
políticas, URL assinada, limpeza de órfão — por um arquivo que cada conta tem
UM. Quando existir foto de capa ou álbum, a migração é trocar o conteúdo da
coluna por um caminho, e nada acima muda.

Ainda **não existe** feed, amigos, seguidores, curtida, comentário, ranking nem
comunidade, e o perfil termina dizendo isso em voz alta: nada ali é público, e
compartilhar gera uma imagem no aparelho, não uma publicação.

### A jornada principal

O produto é um ciclo de três telas, nessa ordem:

**1. Onboarding.** Quatro passos: **áreas, tempo, objetivos, plano**. Conta nova
não vê cards vazios — escolhe o que quer mudar (uma área ou várias, uma por
eixo), diz quanto tempo por dia consegue dar, escreve os objetivos com prazo e
recebe um plano pronto pra virar hábito e ação. O último passo é o primeiro dia
começando, não um resumo.

**As quatro áreas de fábrica são um começo, não a lista.** Em "Outra área" a
pessoa escreve a dela (escrita, terapia, violão) e isso vira um eixo de verdade:
`activity_types` ganha uma linha e a área entra no filtro do histórico, no
registro rápido, no gráfico da semana e na review sem código novo — que era a
promessa da arquitetura desde o primeiro commit. Área criada é medida em
minutos e recebe roteiro e limites genéricos e conservadores.

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
- `activity-type` — deixou de ser constante e virou **registro**: quatro eixos
  de fábrica mais os que a conta criou, carregados no início da sessão por
  `registerCustomActivityTypes`. `ActivityTypeSlug` é `string` porque a lista é
  aberta, e `activityType()` devolve um eixo genérico pra slug desconhecido —
  registro de uma área apagada continua aparecendo no histórico
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
  Metas, Review e Insights não cabem lá e ficam nos atalhos do Perfil
- Em `Minha Jornada` a **sequência abre a página**. No desktop ela mora na
  coluna lateral, mas no celular, no fim da rolagem, ela simplesmente não é
  vista — e é ela a resposta que traz a pessoa àquela tela
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
npm test        # 316 testes de domínio
npm run build
```
