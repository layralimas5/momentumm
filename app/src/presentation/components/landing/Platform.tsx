import type { ReactNode } from 'react'
import { QUIZ_QUESTION_COUNT } from '@/domain/entities/quiz'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O produto por dentro, um bloco por função principal.
 *
 * A ordem segue a dor da seção anterior: primeiro o plano que cabe no tempo
 * (o plano da segunda-feira), depois o dia que encolhe e a volta sem culpa
 * (o dia ruim e a volta depois de sumir), por último a constância à vista.
 * Cada bloco diz o que a função resolve no dia da pessoa e mostra a tela de
 * verdade, capturada do app em modo demo, sem dado de ninguém.
 *
 * Só entra aqui o que roda pra qualquer conta. O que é do PRO fica na seção
 * seguinte, pra esta não virar lista de recursos.
 */
interface Block {
  readonly title: string
  readonly description: string
  readonly media: ReactNode
}

const BLOCKS: readonly Block[] = [
  {
    title: `Responda ${QUIZ_QUESTION_COUNT} perguntas, receba o plano`,
    description: 'Objetivo, prazo e quanto tempo você tem de verdade. Em menos de 2 minutos a meta vira etapas com prazo e uma rotina que cabe na sua semana, antes de você criar conta.',
    media: <Screen src="/telas/quiz-3s.webp" alt="Primeira pergunta do quiz do Momentumm: em qual área você quer avançar primeiro." />,
  },
  {
    title: 'Abra e saiba o que fazer hoje',
    description:
      'O passo do dia já está na tela Hoje. Sobraram 20 minutos? Ele encolhe pra versão mínima e o dia ainda conta. Sumiu uns dias? Você volta de onde parou, sem compensar nada.',
    media: (
      <Screen
        src="/telas/hoje-3s.webp"
        alt="Tela Hoje do Momentumm: o Momentum Score da semana, a prioridade de agora com o botão Iniciar Foco e a lista do dia."
      />
    ),
  },
  {
    title: 'Sua constância à vista',
    description:
      'O Momentumm Score mostra a sua constância dos últimos 28 dias: um dia ruim faz ele cair devagar, nunca zerar. E se quiser companhia, chame alguém pro Juntos e acompanhem o dia um do outro.',
    media: (
      <Screen
        src="/telas/progresso-3s.webp"
        alt="Tela Progresso do Momentumm: o Momentum Score com a curva dos últimos 30 dias e a semana com os dias consistentes."
      />
    ),
  },
]

export function Platform() {
  return (
    <Section id="plataforma" className="border-t border-line bg-surface/30">
      <SectionHeading
        eyebrow="O app por dentro"
        title="Conheça o Momentumm por dentro."
        description="Três telas fazem o caminho inteiro: da meta ao plano, do plano ao passo de hoje, e do passo à constância."
      />

      <ol className="mt-14 flex flex-col gap-16 sm:mt-20 sm:gap-24">
        {BLOCKS.map((block, index) => (
          <li
            key={block.title}
            className="grid items-center gap-8 md:grid-cols-2 md:gap-14"
          >
            <Reveal className={cn('md:px-4', index % 2 === 1 && 'md:order-2')}>
              <p className="tabular text-sm font-medium text-brand-hi">0{index + 1}</p>
              <h3 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-ink">
                {block.title}
              </h3>
              <p className="mt-3 max-w-md text-pretty text-ink-muted">{block.description}</p>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-10 top-1/2 h-56 -translate-y-1/2 rounded-full bg-brand/20 blur-3xl"
                />
                <div className="relative">{block.media}</div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/** Captura real do app, cortada no topo, que é onde fica o que a tela resolve. */
function Screen({ src, alt }: { readonly src: string; readonly alt: string }) {
  return (
    <figure className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[2.5rem] border border-line-hi bg-surface p-2.5 shadow-2xl shadow-black/40">
      <img
        src={src}
        alt={alt}
        width={780}
        height={1688}
        loading="lazy"
        decoding="async"
        className="block h-[540px] w-full rounded-[2rem] object-cover object-top"
      />
    </figure>
  )
}
