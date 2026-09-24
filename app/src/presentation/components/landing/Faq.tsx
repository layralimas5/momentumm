import { TRIAL_DAYS } from '@/domain/billing/trial'
import { PLAN_LIMITS } from '@/domain/entities/plan'
import { trackLandingOnce } from './landing-analytics'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'
import { TRIAL_PROMISE_VERIFIED } from './site'

const free = PLAN_LIMITS.free

interface Question {
  readonly question: string
  readonly answer: string
}

/**
 * As dúvidas na ordem em que aparecem na cabeça de quem acabou de ler a
 * página: como é o meu dia, o que acontece quando eu sumo, quanto custa, e
 * as de risco (teste, privacidade, cancelamento).
 *
 * As respostas são curtas de propósito. FAQ é a última coisa que alguém lê
 * antes de decidir: um parágrafo de seis linhas aqui não tira dúvida, cria
 * uma. A pergunta "preciso organizar tudo sozinho?" saiu porque a seção
 * "como funciona" já responde ela com a tela.
 *
 * Trial, cobrança, privacidade e cancelamento só afirmam o que está
 * implementado. A pergunta do teste some junto com a promessa quando
 * `TRIAL_PROMISE_VERIFIED` está desligada: FAQ prometendo o que o hero não
 * promete é pior que não ter a pergunta.
 */
const BASE: readonly Question[] = [
  {
    question: 'Como o Momentumm funciona no dia a dia?',
    answer:
      'Você diz onde quer chegar e o app monta um plano por etapas, com ações que têm data. Todo dia você abre e encontra um passo só, do tamanho do tempo que tem.',
  },
  {
    question: 'O que acontece se eu perder alguns dias?',
    answer:
      'Você volta de onde parou. Os dias parados não são cobrados, a sequência não é encerrada e o Momentumm Score não zera: ele olha 28 dias, então um dia vazio tira poucos pontos.',
  },
  {
    question: 'Qual a diferença entre o gratuito e o PRO?',
    answer: `O gratuito roda o ciclo inteiro com limites: ${free.activeObjectives} objetivos, ${free.activeHabits} hábitos, ${free.activePlans} plano por etapas, ${free.actionsPerDay} ações por dia, ${free.historyDays} dias de histórico e ${free.pairs} dupla no Juntos. O PRO tira os limites e abre o histórico completo, o review semanal e a Momentumm AI.`,
  },
]

const TRIAL_QUESTION: Question = {
  question: 'Como funciona o período de teste?',
  answer: `Toda conta nova começa com ${TRIAL_DAYS} dias de PRO, sem cartão e sem cobrança automática. No fim do prazo a conta volta pro gratuito sozinha e nada do que você criou é apagado.`,
}

const CLOSING: readonly Question[] = [
  {
    question: 'Meus dados ficam privados?',
    answer:
      'Tudo nasce privado, e a regra de quem vê o quê é aplicada no banco, não só na tela. Compartilhar é uma escolha item por item, e você exporta tudo o que é seu, ou apaga a conta, quando quiser.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim, sem fidelidade: cancela em Configurações e o PRO vale até o fim do período já pago. Depois a conta volta pro gratuito com tudo que você criou.',
  },
]

const QUESTIONS: readonly Question[] = TRIAL_PROMISE_VERIFIED
  ? [...BASE, TRIAL_QUESTION, ...CLOSING]
  : [...BASE, ...CLOSING]

export function Faq() {
  return (
    <Section id="faq" className="border-t border-line bg-surface/30">
      <SectionHeading eyebrow="Dúvidas" title="O que perguntam antes de começar" />

      <div className="mx-auto mt-10 flex max-w-2xl flex-col gap-2.5">
        {QUESTIONS.map((item, index) => (
          <Reveal key={item.question} delay={index * 0.03}>
            <details
              onToggle={(event) => {
                if (event.currentTarget.open) trackLandingOnce('faq_opened')
              }}
              className="group pulse-on-hover rounded-card border border-line bg-surface transition-colors open:border-line-hi open:bg-surface-hi"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium text-ink marker:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-white transition-transform duration-200 group-open:rotate-180"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <p className="px-5 pb-5 text-pretty text-sm text-ink-muted">{item.answer}</p>
            </details>
          </Reveal>
        ))}
      </div>

      <FaqJsonLd />
    </Section>
  )
}

/** Dados estruturados pra rich result de FAQ. Gerados da mesma lista da tela. */
function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: QUESTIONS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
