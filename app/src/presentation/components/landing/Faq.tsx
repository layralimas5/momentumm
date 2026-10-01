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
 * As objeções de quem já quer, mas ainda não confia: "já tentei e larguei",
 * "não tenho tempo", "minha meta serve?", "minha rotina muda", "já uso outro
 * app", quanto custa, e as de risco (teste, privacidade, cancelamento). É a
 * última coisa que a pessoa lê antes de decidir, por isso as respostas cabem
 * em duas frases.
 *
 * Trial, cobrança, privacidade e cancelamento só afirmam o que está
 * implementado. A pergunta do teste some junto com a promessa quando
 * `TRIAL_PROMISE_VERIFIED` está desligada.
 */
const BASE: readonly Question[] = [
  {
    question: 'Já tentei app de metas e larguei. Por que esse seria diferente?',
    answer:
      'Porque ele foi feito pro dia em que você falha. Com pouco tempo, o passo de hoje encolhe pra versão mínima; depois de dias parados, você volta de onde parou e o Momentumm Score não zera.',
  },
  {
    question: 'Não tenho tempo pra planejar nada.',
    answer:
      'Você não planeja: responde o quiz e o plano sai pronto, por etapas e do tamanho do tempo que você tem. Depois é abrir o app e fazer um passo por dia.',
  },
  {
    question: 'Quanto tempo por dia eu preciso ter?',
    answer:
      'A partir de 10 minutos. O quiz pergunta quanto você tem de verdade (10, 20, 30 minutos, uma hora ou "depende do dia") e o plano sai desse tamanho. Em dia apertado, vale a versão mínima.',
  },
  {
    question: 'Serve pra que tipo de meta?',
    answer:
      'Pra meta pessoal com prazo: ler mais, estudar pra uma prova, treinar, meditar, tirar um projeto do papel. Cada objetivo vira etapas, ações e hábitos no mesmo lugar.',
  },
  {
    question: 'E se a minha rotina mudar no meio do caminho?',
    answer:
      'O plano muda junto. Você ajusta prazo e ritmo quando quiser, e o Dia Adaptável encolhe o passo em dia apertado. No PRO, a Momentumm AI lê o seu progresso e sugere o ajuste pronto pra aplicar.',
  },
  {
    question: 'Já uso um app de hábitos. Por que trocar?',
    answer:
      'App de hábito conta repetição. O Momentumm liga cada hábito a um objetivo com prazo e diz qual passo empurra a meta hoje. E um dia perdido não zera o seu progresso.',
  },
  {
    question: 'Preciso usar a parte social?',
    answer:
      'Não. O app funciona inteiro com uma pessoa só: plano, dia, Score e review. Chamar alguém pro Juntos é opcional, e tudo o que você registra nasce privado.',
  },
  {
    question: 'Preciso instalar alguma coisa?',
    answer:
      'Não. O Momentumm roda no navegador do celular e do computador. Se quiser, dá pra adicionar à tela inicial e abrir como um app.',
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
