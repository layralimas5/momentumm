import { ACTIVITY_TYPE_LIST } from '@/domain/entities/activity-type'
import { cn } from '@/shared/lib/cn'
import { MockCard, MockHeader, PhoneMockup } from './PhoneMockup'
import { Reveal } from './Reveal'
import { Section } from './Section'

interface FeatureProps {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly bullets: readonly string[]
  readonly mockup: React.ReactNode
  readonly flip?: boolean
}

function Feature({ eyebrow, title, description, bullets, mockup, flip = false }: FeatureProps) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={cn(flip && 'lg:order-2')}>
        <div>
          <p className="text-sm font-medium tracking-wide text-brand-hi uppercase">{eyebrow}</p>
          <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {title}
          </h3>
          <p className="mt-4 text-pretty text-ink-muted">{description}</p>
          <ul className="mt-6 flex flex-col gap-3">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3 text-sm text-ink">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-positive"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={0.1} className={cn(flip && 'lg:order-1')}>
        {mockup}
      </Reveal>
    </div>
  )
}

export function FeatureShowcase() {
  return (
    <Section id="eixos" className="border-t border-line">
      <div className="flex flex-col gap-24 sm:gap-32">
        <Feature
          eyebrow="Registro"
          title="Dez segundos entre o que você fez e o registro"
          description="O registro é o gargalo de todo app de hábito. Se dá trabalho, ninguém volta na segunda semana. Aqui são dois toques: o eixo e o valor."
          bullets={[
            'Valores sugeridos por eixo, do jeito que a pessoa mede na vida real',
            'Página, minuto ou qualquer unidade que faça sentido pro eixo',
            'Nota opcional pra lembrar o que aquele dia teve de diferente',
          ]}
          mockup={
            <PhoneMockup>
              <MockHeader title="Registrar agora" subtitle="Escolhe o eixo e o valor." />
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_TYPE_LIST.map((type, index) => (
                  <span
                    key={type.slug}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px]',
                      index === 0 ? 'border-transparent text-canvas' : 'border-line text-ink-muted',
                    )}
                    style={index === 0 ? { backgroundColor: type.colorToken } : undefined}
                  >
                    {type.label}
                  </span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {['10 pág', '20 pág', '30 pág', '50 pág'].map((label, index) => (
                  <span
                    key={label}
                    className={cn(
                      'rounded-xl border py-3 text-center text-sm',
                      index === 1
                        ? 'border-brand bg-brand-dim text-ink'
                        : 'border-line bg-surface-hi text-ink',
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-positive">leu 20 páginas. Registrado.</p>
            </PhoneMockup>
          }
        />

        <Feature
          flip
          eyebrow="Sequência"
          title="A constância aparece na tela antes de aparecer na vida"
          description="Uma linha de sete dias mostra onde você esteve inteiro e onde falhou. É o retorno diário que faz voltar amanhã, sem culpa e sem sermão."
          bullets={[
            'Sequência atual e recorde pessoal lado a lado',
            'Aviso quando o dia está por um fio, não depois de perder',
            'Sequência geral e por eixo, pra quem quer focar em um só',
          ]}
          mockup={
            <PhoneMockup>
              <MockHeader title="Sequência" subtitle="Seu recorde: 24 dias." />
              <MockCard>
                <div className="flex items-baseline gap-2">
                  <span className="tabular text-4xl font-semibold text-ink">18</span>
                  <span className="text-sm text-ink-muted">dias seguidos</span>
                </div>
                <div className="mt-4 flex gap-1">
                  {[1, 1, 0, 1, 1, 1, 1].map((done, index) => (
                    <span
                      key={index}
                      className={cn(
                        'h-8 flex-1 rounded-md',
                        done ? 'bg-brand' : 'border border-line bg-surface-hi',
                      )}
                    />
                  ))}
                </div>
                <p className="mt-3 rounded-lg border border-flame/30 bg-flame-dim/60 px-2.5 py-2 text-[11px] text-ink">
                  Registra qualquer coisa hoje pra não perder a sequência.
                </p>
              </MockCard>
              <MockCard className="mt-3">
                <p className="text-[10px] uppercase tracking-wide text-ink-muted">Este mês</p>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {Array.from({ length: 28 }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'aspect-square rounded-sm',
                        index % 5 === 3 ? 'bg-surface-hi' : 'bg-brand/70',
                      )}
                    />
                  ))}
                </div>
              </MockCard>
            </PhoneMockup>
          }
        />

        <Feature
          eyebrow="Metas e evolução"
          title="Vontade vira número, número vira histórico"
          description="Meta por dia, semana ou mês em qualquer eixo. E todo registro entra numa linha do tempo que você pode olhar daqui a um ano."
          bullets={[
            'Uma meta ativa por eixo e período, pra não competir consigo mesma',
            'Progresso somando sozinho conforme você registra',
            'Histórico agrupado por dia, com filtro por eixo',
          ]}
          mockup={
            <PhoneMockup>
              <MockHeader title="Metas" subtitle="Duas ativas." />
              {[
                { label: 'Leitura', value: '26 de 20 páginas', percent: 100, done: true },
                { label: 'Treino', value: '90 de 150 minutos', percent: 60, done: false },
                { label: 'Estudo', value: '180 de 300 minutos', percent: 60, done: false },
              ].map((goal) => (
                <MockCard key={goal.label} className="mt-3 first:mt-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">{goal.label}</span>
                    <span className={cn('tabular', goal.done ? 'text-positive' : 'text-ink-muted')}>
                      {goal.value}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hi">
                    <span
                      className={cn(
                        'block h-full rounded-full',
                        goal.done ? 'bg-positive' : 'bg-brand',
                      )}
                      style={{ width: `${goal.percent}%` }}
                    />
                  </div>
                </MockCard>
              ))}
              <p className="mt-5 text-[10px] uppercase tracking-wide text-ink-muted">Hoje</p>
              {['Leitura · leu 26 páginas', 'Meditação · meditou 10 minutos'].map((row) => (
                <p key={row} className="border-b border-line py-2.5 text-xs text-ink last:border-0">
                  {row}
                </p>
              ))}
            </PhoneMockup>
          }
        />
      </div>
    </Section>
  )
}
