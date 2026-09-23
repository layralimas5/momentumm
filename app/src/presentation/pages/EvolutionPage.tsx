import { motion, useReducedMotion } from 'framer-motion'
import { formatDayLabel, formatDayLong } from '@/domain/entities/day'
import {
  ACHIEVEMENT_CATEGORY_LABELS,
  transactionLabel,
  UNLOCK_KIND_LABELS,
  type AchievementView,
  type EvolutionSummary,
  type UnlockView,
  type XpTransaction,
} from '@/domain/entities/evolution'
import { AiCoachPanel } from '@/presentation/ai/AiCoachPanel'
import { useAi } from '@/presentation/ai/use-ai'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { AchievementMedal } from '@/presentation/evolution/AchievementMedal'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Stat, StatGrid } from '@/presentation/components/ui/Stat'
import { Panel, PanelHeader, Tag } from '@/presentation/components/ui/Surface'
import { formatXp, LevelCard } from '@/presentation/evolution/LevelCard'
import { useEvolution } from '@/presentation/evolution/use-evolution'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

/**
 * Evolução: quanto a pessoa já andou.
 *
 * É a tela da régua longa. O dashboard responde "como está hoje" e o
 * Progresso responde "o ritmo está de pé"; aqui a pergunta é "o que eu já
 * construí", e a resposta só cresce. Por isso nada nesta tela fica vermelho:
 * não existe semana ruim na Evolução, existe semana com menos XP.
 *
 * A ordem é a da leitura: o nível (onde estou), a semana (o que mudou), as
 * fontes (de onde veio), o histórico (o detalhe), os desbloqueios (o que vem)
 * e as conquistas (o que já foi).
 */
export function EvolutionPage() {
  const { summary, loading, error, snapshot } = useEvolution()
  const planner = usePlanner()
  const ai = useAi()

  if (loading) return <LoadingBlock label="Carregando tua evolução" />

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:gap-6">
      <PageHeader
        title="Evolução"
        description="Tudo que você já construiu. Isto aqui só cresce."
      />

      {error ? <ErrorNote message={error} /> : null}

      <Panel tone="brand" glow>
        <LevelCard progress={summary.progress} title={summary.title} />
      </Panel>

      <WeekStats summary={summary} />

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <div className="flex flex-col gap-5 lg:col-span-3 lg:gap-6">
          <Sources summary={summary} />
          <History items={summary.recent} today={planner.today} empty={snapshot.xpTotal === 0} />
        </div>
        <div className="flex flex-col gap-5 lg:col-span-2 lg:gap-6">
          <Unlocks items={summary.unlocks} />
          <Retrospective summary={summary} />
        </div>
      </div>

      <Achievements items={summary.achievements} />

      <AiCoachPanel ai={ai} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// a semana
// ---------------------------------------------------------------------------

function WeekStats({ summary }: { readonly summary: EvolutionSummary }) {
  const delta = summary.weekXp - summary.previousWeekXp
  const unlocked = summary.achievements.filter((item) => item.unlockedAt !== null).length

  return (
    <StatGrid>
      <Stat
        label="XP nesta semana"
        value={`+${formatXp(summary.weekXp)}`}
        hint={weekDeltaLabel(delta, summary.previousWeekXp)}
        accent="var(--color-brand)"
      />
      <Stat
        label="Conquistas"
        value={`${unlocked} de ${summary.achievements.length}`}
        hint={unlocked === 0 ? 'A primeira está perto' : 'Cada uma só uma vez'}
      />
      <Stat
        label="Semanas em evolução"
        value={`${summary.weeksInEvolution}`}
        hint={summary.weeksInEvolution === 1 ? 'Semana com XP ganho' : 'Semanas com XP ganho'}
      />
      <Stat
        label="Dias com movimento"
        value={`${summary.activeDays}`}
        hint={summary.firstDay ? `Desde ${formatDayLong(summary.firstDay)}` : 'Ainda nenhum'}
      />
    </StatGrid>
  )
}

function weekDeltaLabel(delta: number, previous: number): string {
  if (previous === 0 && delta === 0) return 'Sem XP ainda nesta semana'
  if (previous === 0) return 'Semana passada não teve XP'
  if (delta === 0) return 'Igual à semana passada'
  return delta > 0
    ? `${formatXp(delta)} a mais que a semana passada`
    : `${formatXp(-delta)} a menos que a semana passada`
}

// ---------------------------------------------------------------------------
// fontes
// ---------------------------------------------------------------------------

function Sources({ summary }: { readonly summary: EvolutionSummary }) {
  const max = summary.weekSources[0]?.points ?? 0

  return (
    <Panel>
      <PanelHeader title="Principais fontes" icon="insights" />

      {summary.weekSources.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nenhum XP nesta semana ainda"
            description="Fecha uma ação ou cumpre um hábito: o XP entra sozinho."
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {summary.weekSources.map((source) => (
            <li key={source.kind} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">
                  <span className="tabular font-medium">{source.count}</span>{' '}
                  {sourceLabel(source.kind, source.count)}
                </span>
                <span className="tabular shrink-0 text-ink-muted">+{formatXp(source.points)} XP</span>
              </div>
              <div
                aria-hidden="true"
                className="h-1 overflow-hidden rounded-full bg-surface-top"
              >
                <span
                  className="block h-full rounded-full bg-brand/70 transition-[width] duration-500 ease-out"
                  style={{ width: `${max === 0 ? 0 : Math.round((source.points / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** "14 ações concluídas", "1 Review Semanal": o rótulo no plural certo. */
function sourceLabel(kind: XpTransaction['kind'], count: number): string {
  const one = count === 1
  switch (kind) {
    case 'task_done':
      return one ? 'ação concluída' : 'ações concluídas'
    case 'priority_done':
      return one ? 'prioridade concluída' : 'prioridades concluídas'
    case 'habit_done':
      return one ? 'hábito cumprido' : 'hábitos cumpridos'
    case 'priorities_day':
      return one ? 'dia com todas as prioridades' : 'dias com todas as prioridades'
    case 'review_done':
      return one ? 'Review Semanal' : 'Reviews Semanais'
    case 'stage_done':
      return one ? 'marco alcançado' : 'marcos alcançados'
    case 'objective_done':
      return one ? 'objetivo concluído' : 'objetivos concluídos'
    case 'comeback':
      return one ? 'retomada' : 'retomadas'
    case 'week_consistent':
      return one ? 'semana consistente' : 'semanas consistentes'
    case 'achievement':
      return one ? 'conquista' : 'conquistas'
  }
}

// ---------------------------------------------------------------------------
// histórico
// ---------------------------------------------------------------------------

function History({
  items,
  today,
  empty,
}: {
  readonly items: readonly XpTransaction[]
  readonly today: ReturnType<typeof usePlanner>['today']
  readonly empty: boolean
}) {
  return (
    <Panel>
      <PanelHeader title="Histórico recente" icon="jornada" />

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={empty ? 'Tua evolução começa no primeiro registro' : 'Nada recente'}
            description={
              empty
                ? 'Ação, hábito, marco, objetivo e review viram XP. Nada é dado por abrir o app.'
                : 'Sem movimentação nos últimos registros. O que você já ganhou continua aqui.'
            }
          />
        </div>
      ) : (
        <ol className="mt-3 divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-hi text-ink-faint">
                <Icon name={KIND_ICONS[item.kind]} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink">{transactionLabel(item)}</span>
                <span className="block text-xs text-ink-faint">{formatDayLabel(item.day, today)}</span>
              </span>
              <span className="tabular shrink-0 font-medium text-brand-ink">+{item.points}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

const KIND_ICONS: Readonly<Record<XpTransaction['kind'], IconName>> = {
  task_done: 'check',
  priority_done: 'raio',
  habit_done: 'habitos',
  priorities_day: 'hoje',
  review_done: 'calendario',
  stage_done: 'plano',
  objective_done: 'objetivo',
  comeback: 'jornada',
  week_consistent: 'fogo',
  achievement: 'trofeu',
}

// ---------------------------------------------------------------------------
// desbloqueios
// ---------------------------------------------------------------------------

function Unlocks({ items }: { readonly items: readonly UnlockView[] }) {
  const pending = items.filter((item) => item.status !== 'liberado')
  const done = items.filter((item) => item.status === 'liberado')

  return (
    <Panel>
      <PanelHeader
        title="Próximos desbloqueios"
        icon="cadeado"
        hint="O plano define o que você usa; o XP, o que conquistou."
      />

      {pending.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Tudo que existe hoje já está liberado.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {pending.slice(0, 5).map((item) => (
            <li
              key={item.key}
              className="flex items-start gap-3 rounded-xl border border-line bg-surface-hi/40 px-3.5 py-3"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-ink-faint">
                <Icon name={UNLOCK_ICONS[item.kind]} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{item.label}</span>
                <span className="block text-xs text-ink-muted">{item.hint}</span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.requiresPro ? <Tag tone="brand">PRO</Tag> : null}
                  <Tag>Nível {item.level}</Tag>
                  <Tag className="text-ink-faint">{UNLOCK_KIND_LABELS[item.kind]}</Tag>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 ? (
        <p className="mt-4 text-xs text-ink-faint">
          Já liberado: {done.map((item) => item.label).join(', ')}.
        </p>
      ) : null}
    </Panel>
  )
}

const UNLOCK_ICONS: Readonly<Record<UnlockView['kind'], IconName>> = {
  share: 'globo',
  titulo: 'editar',
  moldura: 'lotus',
  retrospectiva: 'insights',
}

// ---------------------------------------------------------------------------
// retrospectiva
// ---------------------------------------------------------------------------

function Retrospective({ summary }: { readonly summary: EvolutionSummary }) {
  const unlock = summary.unlocks.find((item) => item.key === 'retrospectiva')
  const open = unlock?.status === 'liberado'

  return (
    <Panel>
      <PanelHeader
        title="Retrospectiva"
        icon="insights"
        hint={open ? 'Os números longos da tua jornada.' : `Abre no nível ${unlock?.level ?? 5}.`}
      />

      {open ? (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <Figure label="XP total" value={formatXp(summary.progress.xpTotal)} />
          <Figure label="Melhor semana" value={`+${formatXp(summary.bestWeekXp)}`} />
          <Figure label="Dias com movimento" value={`${summary.activeDays}`} />
          <Figure
            label="Primeiro registro"
            value={summary.firstDay ? formatDayLong(summary.firstDay) : 'Ainda não'}
          />
        </dl>
      ) : (
        <p className="mt-4 flex items-start gap-2 text-sm text-ink-muted">
          <Icon name="cadeado" className="mt-0.5 size-4 shrink-0 text-ink-faint" />
          Melhor semana, primeiro registro e o total da jornada. Ficam guardados desde já; você
          só passa a ver quando chegar lá.
        </p>
      )}
    </Panel>
  )
}

function Figure({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-hi/40 px-3.5 py-3">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="tabular mt-0.5 text-lg font-semibold text-ink">{value}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// conquistas
// ---------------------------------------------------------------------------

function Achievements({ items }: { readonly items: readonly AchievementView[] }) {
  const reduceMotion = useReducedMotion()
  const unlocked = items.filter((item) => item.unlockedAt !== null)
  const locked = items.filter((item) => item.unlockedAt === null)

  return (
    <Panel>
      <PanelHeader
        title="Conquistas"
        icon="trofeu"
      />

      {unlocked.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {unlocked.map((item, index) => (
            <motion.li
              key={item.key}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <AchievementCard item={item} />
            </motion.li>
          ))}
        </ul>
      ) : null}

      {locked.length > 0 ? (
        <>
          <p className="mt-5 text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Ainda por vir
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((item) => (
              <li key={item.key}>
                <AchievementCard item={item} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Panel>
  )
}

function AchievementCard({ item }: { readonly item: AchievementView }) {
  const done = item.unlockedAt !== null

  return (
    <div
      className={cn(
        'flex h-full items-start gap-3 rounded-xl border px-3.5 py-3',
        done
          ? 'border-brand/30 bg-brand-dim/30'
          : 'border-line bg-surface-hi/30 text-ink-muted',
      )}
    >
      <AchievementMedal
        icon={achievementIcon(item.icon)}
        state={done ? (item.rarity === 'rara' ? 'rara' : 'conquistada') : 'bloqueada'}
      />
      <span className="min-w-0 flex-1">
        <span className={cn('flex items-center gap-2 text-sm font-medium', done ? 'text-ink' : 'text-ink-muted')}>
          <span className="truncate">{item.name}</span>
          {item.rarity === 'rara' ? (
            <span className="shrink-0 text-[10px] font-semibold tracking-wide text-brand-ink uppercase">
              Rara
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-pretty">
          {done ? item.description : item.condition}
        </span>
        <span className="mt-1.5 block text-xs text-ink-faint">
          {ACHIEVEMENT_CATEGORY_LABELS[item.category]}
          {item.xp > 0 ? ` · +${item.xp} XP` : ''}
          {item.unlockedAt ? ` · ${item.unlockedAt.toLocaleDateString('pt-BR')}` : ''}
        </span>
      </span>
      {done ? (
        <Icon name="check" className="mt-1 size-4 shrink-0 text-brand-ink" strokeWidth={2.5} />
      ) : (
        <Icon name="cadeado" className="mt-1 size-4 shrink-0 text-ink-faint" />
      )}
    </div>
  )
}

/** O domínio guarda a chave como texto; aqui ela vira ícone de verdade, com reserva. */
function achievementIcon(name: string): IconName {
  return name in KNOWN_ICONS ? (name as IconName) : 'trofeu'
}

const KNOWN_ICONS: Readonly<Record<string, true>> = {
  check: true,
  calendario: true,
  plano: true,
  jornada: true,
  raio: true,
  fogo: true,
  trofeu: true,
  subir: true,
  progresso: true,
  lotus: true,
}
