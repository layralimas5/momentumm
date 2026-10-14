import type { PlannedTask } from './plan-builder'
import type { QuizToneKey } from './quiz'

/**
 * O primeiro passo feito dentro do quiz, antes da conta: o que fazer agora
 * e com que voz pedir.
 */

/**
 * O que a tela pede pra fazer agora.
 *
 * A estimativa do roteiro não encolhe pra caber no dia (`blueprintTasks`): um
 * levantamento de finanças leva uma hora pra quem tem 20 minutos também. No
 * app isso se resolve pela versão mínima, e no quiz precisa se resolver
 * antes, porque a pessoa vai fazer o passo AGORA, e pedir uma hora pra quem
 * acabou de dizer que tem 20 minutos é a forma mais rápida de ela não fazer
 * nada. Quando não cabe e existe versão mínima, ela vira o passo, e a versão
 * completa fica dita como o que continua no plano. A versão mínima conta como
 * feito no app inteiro, então marcar a ação como concluída depois é verdade.
 */
export interface FirstStepNow {
  readonly title: string
  /** O alvo do cronômetro. */
  readonly minutes: number | null
  /** A ação completa, quando quem aparece é a versão mínima. */
  readonly fullTitle: string | null
}

export function firstStepNow(step: PlannedTask, budgetMin: number): FirstStepNow {
  const estimate = step.estimatedMin ?? null
  const fits = estimate === null || estimate <= budgetMin
  // Sem versão mínima não há o que oferecer no lugar, e encolher o número
  // seria mentir o tamanho do passo: ele aparece como é.
  if (fits || !step.minimalVersion) return { title: step.title, minutes: estimate, fullTitle: null }
  return { title: step.minimalVersion, minutes: budgetMin, fullTitle: step.title }
}

/**
 * A voz do primeiro passo, por tom escolhido no quiz.
 *
 * Só texto: o passo, o tempo e a versão mínima são os mesmos nos três tons.
 * O tom muda como o app pede, nunca o que ele pede. Sem tom (resposta salva
 * antes da pergunta existir) a voz é a direta, que é a do resto do produto.
 */
export interface FirstStepVoice {
  /** A linha acima do passo. */
  readonly lead: string
  /** A frase quando a pessoa fecha o passo. */
  readonly done: string
  /** O convite pra criar conta, depois do passo feito. */
  readonly save: string
}

const VOICES: Readonly<Record<QuizToneKey, FirstStepVoice>> = {
  gentil: {
    lead: 'Sem pressa. Por hoje, só isso:',
    done: 'Feito. Foi pequeno, e é assim que fica.',
    save: 'Cria sua conta e eu guardo esse passo junto com o plano.',
  },
  direto: {
    lead: 'Seu primeiro passo. Dá pra fazer agora:',
    done: 'Feito. Você saiu do zero.',
    save: 'Cria sua conta pra esse passo e o plano ficarem salvos.',
  },
  sem_filtro: {
    lead: 'Chega de planejar. Faz isso aqui:',
    done: 'Olha só, saiu do papel. Nem doeu.',
    save: 'Agora cria a conta, antes que você invente outra desculpa.',
  },
}

export function firstStepVoice(tone: QuizToneKey | null): FirstStepVoice {
  return VOICES[tone ?? 'direto']
}
