import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * A objeção real de rede social nova é "vou entrar e não vai ter ninguém".
 * A regra de ouro do produto responde isso — o app entrega valor com uma
 * pessoa só usando — então ela vira argumento de página, não só de arquitetura.
 */
const ALONE = [
  'Sequência atual e recorde pessoal',
  'Metas por dia, semana ou mês somando sozinhas',
  'Histórico agrupado por dia e por área',
  'Estatísticas do seu ritmo real',
] as const

const TOGETHER = [
  'Feed de quem você escolheu seguir',
  'Incentivo na hora em que você registra',
  'Cada registro é público, só pra seguidores ou privado',
] as const

export function SoloFirst() {
  return (
    <Section id="sozinho">
      <SectionHeading
        eyebrow="Sem depender de ninguém"
        title="Funciona no primeiro dia, com você sozinho."
        description="Feed vazio afasta gente. Por isso a parte social do Momentumm é camada, não requisito: ela entra quando você quiser, e o app já era útil antes disso."
      />

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Reveal>
          <Panel
            title="Você sozinho, desde o primeiro registro"
            items={ALONE}
            highlighted
          />
        </Reveal>
        <Reveal delay={0.1}>
          <Panel title="Quando quiser, com gente junto" items={TOGETHER} badge="No PRO" />
        </Reveal>
      </div>

      <Reveal delay={0.2}>
        <p className="mx-auto mt-8 max-w-2xl text-balance text-center text-sm text-ink-muted">
          Quem vê o que você registra é escolha sua, registro por registro. A regra roda no banco
          de dados, não só na tela.
        </p>
      </Reveal>
    </Section>
  )
}

function Panel({
  title,
  items,
  highlighted = false,
  badge,
}: {
  title: string
  items: readonly string[]
  highlighted?: boolean
  /** A camada social é do PRO. Dizer isso aqui evita a surpresa no card de preço. */
  badge?: string
}) {
  return (
    <div
      className={
        highlighted
          ? 'h-full rounded-card border border-brand/40 bg-brand-dim/25 p-6'
          : 'h-full rounded-card border border-line bg-surface p-6'
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-ink">{title}</h3>
        {badge ? (
          <a
            href="#pro"
            className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-ink-muted transition-colors hover:border-line-hi hover:text-ink"
          >
            {badge}
          </a>
        ) : null}
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-ink-muted">
            <CheckIcon highlighted={highlighted} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CheckIcon({ highlighted }: { highlighted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={highlighted ? 'mt-0.5 size-4 shrink-0 text-brand-hi' : 'mt-0.5 size-4 shrink-0 text-ink-faint'}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  )
}
