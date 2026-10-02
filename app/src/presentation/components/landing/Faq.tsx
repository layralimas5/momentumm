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
 * As objeções que aparecem ANTES de pagar, escritas como a pessoa pergunta
 * em voz alta: "já tentei e larguei", tempo, pra que meta serve, preço,
 * teste e cancelamento, privacidade e pra quem não serve. Sete no máximo:
 * é a última coisa que a pessoa lê antes de decidir, e pergunta demais vira
 * rolagem. Por isso as respostas cabem em duas ou três frases.
 *
 * Teste, cobrança, privacidade e cancelamento só afirmam o que está
 * implementado. Com `TRIAL_PROMISE_VERIFIED` desligada, a pergunta do teste
 * vira só a do cancelamento.
 */
const RISK: Question = TRIAL_PROMISE_VERIFIED
  ? {
      question: 'Como funciona o teste? E se eu quiser cancelar?',
      answer: `Toda conta nova começa com ${TRIAL_DAYS} dias de PRO, sem cartão e sem cobrança automática; no fim, a conta volta pro gratuito sozinha. Se assinar, cancela em Configurações quando quiser, sem fidelidade, e nada do que você criou é apagado.`,
    }
  : {
      question: 'Posso cancelar quando quiser?',
      answer:
        'Sim, sem fidelidade: cancela em Configurações e o PRO vale até o fim do período já pago. Depois a conta volta pro gratuito com tudo que você criou.',
    }

const QUESTIONS: readonly Question[] = [
  {
    question: 'Já tentei app de metas e larguei. Por que esse seria diferente?',
    answer:
      'Porque ele foi feito pro dia em que você falha. Com pouco tempo, o passo de hoje encolhe pra versão mínima; depois de dias parados, você volta de onde parou e o Momentumm Score não zera.',
  },
  {
    question: 'Quanto tempo por dia eu preciso ter?',
    answer:
      'A partir de 10 minutos. Você não planeja nada: o quiz pergunta quanto tempo você tem de verdade e o plano já sai desse tamanho. Em dia apertado, vale a versão mínima.',
  },
  {
    question: 'Serve pra que tipo de meta?',
    answer:
      'Pra meta pessoal com prazo: ler mais, estudar pra uma prova, treinar, meditar, tirar um projeto do papel. Roda no navegador do celular e do computador, sem instalar nada.',
  },
  {
    question: 'Qual a diferença entre o gratuito e o PRO?',
    answer: `O gratuito roda o ciclo inteiro com limites: ${free.activeObjectives} objetivos, ${free.activeHabits} hábitos, ${free.activePlans} plano por etapas, ${free.actionsPerDay} ações por dia e ${free.historyDays} dias de histórico. O PRO tira os limites e abre o histórico completo, o review semanal e a Momentumm AI.`,
  },
  RISK,
  {
    question: 'Meus dados ficam privados?',
    answer:
      'Tudo nasce privado, e a regra de quem vê o quê é aplicada no banco, não só na tela. Você exporta tudo o que é seu, ou apaga a conta, quando quiser.',
  },
  {
    question: 'Pra quem o Momentumm não serve?',
    answer:
      'Pra quem procura agenda de tarefas do trabalho ou da equipe, ou um app que cobre e castigue. Ele é pra metas pessoais, e o passo de cada dia continua sendo seu.',
  },
]

export function Faq() {
  return (
    <Section id="faq" className="border-t border-line bg-surface/30">
      <SectionHeading eyebrow="Antes de começar" title="O que costuma travar quem quer começar" />

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
