import { useState } from 'react'
import type { AgendaItem, DayAgenda } from '@/domain/entities/day-agenda'
import type { RecoveryState, RecoveryStep } from '@/domain/entities/recovery'
import { routineRecurrenceLabel, type RoutineItem } from '@/domain/entities/routine-item'
import { StatusTag } from '@/presentation/components/ds/Badges'
import { Card, Eyebrow, IconWell, SectionHeader } from '@/presentation/components/ds/Card'
import { ProgressRing } from '@/presentation/components/ds/Progress'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { formatMinutes, xpOf } from '@/presentation/today/day-items'
import { currentKey, useClock } from '@/presentation/today/DayTimeline'
import { cn } from '@/shared/lib/cn'

export function RoutineHero({ agenda }: { readonly agenda: DayAgenda }) {
  const pct = Math.round(agenda.ratio * 100)

  return (
    <Card aria-labelledby="rotina-hero" className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <Eyebrow dot>Protocolo de execução</Eyebrow>
        <h2 id="rotina-hero" className="mt-2 text-[1.35rem] leading-tight font-semibold tracking-tight text-ink">
          Rotina &amp; Foco Adaptativo
        </h2>
        <p className="mt-1 text-sm text-ink-muted tabular">
          {agenda.empty
            ? 'Nada programado pra hoje'
            : `${agenda.done} de ${agenda.total} ${agenda.total === 1 ? 'bloco concluído' : 'blocos concluídos'} hoje`}
        </p>
        {agenda.empty ? null : (
          <span className="well mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink-muted tabular">
            <Icon name="escudo" className="size-3.5 text-brand-hi" />
            {pct}% do ritmo protegido
          </span>
        )}
      </div>
      <ProgressRing value={agenda.ratio} label={`${pct}% da rotina de hoje`} size={104}>
        <span className="block text-2xl font-bold text-ink tabular">{pct}%</span>
        <span className="eyebrow block text-[0.6rem] text-ink-faint">Meta</span>
      </ProgressRing>
    </Card>
  )
}

function AdjustOption({
  icon,
  title,
  tag,
  description,
  onClick,
  active = false,
  disabled = false,
}: {
  readonly icon: IconName
  readonly title: string
  readonly tag: string
  readonly description: string
  readonly onClick: () => void
  readonly active?: boolean
  readonly disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'card-float press w-full rounded-[1.4rem] p-4 text-left disabled:opacity-55',
        active && 'ring-2 ring-brand/40',
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon name={icon} className="size-5 text-brand-hi" />
        <span className="min-w-0 flex-1 text-[0.98rem] leading-tight font-semibold text-ink">{title}</span>
        <StatusTag tone="brand">{tag}</StatusTag>
      </span>
      <span className="mt-1.5 block text-sm leading-relaxed text-pretty text-ink-faint">{description}</span>
    </button>
  )
}

/** "Ajuste dinâmico de energia": as duas saídas pra dia que saiu do eixo. */
export function EnergyAdjustCard({
  aiEnabled,
  lowEnergy,
  openBlocks,
  recovery,
  onLowEnergy,
  onUndoLowEnergy,
  onChooseRecovery,
  onAiRecovery,
}: {
  readonly aiEnabled: boolean
  readonly lowEnergy: boolean
  readonly openBlocks: number
  readonly recovery: RecoveryState | null
  readonly onLowEnergy: () => void
  readonly onUndoLowEnergy: () => void
  readonly onChooseRecovery: (step: RecoveryStep) => void
  readonly onAiRecovery: () => void
}) {
  const [recoveryOpen, setRecoveryOpen] = useState(false)

  return (
    <Card aria-labelledby="ajuste-energia">
      <div className="flex items-center gap-2.5">
        <IconWell name="ia" />
        <h2 id="ajuste-energia" className="eyebrow min-w-0 flex-1 text-[0.75rem] text-ink">
          Ajuste dinâmico de energia
        </h2>
        {aiEnabled ? <StatusTag tone="brand">AI Ativa</StatusTag> : null}
      </div>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-pretty text-ink-muted">
        O dia ficou pesado ou imprevistos aconteceram? Recalibre o ritmo sem culpa nem quebra de sequência.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <AdjustOption
          icon="bateria"
          title={lowEnergy ? 'Modo sem energia ativo' : 'Hoje estou sem energia'}
          tag={lowEnergy ? 'Ativo' : 'Versão mínima'}
          description={
            lowEnergy
              ? 'O dia está na versão mínima. Toque pra voltar ao ritmo normal.'
              : `Reduz ${openBlocks > 1 ? `os ${openBlocks} blocos abertos` : 'o dia'} ao essencial pra blindar o ritmo e descansar em paz.`
          }
          active={lowEnergy}
          onClick={lowEnergy ? onUndoLowEnergy : onLowEnergy}
        />
        <AdjustOption
          icon="retomar"
          title="Modo Retomada"
          tag="Zero Atrito"
          description={
            recovery
              ? 'Ficou uns dias fora? Reorganiza tudo em uma microação pra reativar o hábito.'
              : 'Você está em dia. Quando ficar uns dias fora, ele reorganiza tudo em uma microação.'
          }
          disabled={!recovery}
          onClick={() => setRecoveryOpen(true)}
        />
      </div>

      <BottomSheet
        open={recoveryOpen && recovery !== null}
        title="Modo Retomada"
        description={recovery?.headline ?? ''}
        onClose={() => setRecoveryOpen(false)}
      >
        <div className="flex flex-col gap-1">
          {recovery?.steps.map((step) => (
            <SheetAction
              key={step.id}
              icon={<Icon name={step.kind === 'habito' ? 'habitos' : 'raio'} className="size-5" />}
              label={step.minimal && step.minimalTitle ? step.minimalTitle : step.title}
              hint={`${formatMinutes(step.minutes)}${step.objectiveTitle ? ` · ${step.objectiveTitle}` : ''}`}
              onClick={() => {
                setRecoveryOpen(false)
                onChooseRecovery(step)
              }}
            />
          ))}
          {aiEnabled ? (
            <SheetAction
              icon={<Icon name="ia" className="size-5" />}
              label="Criar plano de retorno com a IA"
              hint="Até três passos pequenos, lidos do teu plano"
              tone="brand"
              onClick={() => {
                setRecoveryOpen(false)
                onAiRecovery()
              }}
            />
          ) : null}
        </div>
      </BottomSheet>
    </Card>
  )
}

function rowTag(item: AgendaItem, suggestedKey: string | null) {
  if (item.key === suggestedKey) return <StatusTag tone="brand">Sugerido</StatusTag>
  const xp = xpOf({ kind: item.kind, isMainPriority: item.isMainPriority })
  if (xp) return <StatusTag tone={item.done ? 'neutral' : 'brand'}>+{xp} XP</StatusTag>
  return item.minutes ? <StatusTag>{formatMinutes(item.minutes)}</StatusTag> : null
}

/** A linha do tempo da Rotina: tudo do dia, um card por bloco, a caixa à esquerda. */
export function RoutineTimeline({
  agenda,
  busyKey,
  onToggle,
  onOpen,
  dateLabel,
}: {
  readonly agenda: DayAgenda
  readonly busyKey: string | null
  readonly onToggle: (item: AgendaItem) => void
  readonly onOpen: (item: AgendaItem) => void
  readonly dateLabel: string
}) {
  const clock = useClock()
  const nowKey = currentKey(agenda.items, clock)
  const suggestedKey =
    nowKey ?? agenda.items.find((item) => !item.done && !item.skipped && (item.time ?? '99') >= clock)?.key ?? null

  return (
    <section aria-labelledby="linha-do-tempo" className="flex flex-col gap-3">
      <SectionHeader id="linha-do-tempo" title="Linha do tempo" icon="tendencia" caps aside={dateLabel} />
      {agenda.empty ? (
        <p className="well rounded-[1.4rem] px-4 py-6 text-center text-sm text-ink-muted">
          Nada programado hoje. Descanso também é organização.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {agenda.items.map((item) => {
            const resolved = item.done || item.skipped
            return (
              <li key={item.key} className="card flex items-center gap-3 rounded-[1.4rem] px-3 py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.done}
                  disabled={busyKey === item.key}
                  onClick={() => onToggle(item)}
                  className="tap-target grid size-10 shrink-0 place-items-center rounded-full"
                >
                  <span
                    className={cn(
                      'grid size-7 place-items-center rounded-full border-2 transition-colors',
                      item.done ? 'border-brand bg-brand-dim text-brand-hi' : 'border-brand/50 text-transparent',
                    )}
                  >
                    <Icon name="check" className="size-3.5" strokeWidth={3} />
                  </span>
                  <span className="sr-only">{item.done ? `Desmarcar ${item.title}` : `Concluir ${item.title}`}</span>
                </button>
                <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 py-1 text-left">
                  <span
                    className={cn(
                      'block truncate text-[0.95rem] font-medium',
                      resolved ? 'text-ink-muted' : 'text-ink',
                    )}
                  >
                    {item.title}
                  </span>
                  <span className="block text-xs text-ink-faint tabular">{item.time ?? 'Sem horário'}</span>
                </button>
                {rowTag(item, suggestedKey)}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** A rotina semanal em si: o que se repete, com editar e tirar. Fica recolhida. */
export function WeeklyRoutineCard({
  items,
  onEdit,
  onRemove,
}: {
  readonly items: readonly RoutineItem[]
  readonly onEdit: (item: RoutineItem) => void
  readonly onRemove: (item: RoutineItem) => void
}) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  const sorted = [...items].sort((a, b) => (a.timeOfDay ?? '99').localeCompare(b.timeOfDay ?? '99'))

  return (
    <Card className="p-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="press flex min-h-14 w-full items-center gap-3 rounded-[1.4rem] px-3 text-left"
      >
        <IconWell name="calendarioGrade" tone="muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.95rem] font-semibold text-ink">Rotina da semana</span>
          <span className="block text-xs text-ink-faint tabular">
            {items.length} {items.length === 1 ? 'bloco que se repete' : 'blocos que se repetem'}
          </span>
        </span>
        <Icon name={open ? 'acima' : 'abaixo'} className="size-4 text-ink-faint" />
      </button>
      {open ? (
        <ul className="px-2 pb-2">
          {sorted.map((item) => (
            <li key={item.id} className="flex items-center gap-2 border-t border-line py-2 first:border-t-0">
              <span className="w-12 shrink-0 text-xs text-ink-faint tabular">{item.timeOfDay ?? '—'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                <span className="block truncate text-xs text-ink-faint">{routineRecurrenceLabel(item)}</span>
              </span>
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="grid size-10 place-items-center rounded-full text-ink-faint hover:text-ink"
              >
                <Icon name="editar" className="size-4" />
                <span className="sr-only">Editar {item.title}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="grid size-10 place-items-center rounded-full text-ink-faint hover:text-danger"
              >
                <Icon name="lixeira" className="size-4" />
                <span className="sr-only">Tirar {item.title} da rotina</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
