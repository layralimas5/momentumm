import { QUIZ_QUESTION_COUNT } from '@/domain/entities/quiz'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * Do clique ao primeiro passo, com as telas de verdade.
 *
 * Enquanto não houver depoimento real (a regra do projeto proíbe inventar),
 * a prova que a página pode dar é o produto funcionando: capturas do app, sem
 * montagem, com dado de exemplo. Quando o front mudar, basta trocar os
 * arquivos em `/telas`.
 *
 * No celular os passos viram um carrossel com snap, pra três telas altas não
 * empurrarem o preço pra longe.
 */
interface Step {
  readonly title: string
  readonly description: string
  readonly screen: string
  readonly screenLabel: string
}

const STEPS: readonly Step[] = [
  {
    title: `Responda ${QUIZ_QUESTION_COUNT} perguntas`,
    description:
      'Objetivo, prazo e o tempo que você tem de verdade. Menos de 2 minutos, e o plano aparece antes de você criar conta.',
    screen: '/telas/quiz.webp',
    screenLabel: 'Primeira pergunta do quiz',
  },
  {
    title: 'Receba o plano por etapas',
    description:
      'A meta vira três marcos com prazo, uma rotina que cabe na sua semana e o primeiro passo de hoje.',
    screen: '/telas/plano.webp',
    screenLabel: 'Plano gerado pelo quiz',
  },
  {
    title: 'Veja a constância subir',
    description:
      'O Momentumm Score mostra se o ritmo está de pé. Dia ruim faz o número cair devagar, nunca zerar.',
    screen: '/telas/progresso.webp',
    screenLabel: 'Tela Progresso, com o Momentumm Score',
  },
]

export function HowItWorks() {
  return (
    <Section id="como-funciona" className="border-t border-line">
      <SectionHeading
        eyebrow="Como funciona"
        title="Da meta ao primeiro passo em menos de 2 minutos."
        description="Sem planilha, sem montar nada do zero. Estas são telas reais do app."
      />

      {/* Focável porque no celular é uma região com rolagem própria: sem isso o teclado não chega no passo 3. */}
      <ol
        tabIndex={0}
        aria-label="Os três passos"
        className="-mx-4 mt-12 flex rounded-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0">
        {STEPS.map((step, index) => (
          <li key={step.title} className="w-[78%] shrink-0 snap-center sm:w-[46%] md:w-auto">
            <Reveal delay={index * 0.08} className="flex h-full flex-col">
              <figure className="overflow-hidden rounded-card border border-line-hi bg-surface shadow-2xl shadow-black/30">
                <img
                  src={step.screen}
                  alt={step.screenLabel}
                  width={780}
                  height={1688}
                  loading="lazy"
                  decoding="async"
                  className="block aspect-[4/5] h-auto w-full object-cover object-top"
                />
              </figure>
              <p className="mt-5 text-sm font-medium text-brand-hi">Passo {index + 1}</p>
              <h3 className="mt-1 font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-pretty text-sm text-ink-muted">{step.description}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  )
}
