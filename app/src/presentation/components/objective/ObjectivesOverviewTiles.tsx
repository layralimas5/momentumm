import type { ObjectivesOverview } from '@/domain/entities/objectives-overview'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * A aba de Objetivos em três números.
 *
 * A lista responde "como está cada um". Ela nunca respondeu "como estou" — e
 * é essa a pergunta que faz alguém abrir a aba. Antes só dava pra responder
 * lendo três cards inteiros e somando de cabeça.
 *
 * São os MESMOS três tiles da tela Hoje, no mesmo formato. A repetição é
 * deliberada: é ela que faz o app parecer uma coisa só em vez de um conjunto
 * de telas que se parecem por acaso.
 */
export function ObjectivesOverviewTiles({ overview }: { readonly overview: ObjectivesOverview }) {
  if (overview.active === 0) return null

  const media = overview.averageRatio === null ? 0 : Math.round(overview.averageRatio * 100)
  const prazo = overview.nearestDeadline

  return (
    <section aria-label="Resumo dos objetivos" className="grid grid-cols-3 gap-2.5">
      <Tile
        icon="objetivo"
        tone={overview.behind > 0 ? 'warn' : 'brand'}
        label="Ativos"
        value={String(overview.active)}
        hint={overview.behind > 0 ? `${overview.behind} atrás do ritmo` : 'no ritmo'}
      />

      <Tile
        icon="progresso"
        tone="positive"
        label="Avanço"
        value={`${media}`}
        suffix="%"
        hint="média dos ativos"
      />

      <Tile
        icon="calendario"
        tone={prazo !== null && prazo <= 7 ? 'warn' : 'brand'}
        label="Prazo"
        value={prazo === null ? '-' : String(prazo)}
        suffix={prazo === null ? undefined : 'd'}
        hint={prazo === 0 ? 'fecha hoje' : 'o mais próximo'}
      />
    </section>
  )
}

function Tile({
  icon,
  tone,
  label,
  value,
  suffix,
  hint,
}: {
  readonly icon: IconName
  readonly tone: 'brand' | 'positive' | 'warn'
  readonly label: string
  readonly value: string
  readonly suffix?: string | undefined
  readonly hint: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3.5">
      <span className="flex items-center gap-1">
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-md',
            tone === 'positive'
              ? 'bg-positive/15 text-positive'
              : tone === 'warn'
                ? 'bg-flame-dim/60 text-flame'
                : 'bg-brand-dim/60 text-brand-ink',
          )}
        >
          <Icon name={icon} className="size-3" strokeWidth={2.25} />
        </span>
        <span className="truncate text-[0.6875rem] font-medium text-ink-muted">{label}</span>
      </span>

      <p className="tabular mt-2.5 text-3xl leading-none font-semibold tracking-tight text-ink">
        {value}
        {suffix ? <span className="text-lg text-ink-faint">{suffix}</span> : null}
      </p>

      <p className="mt-1.5 truncate text-[0.6875rem] text-ink-faint">{hint}</p>
    </div>
  )
}
