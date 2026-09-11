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

Pronto: domínio completo com 642 testes, migrations com RLS até a 0017, repositórios demo e
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
  anteriores, explicação e recomendação. Quatro fatores (ver abaixo)
- `week` — série de sete dias mais a conclusão escrita
- `insight` — regras determinísticas sobre os dados reais. Sem padrão detectado
  não há insight: nada de frase motivacional genérica
- `win` — uma vitória por dia
- `plan` — a matriz de `free` e `pro`, numa frase: **o gratuito organiza e
  executa, o PRO registra, analisa e evolui**. Gratuito: 2 objetivos, 5
  hábitos, 1 plano por etapas, 5 ações por dia, 15 dias de histórico, só a
  pontuação de hoje do Momentum, check-in semanal manual de quatro perguntas
  (`BASIC_REVIEW_STEPS`), 1 modelo de card. PRO: sem limites, evolução e
  detalhamento do score, review cruzando os dados, Momentumm AI, métricas,
  relatórios, registros em texto/foto/voz, análises, personalização.
  `planMatrix()` gera a tabela da landing a partir dos mesmos números.
  `plan-usage` conta o uso sobre o estado (`planUsageOf`) e o
  `PlannerProvider` recusa a criação que passa do limite (`PlanLimitError`);
  as telas leem `planner.usage` pra desabilitar e explicar antes. O dashboard
  continua sem banner: limite aparece onde encosta (`UpgradeHint`,
  `PlanLimitDialog` na porta do Composer) e recurso sem versão menor mostra
  o `ProGate` (IA, métricas, leituras do ritmo)

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
- `momentum` lê o plano: o avanço dos objetivos é um dos quatro fatores do
  score, e ele fica **neutro** quando não há plano montado — conta nova não
  perde ponto por uma etapa que ela ainda não criou
- `insight` ganhou oito regras que leem etapa, peso e previsão (gargalo, ritmo
  contra prazo, ação que destrava a etapa seguinte, semana maior que a
  capacidade, queda de constância, hábito que puxa execução, caixa de entrada,
  retomada reconhecida)

O **Momentumm AI** grava as etapas que mostra: cada linha de `steps` vira uma
`plan_stage` de verdade e cada ação nasce dentro da sua (`stepIndex` no contrato
da sugestão). Antes disso a prévia prometia um caminho e salvava uma lista, e o
objetivo criado por ali nascia sem plano — logo sem gargalo, sem previsão e fora
de todas as regras de insight de etapa.

**Todo objetivo nasce com caminho, não só o da IA.** `buildPlan` devolve três
etapas — entrar no ritmo (20%), chegar na metade (40%), fechar (40%) — com data
proporcional ao peso, e cada ação já traz o `stageIndex` da sua. Três e não
cinco porque o gerador não sabe nada do assunto: o que dá pra afirmar de
qualquer objetivo com alvo e prazo é que existe um começo, uma metade e um fim.
Quem quiser um caminho mais fino quebra as etapas na mão. O `applyPlan` grava as
etapas ANTES das ações, e é isso que faz o objetivo criado no onboarding e no
diálogo "Novo objetivo" ter gargalo, previsão e as regras de insight de etapa
desde o primeiro dia.

`createStage` e `resolveStage` leem o snapshot corrente do provider, não o
`data` do render: plano inteiro é gravado num `for` dentro do mesmo tick, e ler
o estado do render fazia a segunda etapa nascer sem enxergar a primeira — peso
somando mais de 100 na tela, e a ação recusada com "essa etapa não existe mais"
logo depois de a etapa ser criada.

**Gargalo só existe onde alguma etapa andou.** A regra de "etapa parada com
peso alto" agora exige movimento em algum lugar do plano: com tudo em zero, a
etapa mais pesada levava o selo de "segurando o objetivo" no primeiro dia, que
é exatamente o aviso inventado que ensina a ignorar os avisos de verdade. Atraso
é fato e continua valendo em qualquer plano.

O insight `objetivo-sem-plano` fecha o elo que faltava: objetivo com três ou
mais ações e nenhuma etapa é cobrado, porque ali a barra mede volume e ninguém
consegue ver o que está travando. Abaixo desse número ele se cala — objetivo
recém-criado ainda não tem o que quebrar em etapas.

A ponte entre o plano e o dia é o botão **Trazer pra hoje**, na linha de ação
(plano, etapa e caixa de entrada) e no card da próxima ação do dashboard. Antes
dele a ação atrasada ou marcada pra frente só entrava no dia pelo editor, e o
passo que o plano apontava como próximo não tinha caminho até `Hoje`.

O modo demo devolve as mesmas listas que o Supabase: objetivo, meta e hábito
arquivados ficam fora de `listByUser`, e apagar etapa redistribui os pesos como
criar já fazia. Divergência entre os dois repositórios do mesmo contrato é o
começo de dois produtos saindo do mesmo código. `demo-flow.test.ts` cobre o
ciclo inteiro por esses repositórios.

**Etapa concluída é decisão da pessoa.** O app sugere quando todas as ações
obrigatórias saíram, e só. O único avanço automático é a etapa sair de "não
iniciada" na primeira ação concluída.

O plano de cada objetivo é calculado **uma vez** no `PlannerProvider` e lido por
todas as telas (`plans`). Foi a divergência entre elas — o plano dividia ações
concluídas pelo total, o detalhe mostrava volume sobre alvo — que motivou tudo
isso; recalcular por tela traz o problema de volta.

Migration `0007_plan_stages.sql`: aditiva, com RLS, trigger que recusa etapa de
outro objetivo e trigger que carimba a data de conclusão.

### O Momentum Score

Quatro fatores, cada um normalizado de 0 a 100 antes de entrar na média:
**consistência recente (35%)**, **execução das prioridades (30%)**, **progresso
nos objetivos (20%)** e **capacidade de retomada (15%)**. Os pesos vivem em
`DEFAULT_MOMENTUM_WEIGHTS` e são a única coisa a mexer numa recalibragem.

**A janela é de 28 dias, com cada um dos últimos 7 valendo o triplo dos
anteriores.** Sete dias sozinhos fazem o número virar termômetro de humor — uma
gripe apaga um mês de trabalho. Vinte e oito sozinhos fazem o contrário: a
pessoa muda hoje e o número não reage, então ele deixa de servir pra decidir
alguma coisa. Com o peso, a semana atual responde por metade do score.

**O que conta é impacto, não quantidade** (`momentum-impact`). Cada item vale 1,
2 ou 3: prioridade principal e ação de alta dentro de um objetivo valem 3,
ação de objetivo vale 2, tarefa comum vale 1. Hábito tem **teto em 2** — são
cinco marcações por dia contra uma, e repetição não pode competir com a ação que
destrava a etapa. Além disso, hábitos e tarefas comuns rendem no máximo 2 pontos
por dia cada, e o dia inteiro satura em 4: sem esses tetos, criar hábitos fáceis
vira a maneira mais rápida de subir o número, que é o comportamento oposto ao
que o produto defende.

**O crédito de um dia é meio presença, meio tamanho.** Aparecer vale 0,5; o
impacto do que saiu vale os outros 0,5. Só o impacto faria um dia de leitura
curta valer um quarto de um dia normal — e a mensagem do produto é que
constância ganha de volume. Só a presença faria marcar um hábito de dois minutos
valer o mesmo que fechar a etapa.

**Falhar um dia custa pouco e nunca zera**: com 28 dias na conta, o pior dia
possível tira poucos pontos. E a retomada mede o TEMPO até o retorno — voltar em
até dois dias devolve nota cheia, quatro dias devolve 0,6, mais de dez devolve
0,1. Quem não parou não ganha nota cheia de graça: sem pausa não há retomada pra
medir, e o fator herda a consistência.

**A janela nunca começa antes do primeiro registro da conta, e nunca é menor que
sete dias.** O primeiro corte impede medir uma conta de duas semanas contra 14
dias em que ela não existia; o piso impede que "registrei hoje" empate com
"registrei a semana toda" — e é no começo que a constância mais precisa
significar alguma coisa. Abaixo de sete dias de história, `hasEnoughData` é
falso e a tela diz que o número ainda está se formando, em vez de vender
precisão que não existe.

**Fator sem base herda a consistência em vez de zerar**, e `basis` diz quais
foram medidos de verdade — o detalhamento avisa em voz alta. Zerar o fator de
objetivos de quem não montou plano seria cobrar uma etapa que não existe.

O dashboard mostra número, classificação, variação contra a semana anterior,
curva dos últimos 14 dias, o que subiu e o que caiu (em pontos DO SCORE, já
ponderados) e uma frase curta que cita o fator que mais mexeu. "Entender meu
score" abre o mesmo diálogo no desktop e no celular (`MomentumDialog`), com os
quatro fatores, o peso de cada um e o que cada um mede.

Os pontos por fator são repartidos pra somar exatamente o score
(`distributePoints`): um detalhamento que soma 47 embaixo de um número 46 ensina
que a conta da tela não é confiável.

`momentumHistory` recalcula o score REAL de cada dia pela mesma função, em vez
de guardar uma série à parte — histórico separado é como a curva começa a
discordar do número grande no dia seguinte a qualquer ajuste de peso.

### Dia Adaptável e Modo Retomada

Os dois recursos que fazem o plano reagir ao dia real em vez de cobrar o dia
ideal. São entidades separadas (`adaptive-day`, `recovery`) e desembocam na
MESMA revisão: reorganizar o dia é uma operação só.

**Dia Adaptável** (`buildAdaptiveDay`). A pessoa diz quanto tempo tem e o
domínio devolve um plano com três vereditos por item — **manter**, **reduzir**
pra versão mínima, **reagendar**. A ordem sai de um score que soma impacto,
prioridade, vínculo com objetivo, prazo e progresso (juntos: "atrasado" já é a
comparação entre os dois), gargalo da etapa, tempo estimado, sequência do
hábito, há quantos dias a ação está sendo arrastada e o nível do Momentum —
ritmo caindo empurra a repetição pra frente, ritmo alto empurra o objetivo.
Pesos em `WEIGHT`, num lugar só.

O que ele se recusa a fazer é o que define o recurso:

- **Não puxa ação atrasada pro dia curto.** Encher o dia de hoje com a dívida
  de ontem é o acúmulo com outro nome, e no terceiro dia a pessoa fecha o app
- **Não empilha tudo em amanhã.** A ação reagendada procura o primeiro dia
  cuja carga ainda comporta o tamanho dela, dentro do prazo do objetivo e de
  uma semana no máximo. A carga de referência é a média do que a própria
  pessoa costuma planejar, nunca um número fixo
- **Não tira hábito do dia.** Hábito não muda de data: ele encolhe pra versão
  mínima, e é ela que preserva a sequência. A reserva de tempo dele é sempre a
  mínima — reservar a cheia faria a rotina comer o que move o objetivo
- **Não devolve dia vazio, e não deixa o protegido cair.** A prioridade
  principal encolhe mas não sai; sem versão mínima, o plano diz em voz alta que
  ela não cabe em vez de escondê-la numa data futura
- **Não grava nada sozinho.** A revisão ("Vamos proteger seu Momentum") mostra
  item por item com o motivo, e só o "Confirmar" escreve

**Modo Retomada** (`detectRecovery`). Liga com **sinais combinados** — três
dias de baixa execução, objetivo sem avanço há uma semana, adiamentos
recorrentes, queda de 8+ pontos no Momentum — e exige pelo menos dois: um sinal
sozinho é quase sempre ruído (viagem, férias, espera de terceiro). Cada sinal
mostra o número que o produziu. Hoje não conta como dia fraco (ainda está
acontecendo) e quem já se moveu hoje não vê o card.

Oferece até três passos pequenos, ordenados por **avanço por minuto** e não por
importância: a ação mais importante costuma ser a maior, e oferecer ela como
porta de entrada é pedir pra pessoa recomeçar pelo degrau em que ela parou. Um
passo por objetivo, teto de 30 minutos, versão mínima quando existe.

Escolher um passo abre a mesma revisão do Dia Adaptável, com o passo protegido,
o orçamento reduzido ao tamanho da volta e a ação trazida pro dia se ela vier
de outra data.

**A recompensa da retomada é real, não um bônus inventado.** Ela vem por dois
caminhos que já existiam: o passo escolhido vira a prioridade principal, e
prioridade vale 3 pontos de impacto contra 1 de tarefa comum; e a retomada mais
recente passou a pesar o dobro das anteriores no fator de capacidade de
retomada (`LATEST_RETURN_WEIGHT`) — o fator pergunta "você consegue voltar?", e
a resposta que vale é a de agora. Nada é gravado pra inflar o número: o crédito
só existe se houve movimento de verdade no dia.

Nenhuma sequência é encerrada em nenhum dos dois caminhos, e o card diz isso.

### O posicionamento, e o que ele obriga no código

> Outros apps registram o que você planejou. O Momentumm percebe quando seu
> plano deixou de funcionar e ajuda você a continuar.

Isso não é frase de landing: é um critério de aceite. Toda tela que DESCREVE um
problema precisa carregar a execução que o resolve, e todo número que aparece
em duas telas precisa ser o mesmo número. Três coisas saíram disso:

**A entrada do Momentum é uma só** (`use-momentum-input`). O dashboard e o
progresso montavam a entrada cada um por conta, e só o dashboard somava o
avanço do plano: o fator de objetivos ficava medido numa tela e sem base na
outra, e o mesmo score aparecia com dois valores em telas vizinhas. A fórmula
sempre foi única (`calculateMomentum`); o que faltava era garantir que ela
recebesse os mesmos dados.

**A execução do insight é uma só** (`use-insight-actions`). Ela morava dentro
do `DashboardPage`, então o mesmo padrão era acionável no dia e apenas texto na
tela de Insights. O contrato do hook é estreito de propósito (`InsightContext`:
capacidade e prioridade do dia), e é por isso que o progresso consegue aplicar
o mesmo ajuste sem montar o dashboard inteiro.

**Quem descreve, resolve.** A tela de Insights passou a receber os objetivos
com plano e previsão — sem isso as oito regras que leem etapa, peso e prazo
nunca disparavam ali, justamente as que percebem o plano travando — e cada
leitura ganhou o botão que executa. O progresso ganhou "o próximo ajuste" com
a mesma ação, no lugar de uma frase sobre o fator mais fraco. O cartão de
objetivo ganhou "trazer pra hoje" na próxima ação: marcar um objetivo como
"parado há mais de uma semana" e não oferecer a saída é diagnóstico sem
tratamento.

**Navegação.** `Momentumm AI` saiu da barra lateral e virou secundária: um item
de IA ao lado de "Hábitos" e "Progresso" apresenta o produto como uma coleção
de recursos. Ela continua inteira, achável pela busca e pelos atalhos do
perfil. No lugar dela entrou o que estava **órfão**: `/app/insights` existia
como rota e como tela e nenhuma parte do app levava até ela — nem a busca, que
lê `APP_NAV`. Agora é "Leituras do ritmo", com entrada no dashboard, no
progresso e no sheet do celular. As descrições da navegação passaram a dizer o
PAPEL de cada tela no ciclo, não a funcionalidade dela.

### Segurança

A RLS existe desde o primeiro commit e as 18 tabelas sempre estiveram
protegidas. O que faltava era a camada em volta dela, e uma falha dentro dela.

**A falha:** `profiles.plan` era coluna de `profiles`, e a policy de update
liberava a linha inteira pro dono. Qualquer conta podia mandar um PATCH com
`{"plan":"pro"}` direto na API e virar PRO — o front nunca enviava esse campo,
que é justamente por que passou despercebido. A regra que sai disso vale pra
sempre: **entitlement nao mora em coluna que o dono edita**. Hoje um trigger
recusa a mudança fora de `service_role` ou admin com MFA.

**Papel fica fora de `profiles`** (`user_roles`, migration 0013), sem nenhuma
política de escrita pra API pública. `is_admin()` exige as duas coisas juntas:
papel de admin E sessão em `aal2` — o nível vem assinado no JWT, então "MFA
obrigatório pra admin" é condição de leitura no banco, não tela que dá pra
pular. `assert_admin()` é a versão que explode, pras funções privilegiadas:
uma checagem que devolve falso vira `update ... where false`, responde 200 e o
app acha que deu certo.

**`audit_logs`** tem uma política só, de leitura pra admin em aal2. Não existe
política de insert, update nem delete — e a ausência é a proteção: com RLS
ligada, o que não tem política é negado. Quem grava é `record_audit`, que
carimba o autor com `auth.uid()` em vez de aceitá-lo por parâmetro.

**Políticas separadas por comando** (0015). As `for all` antigas já traziam
`using` e `with check`, então não eram furo; o ganho é de revisão — afrouxar a
leitura amanhã não toca mais na mesma linha que governa o delete.
`apply_owner_policies` é o molde, pra a próxima tabela nascer com as quatro.

**Storage privado** (0014) antes de existir upload, porque a ordem inversa é o
que produz vazamento: quando a primeira tela de foto aparecer, o caminho mais
curto já vai ser o bucket fechado. O caminho `<user_id>/arquivo` não é
convenção, é a chave da autorização, e o trigger de exclusão leva os arquivos
junto com a conta.

**Autenticação** (`domain/auth`, `infrastructure/supabase/supabase-auth`):
Google, recuperação, troca de senha com reautenticação, MFA por TOTP e
encerramento global de sessão. Nenhuma resposta revela se um e-mail tem
conta — o `error.message` do GoTrue diz "User already registered" com todas as
letras, e ele subia direto pra tela. O freio de tentativas (`auth-throttle`) é
do navegador e não substitui o limite do servidor: ele impede o formulário de
virar ferramenta de teste de senha.

**O teste que roda sempre:** `infrastructure/config/secrets.test.ts` varre
`src`, `supabase` e o bundle atrás de `service_role`, `sb_secret_`, chave de
IA e JWT embutido. A suíte de autorização (`supabase/tests/authorization.sql`)
roda contra o banco de verdade, dentro de uma transação com rollback.

### Share Studio e a camada de momentos

O produto ganhou a ponte entre progresso e conteúdo: transformar o que a pessoa
fez em imagem compartilhável. A referência é o Strava, aplicada a rotina,
objetivo, constância e Momentum.

**A entidade nova NÃO se chama `Activity`.** `activity` já é a unidade do
Momentumm — esforço registrado, "leu 32 páginas" — e é ela que alimenta streak,
meta e histórico. O que o Share Studio precisa é de outra coisa: o EVENTO que
vale contar. Reaproveitar o nome faria as duas tabelas discordarem sobre o que
"atividade" significa, e o feed futuro leria a errada.

- `journey-event` — o momento notável. Treze tipos (`day_completed`,
  `routine_completed`, `goal_progress`, `goal_completed`, `milestone`,
  `weekly_review`, `comeback`, `momentum_record`, `habit_completed` e os quatro
  de desafio: `challenge_joined`, `challenge_progress`, `challenge_milestone`,
  `challenge_completed`), com
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

**O card nasce cheio do que a pessoa fez.** Tudo que é NÚMERO começa ligado:
percentual, momentum, duração, sequência, contagens de hábitos e ações, dias
ativos, volume registrado contra o alvo ("1.240 de 1.800 páginas"), etapas
fechadas, prazo restante e a lista do que saiu. Continuam desligados só os três
que carregam TEXTO escrito por ela — título do objetivo, área que ela criou e o
próprio nome — mais a frase do app.

Com o conteúdo escolhido pela pessoa, a pilha passou a poder estourar 1920px.
Cada bloco declara uma ordem de sacrifício (`drop`) e o renderizador corta o de
maior ordem até caber: lista antes da linha de apoio, linha de apoio antes do
momentum. Cortar é melhor que encolher — reduzir a fonte faria dois cards do
mesmo dia saírem com tipografias diferentes.

**Mais informação dentro do card, por escolha.** Além do número e da lista, o
card tem uma LINHA DE APOIO com sequência, área, avanço do objetivo
("42% → 58%") e as contagens de hábitos e ações. Ela é uma lista (`stats`), não
campos soltos: um dado novo passa a aparecer sem que nenhum template saiba o
que ele é, pelo mesmo motivo de `items` ser uma lista. Só a sequência nasce
ligada — é o dado que faz o card ser postado; o resto entra num toque.

E o painel passou a oferecer o que ESTE evento tem, não o que o tipo dele
suporta em tese (`availableFieldsForEvent`): hábito marcado sem cronômetro não
mostra "Duração", dia sem sequência não mostra "Sequência". Toggle que não muda
nada ensina a desconfiar dos outros.

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

**O card é do Story, e só.** Post 4:5 e quadrado saíram: feed é publicação
permanente, e card gerado por app no meio do perfil de alguém é o que ninguém
posta duas vezes. Com um formato só, o desenho é afinado pra ele em vez de
servir aos três pela metade — e o seletor de formato sumiu junto, porque
pergunta com uma resposta só não é escolha.

**Cor e arranjo são dimensões separadas.**

A COR são quatro: Preto, Neon (moldura acesa), Branco e PNG (sem fundo, alpha
real, pra ir sobre a foto da pessoa). O ARRANJO são seis: Destaque (número no
meio), Cartaz (número primeiro, texto no rodapé), Editorial (a frase manda e o
dado apoia), Tópicos (tudo em lista), Gráfico (anel de progresso e barras do
momentum) e Mapa (o assunto no centro, o resto em volta ligado por traços).

Separá-las foi o que evitou vinte e quatro templates: "cartaz claro" e "cartaz
escuro" seriam duas cópias que divergiriam na primeira correção. O tema descreve
só tinta, fundo e moldura; a composição descreve ordem dos blocos, alinhamento,
âncora, tamanho do número e se existe gráfico ou mapa. Nenhuma das duas é função
de desenho própria — o renderizador continua um só, e gráfico e mapa apenas
acrescentam um bloco à mesma pilha.

**A escolha do arranjo acontece no próprio card.** O preview é um carrossel:
arrasta pro lado e a mesma informação se reorganiza, em tamanho real, com o
desenho que vai sair no PNG. Os pontos abaixo são botões de verdade — deslizar
não funciona por teclado nem por leitor de tela, e um seletor que só existe no
gesto deixa de fora justamente quem mais precisa de alternativa. Sobre foto, a
cor sai de cena (branco com sombra) e o arranjo continua valendo inteiro.

O card também emagreceu. Saiu a barra de progresso (o "87%" já é a informação),
o selo do momentum virou uma linha sem caixa — moldura desenhada por cima da
foto de alguém é o que denuncia "isto saiu de um app" — e a frase do Momentumm
virou um toggle **desligado por padrão**. O card que a pessoa posta precisa
parecer dela, não o print de um dashboard.

**O produto é de celular.** O Share Studio nasceu mobile-first e é ali que ele é
afinado; o desktop tem o layout de duas colunas e funciona, mas não recebe
investimento novo.

Saída sempre em PNG 1080×1920. Compartilhamento pelo
share sheet nativo (Web Share API com arquivo) e download como saída quando ele
não existe — sem SDK de Instagram, TikTok ou WhatsApp. Analytics tem contrato e
ponto único de saída (`share-analytics`), com payload FECHADO: tipo, template e
formato, nunca conteúdo escrito pela pessoa.

Botões em `Hoje` (dia, rotina, retomada, momentum, conforme o que o dia
oferece), no detalhe do objetivo, no fim do review e nos insights. O estúdio mora
acima das páginas (`ShareStudioProvider`): cinco telas abrindo o mesmo modal, em
vez de cinco modais que divergem em dois meses.

As garantias dessa camada estão travadas em teste (`journey-invariants.test.ts`),
não só em comentário: todo tipo nasce privado, o gravador nem informa
visibilidade (quem decide é o default do domínio e o do banco), rodar de novo
não duplica, e todo tipo que o feed do círculo mostra é um tipo que alguém
grava. O custo de errar aqui não aparece hoje — aparece no dia em que mil
linhas gravadas com a visibilidade errada ficam visíveis pra outra pessoa, e aí
não há correção que desfaça o que já foi visto.

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

Nome, foto e bio se editam ali; @ e visibilidade padrão da ATIVIDADE continuam
em Configurações, que é onde moram os ajustes de conta.

A tela abre com a linha que resume a pessoa em números — momentum, objetivos
ativos, consistência em porcentagem e tempo de casa ("12 semanas no Momentumm")
—, e as conquistas têm um ícone por espécie: fogo pra sequência, alvo pra
objetivo, relógio pra foco. O mesmo troféu repetido seis vezes achatava
conquistas diferentes numa coisa só.

**Visibilidade do perfil (migration `0012`).** Três degraus — `privado`
(padrão), `amigos`, `publico` — e eles valem pro PERFIL, nunca pros momentos:
perfil público não torna público nada que a pessoa não marcou. A política
`using (true)` de `profiles`, que vinha da 0001 e deixava qualquer conta ler
nome, @, bio e foto de toda a base, foi substituída por dono + amigo aceito +
público + quem tem vínculo de amizade (aceito ou pendente — sem isso o pedido
chega como "alguém quer te adicionar", impossível de responder).

**A busca pelo @ EXATO continua achando todo mundo**, e isso é deliberado:
perfil nasce privado, e uma busca que respeitasse a visibilidade sem exceção
deixaria todo mundo invisível pra todo mundo — o Círculo nunca sairia do zero.
`find_profile_by_handle` é `security definer`, devolve só o cartão de visita
(id, nome, @, foto), compara por igualdade (nunca `like`) e tem revoke
explícito ao `anon`, pela lição da 0010. Busca PARCIAL, por nome, continua no
SELECT normal e enxerga só quem escolheu `publico`.

**A foto vive na coluna `avatar_url`**, reduzida a 256px e codificada como data
URL (~20KB) antes de sair do aparelho. Evita um bucket de Storage inteiro —
políticas, URL assinada, limpeza de órfão — por um arquivo que cada conta tem
UM. Quando existir foto de capa ou álbum, a migração é trocar o conteúdo da
coluna por um caminho, e nada acima muda.

Ainda **não existe** feed, amigos, seguidores, curtida, comentário, ranking nem
comunidade, e o perfil termina dizendo isso em voz alta: nada ali é público, e
compartilhar gera uma imagem no aparelho, não uma publicação.

### Círculo de amigos

A primeira camada social, e ela entra com o freio puxado.

**Amizade, não seguidor.** Uma linha por par, combinada dos dois lados. Duas
linhas espelhadas exigiriam escrever nas duas pra aceitar, e uma falha no meio
deixaria o par em desacordo consigo mesmo — A achando que são amigos e B não.
Seguidor traria junto o que o produto não quer: audiência, alcance e a pergunta
"quantos me seguem".

**Nada vaza por padrão.** Momento nasce `privada` e só sai daí por um toque em
"Só eu / No círculo", na lista de momentos do próprio perfil. Não existe
compartilhamento automático, nem "compartilhar tudo", nem preferência que decide
por antecipação. `setEventVisibility` é a única porta, e ela só é chamada por
esse botão.

**O feed é curado por regra, não por algoritmo.** `circle-feed` define os cinco
tipos que viram assunto entre amigos: rotina, objetivo (avanço e conclusão),
marco, review e retomada. Hábito e dia ficam de fora — cinco hábitos por dia
vezes dez amigos são cinquenta linhas diárias, e feed que enche é feed que
ninguém lê. A mesma lista decide o que PODE ser compartilhado: momento que não
apareceria no feed não oferece o botão.

**Momentum aparece como variação, nunca como pontuação.** "+7" no card, jamais
"84". O score é a comparação da pessoa com ela mesma; exibi-lo absoluto num feed
monta a tabela de classificação que o produto recusa, mesmo sem nunca chamar de
tabela. Pelo mesmo motivo o perfil do amigo mostra só os momentos que ele
compartilhou — sem objetivos, hábitos, notas, constância ou score.

**Um gesto só: apoio.** Curtida com seis emojis vira métrica de popularidade, e
popularidade entre pessoas tentando mudar de vida é o começo do ranking. Uma
reação, sem notificação e sem contagem em perfil.

Migration `0009_circle.sql`: `friendships` com índice único por par
(least/greatest, senão A→B e B→A seriam duas amizades entre as mesmas duas
pessoas), RLS que só deixa o destinatário aceitar, `journey_event_supports`, e
uma política ADICIONAL de leitura em `journey_events` pra `visibility = 'amigos'`
com amizade aceita. A checagem passa por `are_friends`, uma função
`security definer` com `search_path` fixo: sem ela, a política de uma tabela
consultaria a RLS da outra, o que custa caro e abre porta pra recursão.

`comunidade` e `publica` seguem sem leitor nenhum — alcance que ninguém
consegue conferir na interface é alcance que não deveria existir no banco.

Migration `0010_are_friends_anon.sql`: o Supabase mantém DEFAULT PRIVILEGES
concedendo EXECUTE em toda função nova do schema `public` pros papéis `anon` e
`authenticated`, direto ao papel — então o `revoke ... from public` da 0009 não
alcançava. `are_friends` nasceu chamável sem login. Como `profiles` é legível
por qualquer um desde a 0001, dava pra listar os ids de todo mundo e perguntar,
par a par, quem é amigo de quem. **Toda função `security definer` neste projeto
precisa de um revoke explícito ao `anon`.**

No modo demo existem três pessoas de fábrica (dois amigos aceitos e um pedido
esperando resposta): o Círculo só dá pra conferir com os olhos se houver com
quem tê-lo.

**Não implementado:** comentário, seguidor, comunidade pública, grupo e chat.

### Desafios entre amigos

A segunda camada social, e ela herda o freio da primeira: desafio é privado por
definição, o convite sai só do dono e só pra quem já é amigo dele no Círculo.

**A unidade do desafio é o DIA CUMPRIDO.** Três modos que contam a mesma coisa
e diferem só no que exigem dela: `diaria` (todo dia da janela), `semanal` (X
dias por semana, sem dia marcado) e `total` (X dias ao longo da janela, quando
não importa quais). Contar volume acumulado seria a quarta forma, e ela já
existe: chama-se objetivo. O desafio é sobre APARECER, e é por isso que ele
funciona entre pessoas cujas metas são diferentes — 30 minutos dela e 1h dele
fecham o mesmo dia.

**O desafio não guarda progresso por dia.** Quem move o progresso continua
sendo a atividade — ou o hábito que a pessoa vinculou. `doneDaysOf` é uma
função pura sobre o que ela já registrou: com hábito vinculado, o dia fecha
quando o hábito é marcado (a versão mínima conta, como em todo o resto); sem
hábito, quando o volume do eixo alcança `dailyTarget`. O hábito vem primeiro
porque é o que já existe na rotina — desafio que obriga a registrar de novo o
que ela registrou hoje de manhã morre na segunda semana.

**`done_days` é o único número que atravessa a fronteira entre duas pessoas.**
Ele é materializado em `challenge_participants` porque o progresso de alguém
sai de hábitos e atividades que a RLS não deixa mais ninguém ler — e nem
deveria. Entrar num desafio é consentir em mostrar quantos dias você fechou
NELE, e nada além: nem o hábito, nem o volume, nem o momentum. Quem escreve é
sempre o dono da linha; o cliente recalcula, compara e só publica quando os dois
divergem.

**Ranking existe, e só dentro do desafio.** Ordena por dia cumprido, que é o que
as duas pessoas combinaram — nunca por Momentum, constância ou volume. Empate
mantém a mesma posição: desempatar por horário premiaria quem acordou cedo. E
os eventos de desafio saem SEM momentum de propósito, ao contrário de todos os
outros: pendurar o score pessoal num card que vem acompanhado de uma lista de
participantes monta exatamente a comparação entre pessoas que o produto recusa.

`challenge-recorder` é o gravador, no mesmo molde do `journey-recorder`: função
pura, recebe o estado mais o que já foi gravado, devolve só o que falta. Entrada,
marco (25/50/75%) e conclusão são eventos de VIDA; avanço é de DIA, no máximo um
por dia por desafio. Marco cruzado hoje CALA o avanço do mesmo dia — a versão
menor da mesma frase, lado a lado no feed, seria a mesma notícia duas vezes.

Os quatro tipos entram no `circle-feed` inteiros, inclusive o avanço. A regra que
barrou hábito e dia não vale aqui: eles são automáticos e acontecem cinco vezes
por dia, enquanto o avanço no desafio é um por dia por desafio, e num combinado
entre gente que topou aparecer junto. E como todo evento, ele nasce `privada`:
o feed só recebe o que a pessoa marcar.

Migration `0011_challenges.sql`: `challenges` e `challenge_participants` com
RLS, mais `is_challenge_member` e `owns_challenge` — as duas `security definer`
com `search_path` fixo e revoke explícito ao `anon`, seguindo a lição da 0010. A
política de convite exige as duas condições juntas (é o dono E é amigo dele):
sem a primeira, um participante encheria o desafio de gente que ninguém chamou;
sem a segunda, o convite viraria a porta dos fundos do Círculo. Os quatro
valores novos do enum de evento entram aditivos e não são usados na mesma
migration, que é a condição pra `add value` conviver com a transação do CLI.

No modo demo o desafio vem de fábrica com as duas amigas dentro — diferente dos
momentos, e por um motivo que não vale pros outros: desafio é a única parte do
produto que não dá pra conferir sozinho.

Rotas: `/app/desafios` e `/app/desafios/:id`. Ele fica FORA da navegação
principal, ao contrário do Círculo: o desafio acontece no dia comum, pelo hábito
que a pessoa já cumpre, e a tela existe pra combinar, conferir e encerrar.

**Não implementado de propósito:** desafio público, descoberta, comunidade,
grupo, chat, premiação e ranking global.

### Momentumm AI de verdade

A IA deixou de ser só simulada. A porta (`domain/ai/ai-service`) é a mesma;
o que mudou é quem responde por ela:

- **Modo demo:** `SimulatedAiService`, regras fixas, avisada na tela.
- **Com Supabase:** `SupabaseAiService` → Edge Function `momentumm-ai`
  (`supabase/functions/momentumm-ai`). A chave da Anthropic mora só no
  segredo da função. Deploy e segredos em `supabase/functions/README.md`.

**Todo pedido carrega o contexto inteiro da conta** (`domain/ai/ai-context`,
`buildAiContext`, puro e testado): objetivos com etapas, gargalo, próxima ação
e previsão; hábitos com constância e estado de hoje; ações do dia e atrasadas;
os três últimos reviews escritos; vitórias recentes; o score aberto em
fatores; a capacidade do check-in; as ações pendentes dos próximos 7 dias.
Um contexto só, montado no `use-ai`, pra todos os pedidos, senão duas telas
recebem leituras que se contradizem. Nenhum id atravessa a fronteira: a IA
responde por posição (`stepIndex`) e por REF — apelido curto (`a1`, `o2`,
`h1`) que `buildAiContextBundle` atribui e traduz de volta pra id do lado do
app (`AiRefs`). Ref inventado não bate com nada e a linha aparece bloqueada,
com o motivo, em vez de virar escrita. Não saem: e-mail, nome, observação do
check-in, dados de amigos.

**Cinco portas contextuais, nenhum chat** (`presentation/ai/`). Cada uma
devolve estrutura acionável e nada é gravado sem confirmação:

- Objetivos → **Criar plano com IA** (`/app/ia?funcao=plano`, kind `plan`):
  etapas, hábitos e ações, prévia editável
- Hoje → **Reorganizar meu dia** (`AiDayDialog`, kind `day`): o menor conjunto
  de ajustes que faz o dia caber no tempo declarado
- Progresso → **Interpretar meu momento** (`AiProgressPanel`, kind
  `progress`): padrões, gargalos, sobrecarga, objetivos parados, e `proposals`
  aplicáveis
- Review semanal → **Preparar minha revisão** (`AiReviewDraftPanel`, kind
  `review_draft`): as quatro respostas e as prioridades pré-escritas pelos
  dados, na primeira pessoa, preservando o que ela já escreveu
- Modo Retomada → **Criar plano de retorno** (`AiRecoveryDialog`, kind
  `recovery`): leitura sem culpa, até três passos pequenos, hábitos a manter
  na mínima

**Todo ajuste é um `AiAdjustment`** (`domain/ai/ai-service`), tipo fechado com
ref e `reason` obrigatório: `move_action`, `shrink_action`, `set_minutes`,
`set_main_priority`, `extend_deadline`, `change_habit_frequency`,
`create_action`. `AiProposals` mostra cada um com aceitar / editar (data,
minutos) / rejeitar e um único botão de aplicar; `use-ai-adjustments` executa
pelas MESMAS funções do provider (a IA não tem caminho próprio pro banco), um
por vez, e devolve o que entrou e o que falhou com o motivo. Os limites do
plano valem igual: `create_action` acima de 5 ações no dia é recusado.

**Freio no cliente** (`useAiCall`): uma chamada por vez e 8s entre duas do
mesmo tipo. A IA só existe no PRO (`limits.ai`): sem ela os botões viram o
convite (`AiEntry`), e a função responde `plan_required`.

**Prompt, formato de saída e validação vivem num lugar só**
(`domain/ai/ai-prompts`), importado pelo app e pela função (import map em
`deno.json` mapeia `@/` pra `src/`). A resposta é validada com zod nos DOIS
lados; ícone, frequência ou prioridade fora do domínio falham antes de virar
prévia. O modelo padrão é `claude-opus-5` (`MOMENTUMM_AI_MODEL` troca), com
saída estruturada (`output_config.format`) e effort `medium`.

**Franquia mensal no servidor** (`PLAN_LIMITS[tier].aiCallsPerMonth`: 0 no
gratuito, 150 no PRO), contada em `ai_calls` (migrations 0016 e 0019, esta
com os seis kinds), que só a função grava com service role. A resposta traz
`usage` e o app mostra "3 de 150 leituras este mês". Sem política de insert pra API pública, pela mesma
regra de `audit_logs`. `profiles.plan` é lido com service role: é a fonte que
o cliente não consegue forjar.

**Erros com código** (`domain/ai/ai-error`): `not_configured`,
`plan_required`, `quota_exceeded`, `model_unavailable`, `invalid_output`,
`unauthorized`, `invalid_request`. `AiErrorNote` mostra a mensagem e oferece o
PRO só em `plan_required` e na cota fora do PRO. Função ausente chega ao navegador como falha de CORS
(`FunctionsFetchError`), e a mensagem cobre as duas leituras possíveis.

### Sincronização

O provider recarrega em silêncio (`reload({ silent: true })`, dados atuais na
tela, sem esqueleto) ao voltar a ficar online e ao voltar pra aba depois de
um minuto parado (`RESYNC_AFTER_MS`). `syncing` sai no contexto e vira uma
linha fina no topo. Não existe Realtime: a escrita continua otimista com
rollback, e a releitura é o que traz o que foi marcado em outro aparelho.

**Testado com conta real** (10/09/2026, auto-confirm ligado no projeto):
cadastro pela tela → onboarding → objetivo com três etapas em `plan_stages`
→ ações em `Hoje` → concluir → Momentum 0 → 49 → Progresso com número →
review da semana anterior com aviso de "sem registro" → os três pedidos da
IA saindo com JWT e contexto completo (função interceptada no teste, porque
ela ainda não estava implantada) → plano da IA salvo com etapas de verdade.
O que o teste achou e foi corrigido: Progresso ignorava ação concluída no
empty state, "Voltei hoje" no primeiro dia de conta, e `delete_my_account`
quebrado porque o Supabase passou a recusar delete em `storage.objects`
(migration 0017 + cliente apaga a pasta pela Storage API).
### A jornada principal

O produto é um ciclo de três telas, nessa ordem:

**1. Onboarding — ativação rápida** (`activation`, `Activation.tsx`). Quatro
perguntas e um plano:

1. **O que você quer mudar?** — a área da VIDA (saúde, carreira, estudos,
   projeto, finanças, pessoal, outra), não o eixo do app. Ninguém acorda
   querendo "meditação": quer dormir melhor, quer sair do emprego
2. **O que você quer alcançar?** — texto livre, com as palavras dela
3. **Quando?** — prazo flexível, preset ou data definida
4. **Quanto tempo, de verdade?** — horas por dia OU por semana, mais os dias da
   semana disponíveis (que viram os `weekdays` do hábito, em vez do palpite que
   o gerador fazia)

A área vira eixo: `estudos` reaproveita o `estudo` de fábrica, e o resto cria
uma linha em `activity_types` com o nome que a pessoa escolheu — a promessa da
arquitetura desde o primeiro commit. **O eixo só é criado ao salvar**, nunca no
passo 1: senão cada pessoa que desistisse no meio deixaria uma área órfã no
filtro do histórico. A prévia inteira funciona antes disso porque
`PlanInput.axisLabel` carrega o nome — sem ele o hábito nascia "Dedicar tempo a
financas", com cara de identificador.

**O alvo sai do que a pessoa escreveu, quando ela escreveu um número.**
`readGoalQuantity` lê horas, minutos e páginas, e separa total de ritmo
("30 min por dia" é ritmo: tratar como alvo daria um objetivo de meia hora pra
três meses). "Ler 6 livros" NÃO vira 1500 páginas — converter livro em página é
chutar a espessura do livro dela. Sem número reconhecível, o alvo sai do ritmo
que o eixo sustenta (`comfortableSessionOf`), e a tela diz de onde veio.

**Ambição contra disponibilidade, antes de salvar.** A comparação é semanal —
é onde a frequência vive — e a frase é fixa: *"Seu plano exige aproximadamente
5h40, mas sua disponibilidade é de 2h. Vamos reorganizar?"*, seguida da base da
conta. Quando não fecha, `ready` é falso e o CTA não existe: as saídas ocupam o
lugar dele, cada uma **recalculada pelo mesmo gerador antes de virar botão** —
reduzir as ações, ajustar a frequência, ampliar o prazo ou revisar
manualmente. Opção que promete resolver e não resolve é pior que opção nenhuma,
então só entra na lista a que de fato faz o plano caber. **Plano impossível não
é gerado nem como rascunho.**

O último passo fecha com *"Seu plano está pronto. Você não precisa resolver o
objetivo inteiro hoje. Seu próximo passo é este."* e o CTA **Começar meu
Momentum**, que grava tudo de uma vez por `applyPlan`: objetivo, meta semanal,
os três marcos, o hábito e as ações — inclusive a de hoje, já como prioridade
principal.

**Dá pra pular e retomar.** "Deixar pra depois" guarda passo e respostas no
`localStorage` (é formulário pela metade, não dado de negócio) e o dashboard
mostra o `ResumeActivationCard` enquanto a conta não tiver nada criado. Fechar
a aba no terceiro passo e voltar dois dias depois cai no terceiro passo.

O **tempo vem por último** de propósito: perguntado antes do objetivo ele vira
promessa abstrata; perguntado depois, vira o filtro de realidade que decide o
tamanho do plano.

O `ObjectiveDialog` continua no fluxo antigo (`use-journey-draft`, por eixo):
ele serve a quem já está dentro do app e conhece o vocabulário.

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

- Barra inferior com cinco lugares (Hoje, Objetivos, +, Plano, Perfil). O resto
  (Hábitos, Progresso, Review, IA, Círculo, Foco, Metas, Jornada, Insights,
  Configurações) chega pelos atalhos do Perfil e pelos links do Hoje. `TAB_ROUTES`
  em `MobileTabBar` é a fonte: o topo e os atalhos leem dela
- O topo cumprimenta só em `Hoje`. Nas outras telas fica a marca, e quando a
  tela não está na barra (ou é um detalhe) aparece o "voltar": histórico do
  app quando existe, senão a tela pai
- Trocar de rota volta pro topo (`ScrollToHash` no `App`): o router não mexe na
  rolagem, e "Ver todos" no fim de Hoje abria Hábitos já rolado
- Diálogo e bottom sheet levam o foco pro primeiro campo (`use-focus-trap`), não
  pro botão de fechar
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
- Limite de plano vira `PlanLimitDialog` contextual (o `Dialog` sobe como folha no celular), jamais pop-up ao abrir o app

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
npm test        # 642 testes
npm run build
```
