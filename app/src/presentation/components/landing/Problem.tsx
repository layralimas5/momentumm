import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O problema, antes do produto.
 *
 * Três cenas que a pessoa reconhece da própria semana, cada uma com o que
 * ela custa. A seção não fala do app: quem se reconhece numa cena chega na
 * próxima seção já sabendo o que procura nela. O "não é pra você" saiu
 * daqui e virou pergunta no FAQ, que é onde quem está avaliando procura.
 *
 * O tom é de constatação, não de drama: exagerar a dor soa desespero pra
 * quem está decidindo se paga todo mês.
 */
interface Scene {
  readonly title: string
  readonly description: string
  readonly cost: string
}

const SCENES: readonly Scene[] = [
  {
    title: 'O plano da segunda-feira',
    description:
      'Você começa com uma hora por dia e muita vontade. Na segunda semana a rotina aperta e o plano vai pra gaveta.',
    cost: 'Mais um recomeço, e o prazo da meta andando.',
  },
  {
    title: 'O dia que não sai como o planejado',
    description:
      'Sobraram 20 minutos e o plano pedia uma hora. Como não dá pra fazer tudo, você não faz nada.',
    cost: 'Um dia parado que vira uma semana parada.',
  },
  {
    title: 'A volta depois de sumir',
    description:
      'Você ficou uns dias fora. A sequência quebrou e voltar parece começar do zero, então você adia.',
    cost: 'A meta empurrada pro próximo janeiro.',
  },
]

export function Problem() {
  return (
    <Section id="problema">
      <SectionHeading
        eyebrow="O problema"
        title="Não falta força de vontade. Falta um plano que caiba no seu dia."
      />

      <ul className="mt-12 grid gap-4 md:grid-cols-3 md:gap-6">
        {SCENES.map((scene, index) => (
          <li key={scene.title}>
            <Reveal delay={index * 0.08} className="h-full">
              <article className="spotlight flex h-full flex-col rounded-card border border-line bg-surface p-6">
                <h3 className="font-semibold text-ink">{scene.title}</h3>
                <p className="mt-2 flex-1 text-pretty text-sm text-ink-muted">{scene.description}</p>
                <p className="mt-5 border-t border-line pt-4 text-sm text-ink">
                  <span className="text-ink-faint">O custo: </span>
                  {scene.cost}
                </p>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  )
}
