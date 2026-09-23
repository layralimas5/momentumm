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
 * página: como isso funciona no meu dia, quem monta o plano, o que acontece
 * quando eu sumo, quanto custa, e as três de risco (teste, privacidade,
 * cancelamento).
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
      'Você cria um objetivo com prazo e o app monta um plano por etapas, com ações que têm data. Todo dia você abre a tela Hoje, diz como está chegando, faz a ação principal e marca os hábitos. Quando o dia aperta, o Dia Adaptável encolhe o plano pro tempo que você tem. No fim da semana, o review mostra onde evoluiu, onde o ritmo caiu e o que ajustar.',
  },
  {
    question: 'Preciso organizar tudo sozinho?',
    answer:
      'Não. Você diz onde quer chegar, até quando e quantos minutos tem por dia, e o plano vem pronto em etapas, com as primeiras ações e um hábito de apoio. Toda linha é editável antes de salvar, e você pode montar tudo na mão se preferir.',
  },
  {
    question: 'O que acontece se eu perder alguns dias?',
    answer:
      'Nada é cobrado de volta. A sequência conta dias cumpridos, e a versão mínima de um hábito conta como dia cumprido. O Momentumm Score olha 28 dias, então um dia vazio tira poucos pontos e nunca zera. Depois de uma pausa, o Modo Retomada monta até três passos pequenos pra você voltar de onde parou, sem encerrar nenhuma sequência.',
  },
  {
    question: 'Qual a diferença entre o gratuito e o PRO?',
    answer: `O gratuito roda o ciclo inteiro, com limites: ${free.activeObjectives} objetivos ativos, ${free.activeHabits} hábitos, ${free.activePlans} plano por etapas, ${free.actionsPerDay} ações por dia e os últimos ${free.historyDays} dias de histórico. O PRO tira os limites, abre o histórico completo, a evolução e o detalhamento do Momentumm Score, o review semanal completo, a Momentumm AI e as métricas de período.`,
  },
]

const TRIAL_QUESTION: Question = {
  question: 'Como funciona o período de teste?',
  answer: `Toda conta nova começa com ${TRIAL_DAYS} dias de PRO completo, sem cartão e sem cobrança automática. No fim dos ${TRIAL_DAYS} dias a conta volta pro gratuito sozinha: nada é apagado, e o que passar dos limites do gratuito fica guardado pra quando você assinar. Se assinar durante o teste, o PRO segue pela assinatura sem interrupção.`,
}

const CLOSING: readonly Question[] = [
  {
    question: 'Meus dados ficam privados?',
    answer:
      'Tudo nasce privado. A regra de quem vê o quê é aplicada no banco de dados (Row Level Security), não só na tela, então nem um erro de interface expõe o seu registro. Compartilhar um momento é uma escolha por item, e gerar uma imagem pro Stories não muda a visibilidade do dado. Você exporta tudo o que é seu, ou apaga a conta, quando quiser.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim. O PRO é uma assinatura sem fidelidade: cancela em Configurações e continua com o PRO até o fim do período já pago. Depois disso a conta volta pro gratuito com tudo que você criou; o que passa do limite fica guardado, só não dá pra criar novos até liberar espaço.',
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
