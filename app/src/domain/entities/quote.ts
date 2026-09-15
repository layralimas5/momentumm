import type { DayKey } from './day'

/**
 * Frases do dia.
 *
 * Tom deliberado: direto, sem carinho, sem "você consegue". A pessoa que liga
 * isso quer ser puxada, não acolhida. Por isso o card é opcional e a categoria
 * é escolha dela: a frase que motiva uma pessoa irrita outra.
 *
 * Todas autorais. Sem citação de terceiros: frase famosa é problema de
 * direito e de plágio, e ninguém posta no Stories o que já viu mil vezes.
 */

export const QUOTE_CATEGORIES = ['disciplina', 'foco', 'sucesso', 'resiliencia'] as const
export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number]

export const QUOTE_CATEGORY_LABELS: Readonly<Record<QuoteCategory, string>> = {
  disciplina: 'Disciplina',
  foco: 'Foco',
  sucesso: 'Sucesso',
  resiliencia: 'Resiliência',
}

export interface Quote {
  readonly id: string
  readonly category: QuoteCategory
  readonly text: string
}

const BANK: Readonly<Record<QuoteCategory, readonly string[]>> = {
  disciplina: [
    'Motivação acaba antes do almoço. Disciplina é o que te leva até a noite.',
    'Você não precisa estar a fim. Precisa estar lá.',
    'O dia que você pula é o dia que a versão preguiçosa vence. De novo.',
    'Ninguém vai fazer por você. E ninguém vai te cobrar. Só o resultado.',
    'Rotina é chata. Ficar no mesmo lugar por mais um ano é pior.',
    'A versão mínima feita vale mais que a versão perfeita adiada.',
    'Todo mundo tem um plano até a segunda-feira chegar. Cumpre o teu.',
    'Constância não é sobre vontade. É sobre não negociar consigo mesmo.',
    'Faz hoje o que a tua desculpa diz que dá pra fazer amanhã.',
    'Você já sabe o que precisa fazer. Falta só parar de fingir que não.',
    'Se depender de vontade, você já perdeu. Depende de horário.',
    'Feito às 7 ou feito às 23. Não feito não existe.',
    'Ninguém está te olhando. É exatamente por isso que conta.',
    'A pessoa que você quer ser não pula treino por chuva.',
    'Cansaço é dado, não veredito. Registra e segue.',
    'O plano não falhou. Você não abriu ele.',
    'Deixar pra depois é decidir por não. Só que sem coragem de dizer.',
    'Dez minutos ruins ganham de uma hora imaginária.',
    'Você negocia com o despertador como se ele fosse ceder.',
    'A rotina que você ridiculariza é a que constrói quem você inveja.',
    'Não existe dia perfeito pra começar. Existe hoje.',
    'Conforto é o lugar onde os objetivos vão morrer devagar.',
    'A meta não mudou. Você que parou de aparecer.',
    'Comprometido é quem faz quando ninguém pede.',
    'Preguiça vestida de planejamento continua sendo preguiça.',
  ],
  foco: [
    'Vinte coisas pela metade não valem uma inteira.',
    'Se tudo é prioridade, nada é. Escolhe uma e fecha.',
    'A distração cobra juros. Você paga em semanas.',
    'O celular não vai avançar o teu objetivo. Ele nunca avançou.',
    'Uma ação concluída hoje pesa mais que dez planejadas pra depois.',
    'Foco é dizer não pra coisa boa em nome da coisa certa.',
    'O que você não protege, o dia engole.',
    'Trinta minutos sem interrupção fazem mais que três horas picadas.',
    'Você não está ocupado. Está espalhado.',
    'A próxima ação é uma só. O resto é ruído.',
    'Abriu o app pra fazer uma coisa. Faz essa coisa.',
    'Multitarefa é o nome bonito de não terminar nada.',
    'Cada aba aberta é um pedaço do teu objetivo indo embora.',
    'Você não precisa de mais tempo. Precisa de menos janela.',
    'Escolhe a ação, fecha o resto, e não volta antes de terminar.',
    'A ideia nova é a fuga mais elegante da tarefa atual.',
    'Notificação não é urgência. É outra pessoa pedindo teu dia.',
    'Profundidade vence quantidade. Sempre venceu.',
    'Se não entra no plano de hoje, não entra na tua cabeça hoje.',
    'Concentração é um músculo. O teu está fraco porque você não usa.',
    'O que te distrai não vai te agradecer depois.',
    'Quem faz tudo ao mesmo tempo fica no mesmo lugar ao mesmo tempo.',
    'Silencia o celular. O mundo sobrevive uma hora sem você.',
    'Uma prioridade. Uma. O nome já diz.',
    'Pensar em fazer não é fazer. Você já pensou o suficiente.',
  ],
  sucesso: [
    'Resultado não nasce no dia da entrega. Nasce em cada dia que ninguém viu.',
    'A diferença entre quem chega e quem quase chegou é o mês em que um parou.',
    'Ninguém vai aplaudir o processo. Faz mesmo assim.',
    'Sorte é o nome que dão ao que você construiu em silêncio.',
    'O objetivo não se importa com como você está se sentindo.',
    'Você não está atrasado. Está parado. E isso tem conserto hoje.',
    'Grande resultado é uma pilha de dias comuns bem feitos.',
    'Quem tem prazo cumpre. Quem tem desejo espera.',
    'O tempo vai passar de qualquer jeito. A pergunta é com o que você chega lá.',
    'Ambição sem plano é conversa. Plano sem execução é enfeite.',
    'O ponto de virada nunca é um dia. É a soma de cem iguais.',
    'Quem quer resultado rápido geralmente quer sem esforço.',
    'Você não está competindo com ninguém. Está sendo cobrado pelo que prometeu.',
    'Talento é o que os outros chamam quando não viram o treino.',
    'Não peça pra ser fácil. Peça pra aguentar.',
    'Se fosse simples, todo mundo teria. Você quer o que poucos têm.',
    'O sucesso não avisa quando chega. Ele confere quem ficou.',
    'Sonhar é grátis. Executar cobra todo dia.',
    'Pequeno progresso diário é o único atalho que funciona.',
    'Tem gente com menos que você fazendo mais. Sem desculpa.',
    'A pessoa que você admira teve os mesmos dias ruins. Ela só não parou.',
    'O plano de seis meses começa nos próximos vinte e cinco minutos.',
    'Ninguém entrega o que você quer. Você constrói ou fica sem.',
    'Ser bom não basta. Ser constante é o que separa.',
    'Você tem o mesmo dia que qualquer um. A diferença é o que faz com ele.',
  ],
  resiliencia: [
    'Perdeu um dia. Não perdeu o objetivo. Volta.',
    'Recomeçar não é fraqueza. Desistir é.',
    'A sequência quebrou. A pessoa não. Registra hoje.',
    'Cair faz parte. Ficar no chão é escolha.',
    'Dia ruim conta. Faz o mínimo e sai dele em pé.',
    'Você já passou por coisa pior que uma segunda-feira.',
    'O que te derrubou ontem não tem nada pra dizer sobre hoje.',
    'Errar o ritmo é normal. Parar de contar os dias, não.',
    'Não precisa recuperar tudo. Precisa recuperar o próximo passo.',
    'A retomada de hoje vale mais que a sequência que você perdeu.',
    'Não foi a semana perfeita. Foi uma semana. Continua.',
    'Você não quebrou. Você parou. E parar tem reinício.',
    'A versão mínima existe pra hoje. Usa ela.',
    'Objetivo atrasado ainda é objetivo. Abandonado é que não.',
    'O que você não fez ontem não pode ser feito hoje. O que dá é o de hoje.',
    'Vergonha de voltar é o que mantém as pessoas paradas. Volta assim mesmo.',
    'Errar o dia não apaga os outros trinta.',
    'Recuperar é um passo. Não é a semana inteira de uma vez.',
    'Um dia zero não define ninguém. Sete seguidos começam a definir.',
    'Se você está lendo isso, ainda não desistiu. Então age como quem não desistiu.',
    'O ritmo cai. Você levanta ele. Essa é a rotina, não a exceção.',
    'Ninguém tem sequência infinita. Tem quem recomeça rápido.',
    'A culpa não avança nada. A próxima ação avança.',
    'Perder o embalo dói menos que perder o objetivo.',
    'Hoje é o primeiro dia que importa. Sempre é.',
  ],
}

export const QUOTES: readonly Quote[] = QUOTE_CATEGORIES.flatMap((category) =>
  BANK[category].map((text, index) => ({ id: `${category}-${index + 1}`, category, text })),
)

export function quotesOf(category: QuoteCategory): readonly Quote[] {
  return QUOTES.filter((quote) => quote.category === category)
}

/**
 * A frase de um dia numa categoria, determinística: todo mundo que abre o app
 * na mesma data vê a mesma frase, e recarregar não troca. `offset` é o
 * "próxima": a pessoa avança na lista sem sair do dia.
 */
export function quoteOfDay(day: DayKey, category: QuoteCategory, offset = 0): Quote {
  const list = quotesOf(category)
  const seed = hashOf(day)
  const index = (seed + offset) % list.length
  return list[index] ?? (list[0] as Quote)
}

function hashOf(value: string): number {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash
}
