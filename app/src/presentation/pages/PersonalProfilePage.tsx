import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { activityType } from '@/domain/entities/activity-type'
import { belongsInCircle } from '@/domain/entities/circle-feed'
import { circleOpen } from '@/infrastructure/config/env'
import { countsAsDone } from '@/domain/entities/habit'
import { formatDayLabel, startOfWeek } from '@/domain/entities/day'
import {
  JOURNEY_EVENT_TYPE_LABELS,
  type JourneyEvent,
  type JourneyVisibility,
} from '@/domain/entities/journey-event'
import {
  MOMENTUM_HORIZON_DAYS,
  MOMENTUM_LEVEL_LABELS,
  momentumFactors,
} from '@/domain/entities/momentum'
import {
  milestoneKindOf,
  nextMilestones,
  type MilestoneKind,
  type MilestoneTotals,
} from '@/domain/entities/milestone'
import { membershipLabel, PROFILE_VISIBILITY_LABELS } from '@/domain/entities/profile'
import { totalMinutes } from '@/domain/entities/activity'
import { milestoneEvent, momentumEvent } from '@/domain/share/journey-event-builders'
import { useAuth } from '@/presentation/auth/use-auth'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { Stat, StatGrid } from '@/presentation/components/ui/Stat'
import { MobileShortcuts } from '@/presentation/components/mobile/MobileShortcuts'
import { ProfileBanner } from '@/presentation/profile/ProfileBanner'
import { ProfileEditor } from '@/presentation/profile/ProfileEditor'
import { StatusEditor } from '@/presentation/profile/StatusEditor'
import { ProfileVisibilityPanel } from '@/presentation/profile/ProfileVisibilityPanel'
import { LevelCard } from '@/presentation/evolution/LevelCard'
import { useEvolution } from '@/presentation/evolution/use-evolution'
import { ShareButton } from '@/presentation/share/ShareButton'
import { useDashboard } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

/**
 * Perfil.
 *
 * É um painel da evolução pessoal, não uma página de rede social. A diferença
 * é o que ele responde: não "quem me segue", mas "o quanto eu mudei desde que
 * comecei". Por isso ele funciona inteiro com uma pessoa só usando o app —
 * momentum, constância, semanas de progresso, objetivos e conquistas são todos
 * dados que a própria pessoa gerou.
 *
 * Tudo aqui é leitura de coisas que já existem: o momentum vem do mesmo cálculo
 * do dashboard, os objetivos vêm do mesmo `useObjectives`, e as conquistas vêm
 * da camada de momentos da jornada. Nenhum número novo é inventado nesta tela,
 * porque dois lugares calculando "constância" com contas diferentes é como um
 * app começa a discordar de si mesmo.
 */
export function PersonalProfilePage() {
  const { profile, loading, refreshProfile } = useAuth()
  const planner = usePlanner()
  const view = useDashboard()
  const evolution = useEvolution()
  const [editing, setEditing] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const { summary: evolutionSummary } = evolution
  const achievementsUnlocked = evolutionSummary.achievements.filter(
    (item) => item.unlockedAt !== null,
  ).length
  const auroraFrame = evolutionSummary.unlocks.some(
    (item) => item.key === 'moldura_aurora' && item.status === 'liberado',
  )

  const { activities, habitLogs, journeyEvents, streak } = planner

  /** Semanas em que alguma coisa se moveu. É a régua longa da constância. */
  const weeksOfProgress = useMemo(() => {
    const weeks = new Set<string>()
    for (const activity of activities) weeks.add(startOfWeek(activity.day))
    for (const log of habitLogs) if (countsAsDone(log.status)) weeks.add(startOfWeek(log.day))
    return weeks.size
  }, [activities, habitLogs])

  const totals = useMemo<MilestoneTotals>(
    () => ({
      habitsDone: habitLogs.filter((log) => countsAsDone(log.status)).length,
      activeDays: new Set(activities.map((activity) => activity.day)).size,
      streakRecord: Math.max(streak.record, streak.current),
      objectivesDone: planner.objectives.filter((item) => item.completedAt !== null).length,
      focusMinutes: totalMinutes(activities),
    }),
    [habitLogs, activities, streak, planner.objectives],
  )

  const achievements = useMemo(
    () => journeyEvents.filter((event) => event.type === 'milestone'),
    [journeyEvents],
  )

  const recent = useMemo(
    () => journeyEvents.filter((event) => event.type !== 'milestone').slice(0, 6),
    [journeyEvents],
  )

  const running = view.objectives.filter((item) => item.progress.state === 'em-andamento')
  const nextGoal = nextMilestones(totals)[0] ?? null

  /*
    A consistência em PORCENTAGEM, e não em "5/7".

    A fração é a leitura do dashboard, onde a semana é o assunto e cada dia
    ainda dá pra recuperar. Aqui a pergunta é outra — "o quanto eu venho
    sustentando isso" — e a porcentagem é o que responde numa linha só, junto
    com objetivos ativos e tempo de casa.

    O número é o FATOR de consistência do próprio score (28 dias, a última
    semana pesando o triplo), não uma conta paralela sobre 7 dias: duas
    telas contando "constância" com contas diferentes é como um app começa a
    discordar de si mesmo.
  */
  const consistency =
    momentumFactors(view.momentum).find((factor) => factor.key === 'consistency')?.score ?? 0

  if (loading) return <LoadingBlock label="Carregando teu perfil" />
  if (!profile) return <ErrorNote message="Não consegui carregar teu perfil. Recarrega a página." />

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:gap-6">
      <PageHeader
        title="Perfil"
        description="Onde você está e o que já construiu."
        action={
          editing ? undefined : (
            <div className="flex flex-wrap items-center gap-2">
              {/*
                O único ponto de entrada do Share Studio que existe todo dia,
                em qualquer tela. Os outros aparecem só quando há um momento
                digno de card; este serve pra quem quer o card do momentum
                agora, sem esperar o dia render.
              */}
              <ShareButton
                label="Compartilhar Momentumm"
                build={() =>
                  momentumEvent({
                    userId: profile.id,
                    today: planner.today,
                    momentum: view.momentum,
                    streakDays: planner.streak.current,
                  })
                }
              />
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Icon name="editar" className="size-4" />
                Editar perfil
              </Button>
            </div>
          )
        }
      />

      <Panel flush={!editing}>
        {editing ? (
          <ProfileEditor
            profile={profile}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              await refreshProfile()
              setEditing(false)
            }}
          />
        ) : (
          <div>
            {/*
              Capa em cima, avatar montado na borda dela: o card lê como um
              cartão de identidade, não como uma linha de lista. A capa é
              escolha da pessoa (tema ou foto) e o status vem logo abaixo do
              nome, onde ela conta em que pé está.
            */}
            <ProfileBanner banner={profile.banner} className="h-24 sm:h-32" />
            <div className="px-5 pb-5">
              <div className="-mt-10 flex items-end gap-3 sm:-mt-12">
                <span
                  className={cn(
                    'shrink-0 rounded-full bg-surface p-1',
                    // A moldura Aurora é um desbloqueio (PRO + nível 7): um anel, não um enfeite.
                    auroraFrame && 'ring-2 ring-brand/70 shadow-[0_0_24px_-4px_var(--color-brand)]',
                  )}
                >
                  <Avatar
                    name={profile.name}
                    src={profile.avatarUrl}
                    className="size-20 sm:size-24"
                    textClassName="text-xl sm:text-2xl"
                  />
                </span>
                <button
                  type="button"
                  onClick={() => setStatusOpen(true)}
                  className={cn(
                    'mb-1 inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
                    profile.status
                      ? 'border-line bg-surface-hi text-ink hover:border-line-hi'
                      : 'border-dashed border-line-hi text-ink-muted hover:bg-surface-hi hover:text-ink',
                  )}
                >
                  {profile.status ? (
                    <>
                      {profile.status.emoji ? <span aria-hidden="true">{profile.status.emoji}</span> : null}
                      <span className="truncate">{profile.status.text ?? 'Status'}</span>
                      <span className="sr-only">. Editar status</span>
                    </>
                  ) : (
                    <>
                      <Icon name="mais" className="size-4" />
                      Adicionar status
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3 min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                {profile.name}
              </h2>
              <p className="truncate text-sm text-ink-faint">
                @{profile.handle}
                {evolutionSummary.title ? (
                  <span className="text-brand-ink"> · {evolutionSummary.title}</span>
                ) : null}
              </p>
              {profile.bio ? (
                <p className="mt-1.5 text-sm text-pretty text-ink-muted">{profile.bio}</p>
              ) : null}

              {/*
                A linha que resume a pessoa em números, do jeito que ela seria
                lida em voz alta: momentum, objetivos, consistência e tempo de
                casa. Os mesmos dados aparecem abertos logo abaixo — aqui eles
                existem pra caber num olhar, e é por isso que a linha é uma só.
              */}
              <p className="mt-2 text-sm text-ink-muted">
                <span className="font-medium text-ink">
                  Nível {evolutionSummary.progress.level}, {evolutionSummary.progress.name}
                </span>
                <span className="text-ink-faint"> · </span>
                <span className="font-medium text-ink">Momentumm {view.momentum.value}</span>
                <span className="text-ink-faint"> · </span>
                {running.length} {running.length === 1 ? 'objetivo ativo' : 'objetivos ativos'}
                <span className="text-ink-faint"> · </span>
                {consistency}% de consistência
                <span className="text-ink-faint"> · </span>
                {membershipLabel(profile.createdAt, new Date())}
              </p>

              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-ink-faint">
                <Icon name="cadeado" className="size-3.5" />
                {PROFILE_VISIBILITY_LABELS[profile.visibility]}
              </p>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <StatusEditor
        open={statusOpen}
        profileId={profile.id}
        status={profile.status}
        onClose={() => setStatusOpen(false)}
        onSaved={refreshProfile}
      />

      {/*
        Nível e Momentumm lado a lado, de propósito: um é o caminho percorrido
        (só cresce), o outro é o ritmo de agora (sobe e desce). Juntos eles
        contam a história inteira; separados, cada um parece o outro.
      */}
      <div className="grid gap-3 sm:grid-cols-2">
        <LevelCard progress={evolutionSummary.progress} title={evolutionSummary.title} compact />
        <div className="surface-card flex flex-col justify-between p-4">
          <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Evolução
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-ink-faint">Conquistas</dt>
              <dd className="tabular text-xl font-semibold text-ink">
                {achievementsUnlocked}
                <span className="text-sm font-normal text-ink-faint">
                  {' '}
                  de {evolutionSummary.achievements.length}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Semanas em evolução</dt>
              <dd className="tabular text-xl font-semibold text-ink">
                {evolutionSummary.weeksInEvolution}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink-faint">
            +{evolutionSummary.weekXp.toLocaleString('pt-BR')} XP nesta semana
          </p>
        </div>
      </div>

      {/*
        Os quatro números que respondem "como eu venho indo". Momentumm é o
        ritmo de agora; os outros três são a régua longa, que é justamente a que
        o dashboard não mostra: lá tudo é sobre hoje.
      */}
      <StatGrid>
        <Stat
          label="Momentumm"
          value={`${view.momentum.value}`}
          hint={MOMENTUM_LEVEL_LABELS[view.momentum.level]}
          accent="var(--color-brand)"
        />
        <Stat
          label="Consistência"
          value={`${consistency}%`}
          hint={`${view.momentum.activeDaysInHorizon} de ${MOMENTUM_HORIZON_DAYS} dias com movimento`}
        />
        <Stat
          label="Semanas de progresso"
          value={`${weeksOfProgress}`}
          hint={weeksOfProgress === 1 ? 'a primeira' : 'com registro'}
        />
        <Stat
          label="Sequência"
          value={`${streak.current}`}
          hint={`recorde de ${Math.max(streak.record, streak.current)}`}
          accent="var(--color-flame)"
        />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <Panel>
          <PanelHeader
            title="Objetivos ativos"
            icon="objetivo"
            action={
              <Link
                to="/app/objetivos"
                className="rounded-md text-sm font-medium text-brand-hi transition-colors hover:text-brand-ink"
              >
                Ver todos
              </Link>
            }
          />

          {running.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">
              Nenhum objetivo em andamento agora. É o que dá direção ao dia.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {running.map((item) => {
                const objective = item.progress.objective
                const axis = activityType(objective.axis)
                return (
                  <li key={objective.id}>
                    <Link to={`/app/objetivos/${objective.id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-ink group-hover:text-brand-ink">
                          {objective.title}
                        </span>
                        <span className="tabular shrink-0 text-sm text-ink-muted">
                          {Math.round(item.ratio * 100)}%
                        </span>
                      </div>
                      <ProgressBar
                        className="mt-2"
                        value={item.ratio}
                        label={`Progresso de ${objective.title}`}
                        color={axis.colorToken}
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Conquistas" icon="trofeu" />

          {achievements.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">
              As conquistas aparecem sozinhas conforme os números crescem. A primeira está a
              caminho.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {achievements.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface-hi/40 px-3.5 py-2.5"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-lg border border-brand/30 bg-brand-dim/40 text-brand-hi"
                  >
                    <Icon
                      name={MILESTONE_ICONS[milestoneKindOf(event.sourceId ?? '')]}
                      className="size-4.5"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {event.title}
                    </span>
                    <span className="block text-xs text-ink-faint">
                      {formatDayLabel(event.day, planner.today)}
                    </span>
                  </span>
                  <ShareButton
                    label="Compartilhar"
                    variant="ghost"
                    icon="jornada"
                    build={() =>
                      milestoneEvent({
                        userId: profile.id,
                        today: planner.today,
                        count: event.metadata.milestoneCount ?? 0,
                        unit: event.metadata.milestoneUnit ?? '',
                        momentum: view.momentum,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {nextGoal ? (
            <div className="mt-4 border-t border-line pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-ink-muted">Próxima: {nextGoal.label}</span>
                <span className="tabular shrink-0 text-sm text-ink-faint">
                  faltam {nextGoal.remaining}
                </span>
              </div>
              <ProgressBar
                className="mt-2"
                value={nextGoal.ratio}
                label={`Progresso até ${nextGoal.label}`}
              />
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Progresso recente"
          icon="jornada"
        />

        {recent.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Ainda não há momentos registrados"
              description="Fecha um dia ou avança um objetivo e ele aparece aqui."
            />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {recent.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{event.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2">
                    <Tag>{JOURNEY_EVENT_TYPE_LABELS[event.type]}</Tag>
                    <span className="text-xs text-ink-faint">
                      {formatDayLabel(event.day, planner.today)}
                    </span>
                  </span>
                </span>
                <MomentumDelta event={event} />
                <CircleToggle event={event} onChange={planner.setEventVisibility} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Quem vê o perfil só faz sentido quando existe alguém pra ver. */}
      {circleOpen ? <ProfileVisibilityPanel profile={profile} onSaved={refreshProfile} /> : null}

      <MobileShortcuts />

      {/*
        O aviso de privacidade fecha a página de propósito. Enquanto o produto
        for de uma pessoa só, é importante deixar explícito que nada disso está
        exposto — e que compartilhar gera uma imagem, não uma publicação.
      */}
      <p className="flex items-start gap-2.5 text-sm text-ink-faint">
        <Icon name="cadeado" className="mt-0.5 size-4 shrink-0" />
        <span>
          Tudo neste perfil é só seu. Nada aqui é público, e compartilhar cria uma imagem no teu
          aparelho, não uma publicação.
        </span>
      </p>
    </div>
  )
}

/**
 * Mostrar (ou não) esse momento pro círculo.
 *
 * É AQUI que um momento deixa de ser privado, e em nenhum outro lugar: não
 * existe compartilhamento automático, nem "compartilhar tudo", nem uma
 * preferência que decide por antecipação. Cada momento é uma escolha.
 *
 * O botão só aparece nos tipos que o feed aceita. Oferecer "mostrar no círculo"
 * num hábito solto faria a pessoa marcar, não ver aparecer e concluir que
 * quebrou — quando na verdade o produto decidiu que hábito avulso não é assunto
 * de feed.
 */
function CircleToggle({
  event,
  onChange,
}: {
  readonly event: JourneyEvent
  readonly onChange: (id: string, visibility: JourneyVisibility) => Promise<void>
}) {
  // Sem Círculo aberto não existe pra quem mostrar: o botão prometeria um
  // público que ainda não existe.
  if (!circleOpen || !belongsInCircle(event.type)) return null

  const shared = event.visibility === 'amigos'

  return (
    <button
      type="button"
      aria-pressed={shared}
      onClick={() => void onChange(event.id, shared ? 'privada' : 'amigos')}
      className={cn(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        shared
          ? 'border-brand/40 bg-brand-dim/40 text-brand-ink'
          : 'border-line text-ink-faint hover:border-line-hi hover:text-ink-muted',
      )}
    >
      <Icon name={shared ? 'jornada' : 'cadeado'} className="size-3.5" />
      {shared ? 'No círculo' : 'Só eu'}
    </button>
  )
}

/** A variação do momentum no momento do registro. Some quando não houve. */
function MomentumDelta({ event }: { readonly event: JourneyEvent }) {
  if (event.momentumChange === null || event.momentumChange === 0) return null

  return (
    <Tag tone={event.momentumChange > 0 ? 'positive' : 'neutral'}>
      {event.momentumChange > 0 ? '+' : '−'}
      {Math.abs(event.momentumChange)}
    </Tag>
  )
}

/**
 * Um ícone por espécie de marco.
 *
 * O troféu repetido em toda linha achatava conquistas diferentes numa coisa só.
 * Sequência é fogo, objetivo é alvo, foco é relógio — os mesmos símbolos que
 * essas ideias já têm no resto do app, e é isso que faz a lista ser lida sem
 * legenda.
 */
const MILESTONE_ICONS: Readonly<Record<MilestoneKind, 'habitos' | 'calendario' | 'fogo' | 'objetivo' | 'relogio'>> = {
  habitos: 'habitos',
  dias: 'calendario',
  sequencia: 'fogo',
  objetivos: 'objetivo',
  foco: 'relogio',
}
