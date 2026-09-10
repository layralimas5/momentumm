import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * A página abria vendendo solução, sem nomear a dor. Esta seção existe pra
 * dizer o inimigo em voz alta antes de qualquer recurso aparecer: o esforço
 * está espalhado, e o que está espalhado não acumula.
 */
const SILOS = [
  { where: 'no leitor digital', what: 'O livro que você leu' },
  { where: 'no relógio', what: 'O treino de terça' },
  { where: 'na plataforma do curso', what: 'As horas de estudo' },
  { where: 'em mais um app', what: 'Os dez minutos de meditação' },
] as const

export function Problem() {
  return (
    <Section id="problema" className="border-t border-line">
      <SectionHeading
        eyebrow="O problema"
        title="Você fez muita coisa esse ano. Só não dá pra ver."
        description="Não é falta de disciplina. É que cada coisa que você faz pra evoluir mora num lugar diferente, e nenhum deles conversa com o outro."
      />

      <ul className="mt-12 grid gap-3 sm:grid-cols-2">
        {SILOS.map((silo, index) => (
          <Reveal key={silo.what} delay={index * 0.06}>
            <li className="flex h-full items-baseline gap-2 rounded-card border border-line border-dashed bg-surface/40 px-5 py-4">
              <span className="text-ink">{silo.what}</span>
              <span aria-hidden="true" className="flex-1 border-b border-dashed border-line-hi" />
              <span className="shrink-0 text-sm text-ink-faint">{silo.where}</span>
            </li>
          </Reveal>
        ))}
      </ul>

      <Reveal delay={0.24}>
        <p className="mx-auto mt-10 max-w-2xl text-balance text-center text-lg text-ink-muted">
          Quatro históricos pela metade e nenhuma resposta pra pergunta que importa:{' '}
          <span className="text-ink">o que eu construí nos últimos doze meses?</span>
        </p>
      </Reveal>
    </Section>
  )
}
