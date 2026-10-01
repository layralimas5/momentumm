import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * Prova social, só com o que dá pra comprovar.
 *
 * A seção existe na ordem da página, mas só aparece quando houver
 * depoimento real: mensagem, vídeo ou texto de quem usou, com nome e
 * contexto, e com a autorização da pessoa. Depoimento inventado é
 * identificado rápido e derruba a confiança no resto da página, então a
 * lista começa vazia e a seção some até o primeiro entrar.
 *
 * Pra publicar um depoimento, é só acrescentar aqui. Número (usuários,
 * avaliação) entra do mesmo jeito: só quando for verificável.
 */
interface Testimonial {
  readonly quote: string
  readonly name: string
  /** Quem é e o que estava tentando fazer: "estudante, prova da OAB em março". */
  readonly context: string
}

const TESTIMONIALS: readonly Testimonial[] = []

export function SocialProof() {
  if (TESTIMONIALS.length === 0) return null

  return (
    <Section id="quem-usa" className="border-t border-line bg-surface/30">
      <SectionHeading eyebrow="Quem já usa" title="O que diz quem já começou." />

      <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((item, index) => (
          <li key={item.name}>
            <Reveal delay={index * 0.06} className="h-full">
              <figure className="flex h-full flex-col rounded-card border border-line bg-surface p-6">
                <blockquote className="flex-1 text-pretty text-ink">“{item.quote}”</blockquote>
                <figcaption className="mt-5 text-sm">
                  <span className="block font-medium text-ink">{item.name}</span>
                  <span className="text-ink-muted">{item.context}</span>
                </figcaption>
              </figure>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  )
}
