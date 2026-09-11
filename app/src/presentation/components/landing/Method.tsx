import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O ciclo do produto, na ordem em que ele roda. Os ícones são os mesmos da
 * navegação do app: a pessoa vê aqui o que vai encontrar na barra lateral.
 */
interface Step {
  readonly icon: IconName
  readonly title: string
  readonly description: string
  readonly detail: string
}

const STEPS: readonly Step[] = [
  {
    icon: 'objetivo',
    title: 'Objetivo',
    description: 'O que você quer alcançar, com alvo e prazo.',
    detail: 'Ninguém acorda querendo "meditação". Você diz o que quer mudar, com as suas palavras.',
  },
  {
    icon: 'plano',
    title: 'Plano',
    description: 'Etapas com peso, que somam 100% do objetivo.',
    detail: 'Cada etapa tem data e ações. O plano nunca finge que cabe: se o prazo não fecha, ele avisa antes de salvar.',
  },
  {
    icon: 'hoje',
    title: 'Ações do Hoje',
    description: 'Uma prioridade principal por dia, com versão mínima.',
    detail: 'O check-in define quanta capacidade você tem hoje, e o dia se ajusta a isso. Dia ruim não é dia perdido.',
  },
  {
    icon: 'progresso',
    title: 'Progresso',
    description: 'Quanto do objetivo andou de verdade, e onde travou.',
    detail: 'A conta sobe pela hierarquia: ação, etapa, objetivo. O app aponta o gargalo e prevê quando fecha no ritmo atual.',
  },
  {
    icon: 'calendario',
    title: 'Review',
    description: 'A semana em números, onde evoluiu e onde o ritmo caiu.',
    detail: 'Sem padrão detectado, o review não escreve nada. Nada de frase motivacional pra preencher espaço.',
  },
  {
    icon: 'insights',
    title: 'Ajuste',
    description: 'Cada leitura vem com o botão que a resolve.',
    detail: 'Reduzir, reagendar, trazer pra hoje. O ajuste entra no plano e o ciclo recomeça, mais perto do seu dia real.',
  },
]

export function Method() {
  return (
    <Section id="metodo" className="border-t border-line">
      <SectionHeading
        eyebrow="O método"
        title="Um ciclo, não uma coleção de recursos."
        description="Objetivo, plano, dia, progresso, review e ajuste são a mesma coisa vista de seis ângulos. É por isso que um número nunca aparece diferente em duas telas."
      />

      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.06} className="h-full">
            <li className="group relative flex h-full flex-col rounded-card border border-line bg-surface p-6 transition-colors hover:border-line-hi">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-dim text-brand-hi">
                  <Icon name={step.icon} className="size-5" />
                </span>
                <span className="tabular text-sm text-ink-faint">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {index < STEPS.length - 1 ? (
                  <ArrowIcon className="ml-auto hidden text-ink-faint lg:block" />
                ) : (
                  <LoopIcon className="ml-auto hidden text-brand-hi lg:block" />
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-1 text-pretty text-sm font-medium text-ink-muted">{step.description}</p>
              <p className="mt-3 text-pretty text-sm text-ink-faint">{step.detail}</p>
            </li>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={0.3}>
        <p className="mx-auto mt-10 max-w-2xl text-balance text-center text-sm text-ink-muted">
          Depois do ajuste, o ciclo volta pro objetivo. O plano que você tem no dia 30 não é o
          que a motivação montou no dia 1: é o que a sua semana real mostrou que funciona.
        </p>
      </Reveal>
    </Section>
  )
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-4 ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function LoopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-4 ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" />
    </svg>
  )
}
