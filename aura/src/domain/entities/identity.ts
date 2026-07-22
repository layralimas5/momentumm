/**
 * Identidade Futura — a alma do Aura. A mulher que a usuária decidiu se tornar,
 * descrita por ela mesma. O sistema guarda isso e usa pra lembrá-la de quem ela
 * está construindo — o que diferencia o Aura de um simples app de hábitos.
 * Camada de domínio: pura, sem dependência de framework, banco ou UI.
 */

export interface IdentityAnswers {
  /** Quem você quer se tornar? */
  becoming: string
  /** Como essa mulher acorda? */
  morning: string
  /** Como ela se veste? */
  dressing: string
  /** O que ela faz todos os dias? */
  daily: string
  /** O que ela nunca mais faz? */
  neverAgain: string
}

export interface Identity extends IdentityAnswers {
  readonly userId: string
  readonly createdAt: string
  updatedAt: string
}

export interface IdentityQuestion {
  key: keyof IdentityAnswers
  label: string
  placeholder: string
  hint: string
}

/** As perguntas do onboarding — a ordem é a jornada de descoberta. */
export const IDENTITY_QUESTIONS: IdentityQuestion[] = [
  {
    key: 'becoming',
    label: 'Quem você quer se tornar?',
    placeholder: 'A mulher que...',
    hint: 'Descreva ela em uma frase, no presente.',
  },
  {
    key: 'morning',
    label: 'Como essa mulher acorda?',
    placeholder: 'Ela acorda...',
    hint: 'O primeiro momento do dia dela.',
  },
  {
    key: 'dressing',
    label: 'Como ela se veste?',
    placeholder: 'Ela se veste...',
    hint: 'A forma como ela se apresenta pro mundo.',
  },
  {
    key: 'daily',
    label: 'O que ela faz todos os dias?',
    placeholder: 'Todos os dias ela...',
    hint: 'Os hábitos inegociáveis dela.',
  },
  {
    key: 'neverAgain',
    label: 'O que ela nunca mais faz?',
    placeholder: 'Ela nunca mais...',
    hint: 'O que ficou pra trás na antiga versão.',
  },
]

export const IdentityRules = {
  emptyAnswers(): IdentityAnswers {
    return { becoming: '', morning: '', dressing: '', daily: '', neverAgain: '' }
  },

  /** Toda pergunta respondida (não-vazia)? */
  isComplete(answers: Partial<IdentityAnswers>): answers is IdentityAnswers {
    return IDENTITY_QUESTIONS.every((q) => (answers[q.key] ?? '').trim().length > 0)
  },

  /** Normaliza as respostas (trim). */
  trim(answers: IdentityAnswers): IdentityAnswers {
    return {
      becoming: answers.becoming.trim(),
      morning: answers.morning.trim(),
      dressing: answers.dressing.trim(),
      daily: answers.daily.trim(),
      neverAgain: answers.neverAgain.trim(),
    }
  },
} as const

/** Remove pontuação final pra encaixar a resposta numa frase-lembrete. */
function phrase(value: string): string {
  return value.trim().replace(/[.!…]+$/u, '')
}

/**
 * Lembrete de identidade — a frase que puxa a usuária pra mulher que ela decidiu
 * ser. Determinístico por dia; cita as respostas dela pra soar pessoal.
 */
export function identityReminder(identity: IdentityAnswers, date: Date = new Date()): string {
  const templates = [
    `A mulher que você quer ser já estaria vivendo isto hoje: ${phrase(identity.daily)}.`,
    `Você decidiu se tornar ${phrase(identity.becoming)}. Continue.`,
    `Ela não volta pra ${phrase(identity.neverAgain)}.`,
    `É assim que ela começa o dia: ${phrase(identity.morning)}.`,
  ]
  return templates[date.getDate() % templates.length] ?? templates[0]!
}
