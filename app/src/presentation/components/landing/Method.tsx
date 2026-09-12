import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O ciclo do produto como linha do tempo: um passo embaixo do outro, cada
 * um do lado oposto ao anterior, ligados por uma linha que sai do objetivo
 * e volta pra ele no fim. Os ícones são os mesmos da navegação do app: a
 * pessoa vê aqui o que vai encontrar na barra lateral.
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
    detail:
      'Cada etapa tem data e ações. O plano nunca finge que cabe: se o prazo não fecha, ele avisa antes de salvar.',
  },
  {
    icon: 'hoje',
    title: 'Ações do Hoje',
    description: 'Uma prioridade principal por dia, com versão mínima.',
    detail:
      'O check-in define quanta capacidade você tem hoje, e o dia se ajusta a isso. Dia ruim não é dia perdido.',
  },
  {
    icon: 'progresso',
    title: 'Progresso',
    description: 'Quanto do objetivo andou de verdade, e onde travou.',
    detail:
      'A conta sobe pela hierarquia: ação, etapa, objetivo. O app aponta o gargalo e prevê quando fecha no ritmo atual.',
  },
  {
    icon: 'calendario',
    title: 'Review',
    description: 'A semana em números, onde evoluiu e onde o ritmo caiu.',
    detail:
      'Sem padrão detectado, o review não escreve nada. Nada de frase motivacional pra preencher espaço.',
  },
  {
    icon: 'insights',
    title: 'Ajuste',
    description: 'Cada leitura vem com o botão que a resolve.',
    detail:
      'Reduzir, reagendar, trazer pra hoje. O ajuste entra no plano e o ciclo recomeça, mais perto do seu dia real.',
  },
]

export function Method() {
  return (
    <Section id="metodo" className="relative overflow-hidden border-t border-line">
      {/* Fecha o brilho que abriu nos depoimentos: a mesma luz, agora descendo do topo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(70%_100%_at_50%_0%,rgb(136_120_255_/_0.45),transparent_70%)]"
      />
      <SectionHeading
        eyebrow="O método"
        title="Um ciclo, não uma coleção de recursos."
        description="Objetivo, plano, dia, progresso, review e ajuste são a mesma coisa vista de seis ângulos. É por isso que um número nunca aparece diferente em duas telas."
      />

      <ol className="relative mx-auto mt-14 max-w-4xl">
        {/* A linha: na esquerda no celular, no centro no desktop. */}
        <div
          aria-hidden="true"
          className="absolute bottom-6 left-6 top-6 w-px bg-gradient-to-b from-brand-hi via-brand/60 to-brand-hi md:left-1/2 md:-translate-x-1/2"
        />

        {STEPS.map((step, index) => {
          const right = index % 2 === 1
          return (
            <li key={step.title} className="relative pb-10 md:pb-6">
              <Reveal
                delay={0.05}
                className={cn(
                  'relative flex gap-5 pl-16 md:w-1/2 md:pl-0',
                  right ? 'md:ml-auto md:pl-14' : 'md:pr-14 md:text-right',
                )}
              >
                {/* Nó numerado em cima da linha. */}
                <span
                  className={cn(
                    'absolute top-1 grid size-12 -translate-x-1/2 place-items-center rounded-full border border-brand/50 bg-canvas text-brand-hi shadow-glow',
                    'left-6 md:translate-x-0',
                    right ? 'md:-left-6' : 'md:left-auto md:-right-6',
                  )}
                >
                  <Icon name={step.icon} className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="tabular text-xs font-medium tracking-wide text-brand-hi uppercase">
                    Passo {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-1.5 text-xl font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-pretty text-sm font-medium text-ink-muted">
                    {step.description}
                  </p>
                  <p className="mt-2 text-pretty text-sm text-ink-faint">{step.detail}</p>
                </div>
              </Reveal>
            </li>
          )
        })}

        {/* Fechamento do ciclo: a linha volta pro objetivo. */}
        <li className="relative mt-10 pl-16 md:flex md:flex-col md:items-center md:pl-0 md:text-center">
          <span
            aria-hidden="true"
            className="absolute left-6 top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-white md:static md:translate-x-0 md:translate-y-0"
          >
            <LoopIcon className="size-4" />
          </span>
          <Reveal>
            <p className="text-pretty text-sm text-ink-muted md:mt-4 md:max-w-md">
              Depois do ajuste, o ciclo volta pro objetivo. O plano do dia 30 não é o que a
              motivação montou no dia 1: é o que a sua semana real mostrou que funciona.
            </p>
          </Reveal>
        </li>
      </ol>
    </Section>
  )
}

function LoopIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" />
    </svg>
  )
}
