import type { ActivityTypeSlug } from './activity-type'
import type { DayPart, HabitFrequency, HabitIcon } from './habit'
import type { TaskEffort } from './task'

/**
 * Os roteiros por ASSUNTO.
 *
 * O gerador de plano (`plan-builder`) sabe fazer aritmética: alvo dividido por
 * sessões, sessão contra o tempo declarado, data proporcional ao peso. O que
 * ele nunca soube é o que um objetivo PEDE — e é por isso que "emagrecer"
 * recebia "fazer o primeiro treino, separar a roupa, avaliar a carga", que é o
 * roteiro de qualquer objetivo de treino, não o de emagrecer.
 *
 * Aqui mora a outra metade: o que o assunto exige, em etapas, hábitos e ações
 * concretas. A aritmética continua sendo quem dimensiona tudo — o roteiro diz
 * O QUE, o construtor diz QUANTO e QUANDO, dentro do tempo que a pessoa
 * declarou.
 *
 * ## Três regras, e a primeira é a que mais importa
 *
 * 1. **Nada de prescrição de saúde.** Nenhum roteiro diz quantas calorias
 *    cortar, que dieta seguir, que carga levantar ou quantas horas dormir como
 *    meta clínica. O que ele organiza é COMPORTAMENTO: aparecer, registrar,
 *    medir, rever. A mesma regra que o prompt da IA já carrega ("nenhum
 *    diagnóstico médico ou psicológico") vale aqui, e vale mais, porque isto
 *    aqui é conteúdo escrito por nós e não saída de modelo.
 *
 * 2. **Casar errado é pior que não casar.** A detecção é conservadora: exige
 *    palavra específica do assunto, não palavra que aparece em qualquer
 *    objetivo. Sem casamento claro, o plano genérico continua valendo, e ele
 *    não é ruim, é só genérico. Um roteiro de corrida montado pra quem quer
 *    "correr atrás do prejuízo" é o tipo de erro que faz a pessoa desinstalar.
 *
 * 3. **O roteiro não inventa número.** Ele traz proporções e frequências
 *    (3x por semana, 5 minutos pra registrar), nunca o alvo da pessoa nem o
 *    prazo. Quem decide esses dois é ela, e quem os distribui é a aritmética.
 *
 * ## Por que uma biblioteca, e não só a IA
 *
 * A IA cobre qualquer assunto e é a resposta pro que não está aqui. Mas ela
 * custa uma chamada, depende de rede e devolve um plano diferente a cada vez
 * que roda, o que quebra a promessa de "o mesmo pedido gera o mesmo plano, e a
 * pessoa confere a matemática na tela". A biblioteca é o chão: de graça,
 * offline, igual toda vez, e cobre o que a maioria das pessoas realmente
 * escreve no campo de objetivo.
 */

/** Quando a ação acontece, em fração do caminho. A data sai disso. */
export type BlueprintWhen = 'hoje' | 'primeira-semana' | 'meio' | 'reta-final'

export interface BlueprintStage {
  readonly title: string
  readonly description: string
  /** Quanto vale do objetivo. O conjunto soma 100, como o domínio exige. */
  readonly weight: number
}

export interface BlueprintHabit {
  readonly name: string
  readonly icon: HabitIcon
  readonly frequency: HabitFrequency
  readonly timesPerWeek: number
  readonly dayPart: DayPart
  /**
   * A fatia do tempo diário que este hábito ocupa, de 0 a 1.
   *
   * Fração e não minutos: quem tem 20 minutos por dia e quem tem 90 recebem o
   * mesmo roteiro, dimensionado pra cada um. Um roteiro com "45 minutos" fixo
   * seria um plano que só serve pra quem tem 45.
   *
   * As frações dos hábitos de DURAÇÃO de um roteiro somam 1: elas dividem
   * entre si o que sobrou do dia depois dos gestos.
   */
  readonly share?: number
  /** O piso, em fração do próprio hábito. É a versão que segura o dia ruim. */
  readonly minimalShare?: number
  /**
   * Minutos fixos, pro hábito que é um GESTO e não uma sessão.
   *
   * "Beber água ao acordar" e "Anotar as cargas" não duram mais porque a
   * pessoa tem mais tempo livre: eles são feitos ou não são. Escalá-los pelo
   * orçamento produzia números sem sentido ("revisar 6 minutos", "beber água
   * 9 minutos") e roubava do hábito que realmente ocupa o dia.
   */
  readonly fixedMinutes?: number
  /** O piso do gesto, em minutos. Costuma ser o próprio: gesto é feito ou não. */
  readonly minimalMinutes?: number
  /** Por que ele existe. Vira a descrição do hábito, e ela é cobrada na tela. */
  readonly rationale: string
}

export interface BlueprintTask {
  readonly title: string
  readonly minimalVersion: string
  readonly estimatedMin: number
  readonly effort: TaskEffort
  readonly stageIndex: number
  readonly when: BlueprintWhen
}

export interface PlanBlueprint {
  readonly key: string
  /** Como o plano se apresenta: "Plano de emagrecimento". */
  readonly label: string
  /**
   * O que faz o roteiro casar. Específico de propósito: "peso" sozinho casaria
   * com "levantar mais peso", que é outro assunto inteiro.
   */
  readonly match: readonly RegExp[]
  /** Eixos em que ele faz sentido. Vazio aceita qualquer um. */
  readonly axes: readonly ActivityTypeSlug[]
  readonly stages: readonly BlueprintStage[]
  readonly habits: readonly BlueprintHabit[]
  readonly tasks: readonly BlueprintTask[]
  /** A frase que explica o desenho. Entra na prévia, acima das etapas. */
  readonly rationale: string
  /**
   * O limite do que o app faz, dito em voz alta.
   *
   * Existe nos assuntos onde a pessoa pode esperar do Momentumm uma coisa que
   * ele não é: nutricionista, médico, terapeuta, professor. Dizer isso na
   * prévia é mais honesto do que descobrir no meio do plano.
   */
  readonly caution?: string
}

// ---------------------------------------------------------------------------
// a biblioteca
// ---------------------------------------------------------------------------

/**
 * Três etapas é o desenho mínimo de qualquer caminho (começo, meio, fim), e os
 * roteiros abaixo respeitam isso quando o assunto não pede mais. O que muda é
 * o CONTEÚDO: "Montar a linha de base" é um degrau que significa alguma coisa
 * pra quem quer emagrecer; "Entrar no ritmo" significa a mesma coisa pra
 * qualquer objetivo do mundo, que é o mesmo que não significar nada.
 */
export const PLAN_BLUEPRINTS: readonly PlanBlueprint[] = [
  {
    key: 'emagrecer',
    label: 'Plano de emagrecimento',
    match: [/emagrec/, /perder\s+(peso|barriga|gordura)/, /secar/, /queimar\s+gordura/],
    axes: [],
    rationale:
      'Emagrecer não é um treino, é uma semana inteira funcionando: o que você faz, o que você come e o que você mede. O plano organiza os três, e mede o progresso por semana, não por dia.',
    caution:
      'O Momentumm organiza a rotina, não prescreve dieta nem treino. Pra o que comer e quanto treinar, procura um nutricionista e um profissional de educação física.',
    stages: [
      {
        title: 'Saber de onde você parte',
        description:
          'Peso, medidas e uma semana registrada do jeito que ela já é hoje. Sem ponto de partida, não existe progresso, existe sensação.',
        weight: 15,
      },
      {
        title: 'Fazer a semana existir',
        description:
          'Os treinos acontecendo nos dias combinados e as refeições sendo registradas, mesmo na versão curta. Aqui a meta é frequência, não intensidade.',
        weight: 45,
      },
      {
        title: 'Sustentar e corrigir',
        description:
          'Manter o ritmo por semanas seguidas e ajustar o que os registros mostrarem. É a etapa mais longa porque é a que muda o número.',
        weight: 40,
      },
    ],
    habits: [
      {
        name: 'Treinar',
        icon: 'halter',
        frequency: 'vezes-semana',
        timesPerWeek: 3,
        dayPart: 'qualquer',
        share: 1.0,
        minimalShare: 0.35,
        rationale: 'Três vezes por semana é o que cabe numa vida comum e ainda muda o corpo.',
      },
      {
        name: 'Registrar o que comi',
        icon: 'caneta',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'noite',
        fixedMinutes: 5,
        minimalMinutes: 3,
        rationale:
          'Registrar não é controlar: é o único jeito de a semana seguinte ser decidida por dado e não por memória.',
      },
      {
        name: 'Beber água ao acordar',
        icon: 'agua',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'manha',
        fixedMinutes: 3,
        minimalMinutes: 3,
        rationale: 'O hábito mais barato da lista, e o que ancora os outros dois no começo do dia.',
      },
    ],
    tasks: [
      {
        title: 'Pesar e tirar as fotos do primeiro dia',
        minimalVersion: 'Só pesar e anotar o número',
        estimatedMin: 10,
        effort: 'leve',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Escolher os dias e os horários fixos do treino',
        minimalVersion: 'Marcar um dia só, o da próxima semana',
        estimatedMin: 10,
        effort: 'leve',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Montar a lista de compras da semana',
        minimalVersion: 'Listar cinco coisas que precisam entrar em casa',
        estimatedMin: 20,
        effort: 'medio',
        stageIndex: 0,
        when: 'primeira-semana',
      },
      {
        title: 'Deixar as refeições da semana preparadas',
        minimalVersion: 'Preparar só as de amanhã',
        estimatedMin: 45,
        effort: 'pesado',
        stageIndex: 1,
        when: 'primeira-semana',
      },
      {
        title: 'Pesar de novo e comparar com o primeiro dia',
        minimalVersion: 'Só pesar e anotar',
        estimatedMin: 10,
        effort: 'leve',
        stageIndex: 1,
        when: 'meio',
      },
      {
        title: 'Rever o que funcionou e ajustar a semana',
        minimalVersion: 'Anotar uma coisa que vai mudar',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 2,
        when: 'reta-final',
      },
    ],
  },

  {
    key: 'massa',
    label: 'Plano de ganho de massa',
    match: [/ganhar\s+(massa|m[uú]sculo|peso)/, /hipertrofia/, /ficar\s+(mais\s+)?forte/, /bulking/],
    axes: [],
    rationale:
      'Massa vem de treino repetido com carga que sobe e de comer o suficiente pra sustentar isso. O plano cuida da frequência e do registro; a carga e o prato são com quem entende.',
    caution:
      'O Momentumm organiza a rotina, não monta treino nem dieta. Pra a progressão de carga e o que comer, procura um profissional.',
    stages: [
      {
        title: 'Montar a base',
        description:
          'Medidas, fotos e o treino escolhido. Sem saber a carga de hoje, não dá pra saber se ela subiu.',
        weight: 15,
      },
      {
        title: 'Frequência antes de carga',
        description:
          'Aparecer nos dias combinados por algumas semanas. Carga que sobe sem frequência é lesão esperando acontecer.',
        weight: 40,
      },
      {
        title: 'Fazer a carga subir',
        description:
          'Com a rotina de pé, o assunto passa a ser progressão: registrar o que levantou e subir quando der.',
        weight: 45,
      },
    ],
    habits: [
      {
        name: 'Treinar',
        icon: 'halter',
        frequency: 'vezes-semana',
        timesPerWeek: 4,
        dayPart: 'qualquer',
        share: 1.0,
        minimalShare: 0.35,
        rationale: 'Quatro vezes por semana é o que a maioria dos programas de força pede.',
      },
      {
        name: 'Anotar as cargas do treino',
        icon: 'caneta',
        frequency: 'vezes-semana',
        timesPerWeek: 4,
        dayPart: 'qualquer',
        fixedMinutes: 5,
        minimalMinutes: 3,
        rationale: 'Sem o registro da carga anterior, a progressão vira palpite.',
      },
      {
        name: 'Fazer a refeição depois do treino',
        icon: 'agua',
        frequency: 'vezes-semana',
        timesPerWeek: 4,
        dayPart: 'qualquer',
        fixedMinutes: 10,
        minimalMinutes: 5,
        rationale: 'É a refeição que a pressa costuma comer, e a que sustenta o treino que você fez.',
      },
    ],
    tasks: [
      {
        title: 'Medir, pesar e tirar as fotos do primeiro dia',
        minimalVersion: 'Só pesar e anotar',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Escolher o programa de treino e os dias fixos',
        minimalVersion: 'Definir só quantos dias por semana',
        estimatedMin: 20,
        effort: 'medio',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Montar a planilha de cargas',
        minimalVersion: 'Anotar os exercícios numa lista',
        estimatedMin: 20,
        effort: 'medio',
        stageIndex: 1,
        when: 'primeira-semana',
      },
      {
        title: 'Conferir as cargas contra a primeira semana',
        minimalVersion: 'Olhar dois exercícios e comparar',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 2,
        when: 'meio',
      },
      {
        title: 'Medir de novo e comparar com o primeiro dia',
        minimalVersion: 'Só pesar e anotar',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 2,
        when: 'reta-final',
      },
    ],
  },

  {
    key: 'corrida',
    label: 'Plano de corrida',
    match: [/correr/, /corrida/, /\b\d+\s?k\b/, /maratona/, /5\s?km|10\s?km|21\s?km/],
    axes: [],
    rationale:
      'Correr é volume que sobe devagar. O plano protege o começo (onde a maior parte das pessoas se machuca e para) e só depois aumenta a distância.',
    caution: 'Dor não é progresso. Se aparecer, o plano espera e você procura um profissional.',
    stages: [
      {
        title: 'Sair da porta',
        description:
          'As primeiras semanas são sobre aparecer, não sobre distância. Caminhar e correr alternado conta.',
        weight: 20,
      },
      {
        title: 'Aguentar o tempo',
        description:
          'Correr sem parar pelo tempo que o teu plano pede, mesmo devagar. Ritmo vem depois.',
        weight: 40,
      },
      {
        title: 'Chegar na distância',
        description: 'Com a base de pé, a distância sobe até o alvo, com uma semana mais leve antes do fim.',
        weight: 40,
      },
    ],
    habits: [
      {
        name: 'Correr',
        icon: 'halter',
        frequency: 'vezes-semana',
        timesPerWeek: 3,
        dayPart: 'manha',
        share: 1.0,
        minimalShare: 0.3,
        rationale: 'Três saídas por semana com um dia de descanso entre elas é o desenho clássico.',
      },
      {
        name: 'Alongar depois de correr',
        icon: 'lotus',
        frequency: 'vezes-semana',
        timesPerWeek: 3,
        dayPart: 'qualquer',
        fixedMinutes: 10,
        minimalMinutes: 5,
        rationale: 'É o que a pressa corta primeiro, e o que costuma segurar a lesão.',
      },
    ],
    tasks: [
      {
        title: 'Fazer a primeira saída, alternando caminhada e corrida',
        minimalVersion: 'Caminhar 10 minutos, só pra começar',
        estimatedMin: 30,
        effort: 'medio',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Escolher o percurso e os dias fixos',
        minimalVersion: 'Definir o dia da próxima saída',
        estimatedMin: 10,
        effort: 'leve',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Conferir o tênis e trocar se estiver gasto',
        minimalVersion: 'Olhar a sola e decidir',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 0,
        when: 'primeira-semana',
      },
      {
        title: 'Fazer a saída mais longa da primeira metade',
        minimalVersion: 'Fazer a saída normal mesmo',
        estimatedMin: 45,
        effort: 'pesado',
        stageIndex: 1,
        when: 'meio',
      },
      {
        title: 'Fazer uma semana mais leve antes de fechar',
        minimalVersion: 'Cortar uma saída da semana',
        estimatedMin: 20,
        effort: 'leve',
        stageIndex: 2,
        when: 'reta-final',
      },
    ],
  },

  {
    key: 'concurso',
    label: 'Plano de estudo para prova',
    match: [/concurso/, /vestibular/, /\benem\b/, /\boab\b/, /passar\s+na\s+prova/, /prova\s+d[eo]\b/, /certifica[çc][ãa]o/],
    axes: [],
    rationale:
      'Prova se ganha em revisão, não em leitura. O plano separa o conteúdo novo do que precisa voltar, e cobra questão desde a primeira semana.',
    stages: [
      {
        title: 'Mapear o edital',
        description:
          'Saber o que cai, quanto cai de cada coisa e onde você está hoje. Estudar sem esse mapa é estudar o que é mais gostoso.',
        weight: 15,
      },
      {
        title: 'Passar pelo conteúdo',
        description:
          'Cobrir os assuntos na ordem do peso deles na prova, resolvendo questão do mesmo assunto no mesmo dia.',
        weight: 45,
      },
      {
        title: 'Revisar e simular',
        description:
          'Revisão do que já passou e prova inteira cronometrada. É aqui que a nota sobe de verdade.',
        weight: 40,
      },
    ],
    habits: [
      {
        name: 'Estudar o conteúdo do dia',
        icon: 'cerebro',
        frequency: 'vezes-semana',
        timesPerWeek: 5,
        dayPart: 'qualquer',
        share: 0.65,
        minimalShare: 0.3,
        rationale: 'Cinco dias por semana deixa dois pra vida acontecer sem quebrar a sequência.',
      },
      {
        name: 'Resolver questões',
        icon: 'caneta',
        frequency: 'vezes-semana',
        timesPerWeek: 5,
        dayPart: 'qualquer',
        share: 0.35,
        minimalShare: 0.3,
        rationale: 'Questão no mesmo dia do conteúdo é o que transforma leitura em memória.',
      },
      {
        name: 'Revisar o que já passou',
        icon: 'livro',
        frequency: 'vezes-semana',
        timesPerWeek: 3,
        dayPart: 'qualquer',
        fixedMinutes: 15,
        minimalMinutes: 5,
        rationale: 'Sem revisão espaçada, o que você estudou em março não existe mais em junho.',
      },
    ],
    tasks: [
      {
        title: 'Ler o edital e listar os assuntos por peso',
        minimalVersion: 'Listar as três matérias que mais caem',
        estimatedMin: 45,
        effort: 'medio',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Fazer um diagnóstico: 20 questões variadas',
        minimalVersion: 'Fazer 5 questões',
        estimatedMin: 40,
        effort: 'medio',
        stageIndex: 0,
        when: 'primeira-semana',
      },
      {
        title: 'Montar o cronograma por matéria',
        minimalVersion: 'Definir a ordem das três primeiras',
        estimatedMin: 30,
        effort: 'medio',
        stageIndex: 0,
        when: 'primeira-semana',
      },
      {
        title: 'Fazer o primeiro simulado cronometrado',
        minimalVersion: 'Fazer meia prova',
        estimatedMin: 120,
        effort: 'pesado',
        stageIndex: 1,
        when: 'meio',
      },
      {
        title: 'Refazer as questões que você errou',
        minimalVersion: 'Refazer cinco erros',
        estimatedMin: 45,
        effort: 'medio',
        stageIndex: 2,
        when: 'reta-final',
      },
      {
        title: 'Fazer o simulado final na hora da prova real',
        minimalVersion: 'Fazer meia prova no mesmo horário',
        estimatedMin: 180,
        effort: 'pesado',
        stageIndex: 2,
        when: 'reta-final',
      },
    ],
  },

  {
    key: 'idioma',
    label: 'Plano de idioma',
    match: [/ingl[êe]s/, /espanhol/, /franc[êe]s/, /alem[ãa]o/, /italiano/, /idioma/, /fluen/],
    axes: [],
    rationale:
      'Idioma trava na fala, não no conteúdo. O plano põe escuta e fala desde a primeira semana, em vez de deixar as duas pro dia em que você "estiver pronta".',
    stages: [
      {
        title: 'Entrar em contato todo dia',
        description:
          'Pouco e diário ganha de muito e às vezes. Aqui a meta é não passar um dia sem ouvir ou ler no idioma.',
        weight: 20,
      },
      {
        title: 'Começar a produzir',
        description:
          'Sair do consumo: escrever frases, falar sozinha, responder em voz alta. É desconfortável e é onde a fluência começa.',
        weight: 40,
      },
      {
        title: 'Usar com gente de verdade',
        description: 'Conversa com outra pessoa, mesmo errando. Nenhum aplicativo substitui esta etapa.',
        weight: 40,
      },
    ],
    habits: [
      {
        name: 'Estudar o idioma',
        icon: 'cerebro',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'qualquer',
        share: 0.5,
        minimalShare: 0.25,
        rationale: 'Diário e curto: a língua entra por repetição, não por maratona de fim de semana.',
      },
      {
        name: 'Ouvir no idioma',
        icon: 'livro',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'qualquer',
        share: 0.35,
        minimalShare: 0.3,
        rationale: 'Ouvido treinado é o que faz a conversa deixar de ser um susto.',
      },
      {
        name: 'Falar em voz alta',
        icon: 'caneta',
        frequency: 'vezes-semana',
        timesPerWeek: 4,
        dayPart: 'qualquer',
        share: 0.15,
        minimalShare: 0.4,
        rationale: 'Falar sozinha parece bobo e é o que destrava a boca antes da primeira conversa.',
      },
    ],
    tasks: [
      {
        title: 'Escolher o material principal e começar a primeira lição',
        minimalVersion: 'Só escolher o material',
        estimatedMin: 30,
        effort: 'medio',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Montar a lista do que ouvir no caminho',
        minimalVersion: 'Salvar um podcast ou uma série',
        estimatedMin: 20,
        effort: 'leve',
        stageIndex: 0,
        when: 'primeira-semana',
      },
      {
        title: 'Escrever um texto curto sobre o teu dia',
        minimalVersion: 'Escrever três frases',
        estimatedMin: 20,
        effort: 'medio',
        stageIndex: 1,
        when: 'meio',
      },
      {
        title: 'Marcar a primeira conversa com outra pessoa',
        minimalVersion: 'Só procurar onde marcar',
        estimatedMin: 30,
        effort: 'pesado',
        stageIndex: 2,
        when: 'reta-final',
      },
    ],
  },

  {
    key: 'leitura',
    label: 'Plano de leitura',
    match: [/ler\s+\d+/, /\bler\b/, /leitura/, /livros?\b/, /terminar\s+o\s+livro/],
    axes: [],
    rationale:
      'Ler trava na hora e no lugar, não na vontade. O plano fixa os dois e deixa a meta diária pequena o bastante pra sobreviver a um dia ruim.',
    stages: [
      {
        title: 'Achar a brecha do dia',
        description:
          'Descobrir em que momento a leitura cabe de verdade e deixar o livro lá. Sem isso, ela compete com a tela e perde.',
        weight: 20,
      },
      {
        title: 'Manter o ritmo',
        description: 'Ler quase todo dia, mesmo pouco. O volume vem da repetição, não das maratonas.',
        weight: 40,
      },
      {
        title: 'Fechar a lista',
        description: 'Terminar o que começou e escolher o próximo antes de acabar o atual.',
        weight: 40,
      },
    ],
    habits: [
      {
        name: 'Ler',
        icon: 'livro',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'noite',
        share: 1.0,
        minimalShare: 0.25,
        rationale: 'Todo dia e pouco: é o desenho que sobrevive a semana cheia.',
      },
      {
        name: 'Anotar o que ficou do capítulo',
        icon: 'caneta',
        frequency: 'vezes-semana',
        timesPerWeek: 3,
        dayPart: 'noite',
        fixedMinutes: 5,
        minimalMinutes: 3,
        rationale: 'Uma frase por capítulo é o que separa ler de ter lido.',
      },
    ],
    tasks: [
      {
        title: 'Escolher o livro e ler a primeira sessão',
        minimalVersion: 'Ler 3 páginas',
        estimatedMin: 30,
        effort: 'medio',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Definir a hora e o lugar da leitura',
        minimalVersion: 'Deixar o livro onde você senta',
        estimatedMin: 10,
        effort: 'leve',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Conferir o ritmo e ajustar a meta do dia',
        minimalVersion: 'Olhar quantas páginas por dia deu',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 1,
        when: 'meio',
      },
      {
        title: 'Escolher o próximo livro',
        minimalVersion: 'Anotar dois títulos',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 2,
        when: 'reta-final',
      },
    ],
  },

  {
    key: 'sono',
    label: 'Plano de sono',
    match: [/dormir/, /\bsono\b/, /ins[ôo]nia/, /acordar\s+cedo/],
    axes: [],
    rationale:
      'Sono se conserta pelo que acontece nas duas horas ANTES dele e pelo horário em que você acorda. O plano mexe nesses dois, que são os únicos que dependem de você.',
    caution:
      'Insônia que não melhora em algumas semanas é assunto de médico, não de aplicativo. O plano organiza a rotina, e só.',
    stages: [
      {
        title: 'Fixar o horário de acordar',
        description:
          'O horário de acordar é o que ancora o sono, e é o único que você controla de verdade. Ele vem antes de tudo.',
        weight: 25,
      },
      {
        title: 'Desmontar a noite',
        description:
          'Tirar da última hora o que atrapalha: tela, café tarde, trabalho na cama. Uma coisa por vez.',
        weight: 40,
      },
      {
        title: 'Sustentar, inclusive no fim de semana',
        description:
          'A rotina se perde no sábado. Manter o horário com uma hora de tolerância é o que segura a semana seguinte.',
        weight: 35,
      },
    ],
    habits: [
      {
        name: 'Acordar no mesmo horário',
        icon: 'sol',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'manha',
        fixedMinutes: 5,
        minimalMinutes: 5,
        rationale: 'É a âncora do ciclo inteiro, e vale inclusive no fim de semana.',
      },
      {
        name: 'Desligar as telas antes de deitar',
        icon: 'lua',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'noite',
        share: 1.0,
        minimalShare: 0.3,
        rationale: 'A última hora acordada é a que decide como foi a primeira hora dormindo.',
      },
      {
        name: 'Anotar como foi a noite',
        icon: 'caneta',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'manha',
        fixedMinutes: 3,
        minimalMinutes: 3,
        rationale: 'Sem registro, "dormi mal essa semana" é sensação; com registro, é padrão.',
      },
    ],
    tasks: [
      {
        title: 'Definir o horário de acordar e programar o despertador',
        minimalVersion: 'Só escolher o horário',
        estimatedMin: 10,
        effort: 'leve',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Listar o que acontece na tua última hora acordada',
        minimalVersion: 'Anotar três coisas',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Tirar uma coisa da última hora e trocar por outra',
        minimalVersion: 'Escolher qual vai sair',
        estimatedMin: 15,
        effort: 'medio',
        stageIndex: 1,
        when: 'primeira-semana',
      },
      {
        title: 'Comparar as noites com a primeira semana',
        minimalVersion: 'Olhar os registros e anotar uma conclusão',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 2,
        when: 'meio',
      },
    ],
  },

  {
    key: 'financas',
    label: 'Plano de finanças',
    match: [/dívida|divida/, /finan[çc]a/, /juntar\s+dinheiro/, /guardar\s+dinheiro/, /reserva\s+de\s+emerg/, /or[çc]amento/, /economizar/],
    axes: [],
    rationale:
      'Dinheiro se organiza olhando, não decidindo. O plano começa por enxergar para onde ele vai hoje, e só depois mexe em qualquer coisa.',
    caution: 'O Momentumm organiza a rotina de cuidar do dinheiro. Ele não dá conselho de investimento.',
    stages: [
      {
        title: 'Enxergar o que acontece hoje',
        description:
          'Levantar tudo: o que entra, o que sai, o que está em aberto. Doer é normal, e é o único começo possível.',
        weight: 25,
      },
      {
        title: 'Fechar os vazamentos',
        description:
          'Cancelar o que não é usado, renegociar o que dá e cortar o que você escolher cortar. Um item por semana.',
        weight: 35,
      },
      {
        title: 'Fazer sobrar todo mês',
        description: 'Guardar no começo do mês, não no fim. O que sobra no fim do mês nunca sobra.',
        weight: 40,
      },
    ],
    habits: [
      {
        name: 'Registrar os gastos do dia',
        icon: 'caneta',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'noite',
        fixedMinutes: 5,
        minimalMinutes: 3,
        rationale: 'Cinco minutos por dia valem mais que três horas no fim do mês tentando lembrar.',
      },
      {
        name: 'Conferir o saldo e o que vence',
        icon: 'cerebro',
        frequency: 'vezes-semana',
        timesPerWeek: 2,
        dayPart: 'qualquer',
        fixedMinutes: 10,
        minimalMinutes: 5,
        rationale: 'Duas vezes por semana é o suficiente pra nenhuma conta te surpreender.',
      },
    ],
    tasks: [
      {
        title: 'Listar tudo que entra e tudo que sai por mês',
        minimalVersion: 'Listar só as contas fixas',
        estimatedMin: 60,
        effort: 'pesado',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Levantar as dívidas em aberto com juros e prazo',
        minimalVersion: 'Listar os nomes e os valores',
        estimatedMin: 45,
        effort: 'pesado',
        stageIndex: 0,
        when: 'primeira-semana',
      },
      {
        title: 'Cancelar uma assinatura que você não usa',
        minimalVersion: 'Achar qual vai ser',
        estimatedMin: 20,
        effort: 'medio',
        stageIndex: 1,
        when: 'primeira-semana',
      },
      {
        title: 'Programar a transferência automática do dia do salário',
        minimalVersion: 'Decidir o valor',
        estimatedMin: 20,
        effort: 'medio',
        stageIndex: 2,
        when: 'meio',
      },
      {
        title: 'Fechar o mês e comparar com o primeiro levantamento',
        minimalVersion: 'Olhar o total e anotar uma conclusão',
        estimatedMin: 30,
        effort: 'medio',
        stageIndex: 2,
        when: 'reta-final',
      },
    ],
  },

  {
    key: 'parar',
    label: 'Plano de parar',
    match: [/parar\s+de/, /largar\s+o/, /deixar\s+de\s+(fumar|beber)/, /v[íi]cio/, /abstin/],
    axes: [],
    rationale:
      'Parar não é força de vontade, é trocar o gatilho. O plano identifica quando acontece, tira o que está por perto e põe outra coisa no lugar.',
    caution:
      'Dependência química é assunto de profissional de saúde. O plano organiza a rotina em volta da decisão, não substitui tratamento.',
    stages: [
      {
        title: 'Mapear os gatilhos',
        description:
          'Anotar quando acontece, onde e antes de quê, sem mudar nada ainda. Você não consegue trocar o que ainda não enxergou.',
        weight: 25,
      },
      {
        title: 'Tirar de perto e trocar',
        description:
          'Reduzir a distância entre você e a alternativa, e aumentar a distância entre você e o gatilho.',
        weight: 40,
      },
      {
        title: 'Passar pelas recaídas',
        description:
          'Recaída faz parte e não apaga o que veio antes. Esta etapa é sobre voltar rápido, não sobre não cair.',
        weight: 35,
      },
    ],
    habits: [
      {
        name: 'Anotar quando deu vontade',
        icon: 'caneta',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'qualquer',
        fixedMinutes: 5,
        minimalMinutes: 3,
        rationale: 'O registro é o que transforma "sempre" e "nunca" em horário, lugar e situação.',
      },
      {
        name: 'Fazer a troca combinada',
        icon: 'agua',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'qualquer',
        share: 1.0,
        minimalShare: 0.3,
        rationale: 'Tirar sem pôr nada no lugar é o desenho que falha na primeira semana ruim.',
      },
    ],
    tasks: [
      {
        title: 'Anotar as três situações em que mais acontece',
        minimalVersion: 'Anotar uma',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Escolher com o que você vai trocar',
        minimalVersion: 'Escolher uma troca só',
        estimatedMin: 15,
        effort: 'medio',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Tirar de casa o que está ao alcance',
        minimalVersion: 'Tirar do lugar mais fácil',
        estimatedMin: 20,
        effort: 'medio',
        stageIndex: 1,
        when: 'primeira-semana',
      },
      {
        title: 'Contar pra uma pessoa que você está tentando',
        minimalVersion: 'Escolher pra quem contar',
        estimatedMin: 15,
        effort: 'medio',
        stageIndex: 1,
        when: 'primeira-semana',
      },
      {
        title: 'Rever os registros e ver o que mudou',
        minimalVersion: 'Contar quantos dias limpos',
        estimatedMin: 20,
        effort: 'leve',
        stageIndex: 2,
        when: 'meio',
      },
    ],
  },

  {
    key: 'meditacao',
    label: 'Plano de prática',
    match: [/meditar|medita[çc]/, /ansiedade/, /respira[çc]/, /mindfulness/, /\bcalma\b/],
    axes: [],
    rationale:
      'Prática trava na regularidade, não na duração. O plano começa curto de propósito: cinco minutos todo dia constroem o que trinta minutos no domingo não constroem.',
    caution:
      'Ansiedade que atrapalha a vida é assunto de profissional de saúde mental. A prática ajuda, não trata.',
    stages: [
      {
        title: 'Criar o gancho',
        description:
          'Amarrar a prática a uma coisa que você já faz todo dia, no mesmo lugar. O gancho é o que faz ela acontecer sem decisão.',
        weight: 25,
      },
      {
        title: 'Manter todo dia, mesmo curto',
        description: 'Regularidade antes de duração. Três minutos contam e mantêm a sequência viva.',
        weight: 40,
      },
      {
        title: 'Aumentar e levar pro dia',
        description:
          'Sessões maiores e o uso da prática fora dela: antes de uma reunião, no meio de um dia ruim.',
        weight: 35,
      },
    ],
    habits: [
      {
        name: 'Praticar',
        icon: 'lotus',
        frequency: 'diario',
        timesPerWeek: 7,
        dayPart: 'manha',
        share: 1.0,
        minimalShare: 0.25,
        rationale: 'Todo dia, no mesmo horário: é o que faz a prática deixar de precisar de decisão.',
      },
      {
        name: 'Anotar como você chegou e como saiu',
        icon: 'caneta',
        frequency: 'vezes-semana',
        timesPerWeek: 3,
        dayPart: 'qualquer',
        fixedMinutes: 3,
        minimalMinutes: 3,
        rationale: 'Duas palavras bastam, e é o que mostra o efeito que a memória não guarda.',
      },
    ],
    tasks: [
      {
        title: 'Fazer a primeira sessão guiada',
        minimalVersion: 'Respirar por 3 minutos',
        estimatedMin: 15,
        effort: 'medio',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Escolher o gancho: depois de quê você vai praticar',
        minimalVersion: 'Escolher o horário',
        estimatedMin: 10,
        effort: 'leve',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Preparar o canto da prática',
        minimalVersion: 'Escolher onde vai ser',
        estimatedMin: 15,
        effort: 'leve',
        stageIndex: 1,
        when: 'primeira-semana',
      },
      {
        title: 'Usar a prática num momento difícil do dia',
        minimalVersion: 'Três respirações, onde você estiver',
        estimatedMin: 10,
        effort: 'medio',
        stageIndex: 2,
        when: 'meio',
      },
    ],
  },

  {
    key: 'escrever',
    label: 'Plano de escrita',
    match: [/escrever/, /escrita/, /\btcc\b/, /disserta[çc]/, /monografia/, /\blivro\b.*escrev|escrev.*\blivro\b/, /artigo/],
    axes: [],
    rationale:
      'Texto trava no branco da página, não na falta de tempo. O plano separa escrever de revisar, porque fazer os dois ao mesmo tempo é o que trava.',
    stages: [
      {
        title: 'Montar o esqueleto',
        description:
          'A estrutura inteira em tópicos, antes de qualquer parágrafo bonito. É o que evita reescrever tudo depois.',
        weight: 20,
      },
      {
        title: 'Escrever o rascunho feio',
        description:
          'Encher as seções sem revisar nada. Rascunho ruim é material; página em branco não é.',
        weight: 45,
      },
      {
        title: 'Revisar e fechar',
        description: 'Agora sim, cortar, reescrever e revisar. Uma passada por vez, com um objetivo cada.',
        weight: 35,
      },
    ],
    habits: [
      {
        name: 'Escrever',
        icon: 'caneta',
        frequency: 'vezes-semana',
        timesPerWeek: 5,
        dayPart: 'manha',
        share: 1.0,
        minimalShare: 0.25,
        rationale: 'Sessão curta e frequente ganha do fim de semana inteiro guardado pra isso.',
      },
      {
        name: 'Anotar de onde parar e por onde continuar',
        icon: 'livro',
        frequency: 'vezes-semana',
        timesPerWeek: 5,
        dayPart: 'qualquer',
        fixedMinutes: 5,
        minimalMinutes: 3,
        rationale: 'Parar deixando a próxima frase anotada é o que tira o branco da sessão seguinte.',
      },
    ],
    tasks: [
      {
        title: 'Escrever o esqueleto em tópicos, do começo ao fim',
        minimalVersion: 'Listar as seções principais',
        estimatedMin: 60,
        effort: 'pesado',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Definir a hora fixa de escrever',
        minimalVersion: 'Escolher o horário',
        estimatedMin: 10,
        effort: 'leve',
        stageIndex: 0,
        when: 'hoje',
      },
      {
        title: 'Fechar o rascunho da primeira seção',
        minimalVersion: 'Escrever um parágrafo',
        estimatedMin: 60,
        effort: 'pesado',
        stageIndex: 1,
        when: 'primeira-semana',
      },
      {
        title: 'Ler tudo em voz alta e marcar o que não se sustenta',
        minimalVersion: 'Ler uma seção',
        estimatedMin: 45,
        effort: 'medio',
        stageIndex: 2,
        when: 'meio',
      },
      {
        title: 'Fazer a revisão final e entregar',
        minimalVersion: 'Revisar a introdução e a conclusão',
        estimatedMin: 60,
        effort: 'pesado',
        stageIndex: 2,
        when: 'reta-final',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// a detecção
// ---------------------------------------------------------------------------

/**
 * Qual roteiro casa com o que a pessoa escreveu.
 *
 * Sem casamento claro, devolve null e o plano genérico continua valendo. É a
 * decisão mais importante deste arquivo: um roteiro de corrida montado pra quem
 * escreveu "correr atrás do prejuízo" faz o app parecer que não leu, e a
 * primeira impressão de um plano errado é difícil de desfazer.
 *
 * O MOTIVO ("por que isso importa") entra na busca junto com o título, porque é
 * onde a pessoa costuma dizer o assunto de verdade: "Ficar bem" com motivo
 * "quero emagrecer pro casamento" é um plano de emagrecimento.
 */
export function detectBlueprint(
  title: string,
  axis: ActivityTypeSlug,
  motive?: string | null,
): PlanBlueprint | null {
  const haystack = normalize(`${title} ${motive ?? ''}`)
  if (haystack.trim().length < 3) return null

  for (const blueprint of PLAN_BLUEPRINTS) {
    if (blueprint.axes.length > 0 && !blueprint.axes.includes(axis)) continue
    if (blueprint.match.some((pattern) => pattern.test(haystack))) return blueprint
  }

  return null
}

/** Minúsculas e sem acento: "Emagrecer" e "emagrécer" chegam no mesmo lugar. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** O roteiro pela chave. Serve à prévia e aos testes, não à detecção. */
export function blueprintByKey(key: string): PlanBlueprint | null {
  return PLAN_BLUEPRINTS.find((item) => item.key === key) ?? null
}

/**
 * A soma dos pesos de um roteiro. O domínio exige 100, e um roteiro que não
 * fecha seria recusado só na hora de gravar, com o plano já na tela.
 */
export function weightSum(blueprint: PlanBlueprint): number {
  return blueprint.stages.reduce((total, stage) => total + stage.weight, 0)
}
