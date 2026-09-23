/**
 * O contato de quem respondeu o quiz, antes de existir conta.
 *
 * Existe por um motivo comercial e um só: quem monta o plano inteiro e não
 * cria conta hoje some sem deixar endereço. Com nome, e-mail e WhatsApp dá
 * pra voltar a falar com essa pessoa.
 *
 * Nome e e-mail são obrigatórios; telefone e idade são opcionais de
 * propósito. Cada campo obrigatório a mais é gente desistindo na tela que
 * fica entre a última pergunta e o plano, que é o pior lugar possível pra
 * perder alguém.
 *
 * A validação daqui é a mesma do banco (`quiz_save_lead`, migration 0039).
 * Aqui ela existe pra a pessoa ver o erro antes de a rede responder; lá ela
 * existe porque cliente nenhum é fonte de verdade.
 */

export interface QuizLead {
  readonly name: string
  readonly email: string
  /** Só dígitos, com DDD. Vazio quando não informado. */
  readonly phone: string
}

export const EMPTY_QUIZ_LEAD: QuizLead = { name: '', email: '', phone: '' }

export const MIN_LEAD_NAME = 2
export const MAX_LEAD_NAME = 60
export const MAX_LEAD_EMAIL = 160

/**
 * Forma de e-mail, não existência: `@` com alguma coisa dos dois lados e um
 * ponto com letras depois. Provar que um endereço existe é trabalho do
 * e-mail que vai chegar nele, não de uma expressão regular.
 */
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/

/** O telefone como o banco guarda: só dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * O telefone como a pessoa lê enquanto digita: (11) 91234-5678. Formatar na
 * tela evita o erro mais comum do campo, que é faltar ou sobrar um dígito
 * sem ninguém perceber.
 */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (rest.length <= 4) return `(${ddd}) ${rest}`
  const cut = rest.length > 8 ? 5 : 4
  return `(${ddd}) ${rest.slice(0, cut)}-${rest.slice(cut)}`
}

export interface LeadErrors {
  readonly name?: string
  readonly email?: string
  readonly phone?: string
}

/** Os erros do formulário. Objeto vazio quando dá pra enviar. */
export function leadErrors(lead: QuizLead): LeadErrors {
  const errors: { name?: string; email?: string; phone?: string } = {}

  if (lead.name.trim().length < MIN_LEAD_NAME) {
    errors.name = 'Escreve teu nome ou como você quer ser chamado.'
  }
  if (!EMAIL_SHAPE.test(lead.email.trim())) {
    errors.email = 'Confere o e-mail: é pra lá que o plano vai.'
  }

  const digits = onlyDigits(lead.phone)
  if (digits.length > 0 && (digits.length < 10 || digits.length > 11)) {
    errors.phone = 'O WhatsApp precisa ter DDD e 8 ou 9 dígitos.'
  }

  return errors
}

export function isLeadReady(lead: QuizLead): boolean {
  return Object.keys(leadErrors(lead)).length === 0
}

export interface NormalizedLead {
  readonly name: string
  readonly email: string
  readonly phone: string | null
}

/** O contato pronto pra gravar. Só chame com `isLeadReady`. */
export function normalizeLead(lead: QuizLead): NormalizedLead {
  const digits = onlyDigits(lead.phone)
  return {
    name: lead.name.trim().slice(0, MAX_LEAD_NAME),
    email: lead.email.trim().toLowerCase().slice(0, MAX_LEAD_EMAIL),
    phone: digits.length >= 10 ? digits : null,
  }
}
