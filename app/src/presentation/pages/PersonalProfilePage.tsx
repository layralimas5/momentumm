import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { belongsInCircle } from '@/domain/entities/circle-feed'
import { formatDayLabel, type DayKey } from '@/domain/entities/day'
import { countsAsDone } from '@/domain/entities/habit'
import { JOURNEY_EVENT_TYPE_LABELS, type JourneyEvent, type JourneyVisibility } from '@/domain/entities/journey-event'
import { PROFILE_VISIBILITY_LABELS } from '@/domain/entities/profile'
import { recoveryRate } from '@/domain/entities/rhythm'
import { isDone } from '@/domain/entities/task'
import { milestoneEvent, momentumEvent } from '@/domain/share/journey-event-builders'
import { circleOpen } from '@/infrastructure/config/env'
import { useAuth } from '@/presentation/auth/use-auth'
import { ClubCard } from '@/presentation/clubs/ClubCard'
import { useClubs } from '@/presentation/clubs/use-clubs'
import { StatusTag } from '@/presentation/components/ds/Badges'
import { Card, SectionHeader } from '@/presentation/components/ds/Card'
import { Toggle } from '@/presentation/components/ds/Controls'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { useEvolution } from '@/presentation/evolution/use-evolution'
import { useDashboard } from '@/presentation/planner/use-dashboard'
import { useMomentumInput } from '@/presentation/planner/use-momentum-input'
import { usePlanner } from '@/presentation/planner/use-planner'
import {
  IdentityCard,
  MetricTile,
  PreferenceRow,
  RelicCard,
  ShareTemplateCard,
} from '@/presentation/profile/IdentityCards'
import { ProfileEditor } from '@/presentation/profile/ProfileEditor'
import { ProfileVisibilityPanel } from '@/presentation/profile/ProfileVisibilityPanel'
import { StatusEditor } from '@/presentation/profile/StatusEditor'
import { useShareStudio } from '@/presentation/share/ShareStudioProvider'
import { FollowListSheet } from '@/presentation/social/FollowListSheet'
import { FollowRequestsCard } from '@/presentation/social/FollowRequestsCard'
import { ProfileJourney } from '@/presentation/social/ProfileJourney'
import { useSocialCounts } from '@/presentation/social/use-social-counts'
import { useTheme } from '@/presentation/theme/use-theme'
import { cn } from '@/shared/lib/cn'

/**
 * Perfil: a identidade dentro do Momentumm. Cartão de membro, os quatro
 * números, a relíquia, os clubes, o estúdio de stories e as preferências.
 */
export function PersonalProfilePage() {
  const { profile, loading, refreshProfile, signOut } = useAuth()
  const planner = usePlanner()
  const view = useDashboard()
  const input = useMomentumInput()
  const evolution = useEvolution()
  const share = useShareStudio()
  const counts = useSocialCounts(profile?.id ?? null)
  const { theme, toggle } = useTheme()

  const [editing, setEditing] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [momentsOpen, setMomentsOpen] = useState(false)
  const [listKind, setListKind] = useState<'seguidores' | 'seguindo' | null>(null)

  const { summary } = evolution
  const recovery = useMemo(() => recoveryRate(input), [input])

  const unlocked = useMemo(
    () =>
      summary.achievements
        .filter((item) => item.unlockedAt !== null)
        .sort((a, b) => (b.unlockedAt?.getTime() ?? 0) - (a.unlockedAt?.getTime() ?? 0)),
    [summary.achievements],
  )
  const relic = unlocked.find((item) => item.rarity === 'rara') ?? unlocked[0] ?? null

  const movedDays = useMemo(() => {
    const days = new Set<DayKey>()
    for (const activity of planner.activities) days.add(activity.day)
    for (const log of planner.habitLogs) if (countsAsDone(log.status)) days.add(log.day)
    for (const task of planner.tasks) if (isDone(task)) days.add(task.day)
    return days
  }, [planner.activities, planner.habitLogs, planner.tasks])

  const moments = useMemo(
    () => planner.journeyEvents.filter((event) => event.type !== 'milestone').slice(0, 12),
    [planner.journeyEvents],
  )

  if (loading) return <LoadingBlock label="Carregando teu perfil" />
  if (!profile) return <ErrorNote message="Não consegui carregar teu perfil. Recarrega a página." />

  const level = summary.progress
  const streak = planner.streak
  const record = Math.max(streak.record, streak.current)

  const shareStreak = () =>
    share.open(
      milestoneEvent({
        userId: profile.id,
        today: planner.today,
        count: streak.current,
        unit: streak.current === 1 ? 'dia de sequência' : 'dias de sequência',
        momentum: view.momentum,
      }),
    )

  const shareMomentum = () =>
    share.open(
      momentumEvent({ userId: profile.id, today: planner.today, momentum: view.momentum, streakDays: streak.current }),
    )

  const shareAchievements = () =>
    share.open(
      milestoneEvent({
        userId: profile.id,
        today: planner.today,
        count: unlocked.length,
        unit: unlocked.length === 1 ? 'conquista' : 'conquistas',
        momentum: view.momentum,
      }),
    )

  return (
    <div className="flex flex-col gap-4 pb-2">
      <FollowRequestsCard />

      {editing ? (
        <Card>
          <ProfileEditor
            profile={profile}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              await refreshProfile()
              setEditing(false)
            }}
          />
        </Card>
      ) : (
        <IdentityCard
          profile={profile}
          plan={planner.limits.tier}
          levelLabel={`Nível ${level.level} ${level.name}`}
          counts={counts}
          social={circleOpen}
          onEdit={() => setEditing(true)}
          onStatus={() => setStatusOpen(true)}
          onFollowers={() => setListKind('seguidores')}
          onFollowing={() => setListKind('seguindo')}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <MetricTile label="Score" icon="medidor" value={view.momentum.value} suffix="/100" hint="Momentum de agora" />
        <MetricTile
          label="Sequência"
          icon="fogo"
          value={streak.current}
          suffix={streak.current === 1 ? 'dia' : 'dias'}
          hint={`Recorde de ${record}`}
        />
        <MetricTile label="XP total" icon="cubo" value={level.xpTotal} hint={`Nível ${level.level} ${level.name}`} />
        <MetricTile
          label="Recuperação"
          icon="pulso"
          value={recovery.rate === null ? '100%' : `${Math.round(recovery.rate * 100)}%`}
          hint={
            recovery.rate === null
              ? 'Sem quebras no mês'
              : `${recovery.comebacks} de ${recovery.interruptions} retomadas`
          }
        />
      </div>

      <RelicCard
        achievement={relic}
        unlocked={unlocked.length}
        total={summary.achievements.length}
        onShare={shareAchievements}
      />

      {circleOpen ? <ProfileClubs /> : null}

      <section aria-labelledby="share-studio" className="flex flex-col gap-3">
        <SectionHeader id="share-studio" title="Share Studio · Stories" icon="ia" caps />
        <p className="-mt-1 px-1 text-xs text-ink-faint">Toque no card pra exportar em alta definição.</p>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-3 no-scrollbar sm:-mx-6 sm:px-6">
          <ShareTemplateCard kicker="Foco" icon="fogo" value={`${streak.current}D`} caption="Sequência ativa" onClick={shareStreak} />
          <ShareTemplateCard
            kicker="Relíquia"
            icon="trofeu"
            value={unlocked.length}
            caption={unlocked.length === 1 ? 'conquista' : 'conquistas'}
            onClick={shareAchievements}
            tone="dark"
          />
          <ShareTemplateCard
            kicker="Executive"
            icon="medidor"
            value={view.momentum.value}
            caption="Momentum Score"
            onClick={shareMomentum}
          />
        </div>
      </section>

      <section aria-labelledby="jornada" className="flex flex-col gap-3">
        <SectionHeader id="jornada" title="Sua jornada" icon="calendarioGrade" caps />
        <Card padded={false} className="p-4">
          <ProfileJourney userId={profile.id} today={planner.today} movedDays={movedDays} owner />
        </Card>
      </section>

      <section aria-labelledby="preferencias" className="flex flex-col gap-3">
        <SectionHeader id="preferencias" title="Preferências" caps />
        <Card as="div" padded={false}>
          <ul className="divide-y divide-line">
            {circleOpen ? (
              <PreferenceRow
                icon="visivel"
                title="Visibilidade do perfil"
                hint={PROFILE_VISIBILITY_LABELS[profile.visibility]}
                onClick={() => setVisibilityOpen(true)}
              />
            ) : null}
            <PreferenceRow icon="sino" title="Lembretes" hint="O aviso que protege a sequência" to="/app/configuracoes#lembretes" />
            <PreferenceRow
              icon="lua"
              title="Tema escuro"
              hint={theme === 'dark' ? 'Ligado' : 'Desligado'}
              control={<Toggle checked={theme === 'dark'} onChange={toggle} label="Tema escuro" />}
            />
            <PreferenceRow icon="jornada" title="Momentos e visibilidade" hint="O que vai pro Círculo e o que fica só pra você" onClick={() => setMomentsOpen(true)} />
            <PreferenceRow icon="raio" title="Assinatura" hint={planner.limits.tier === 'pro' ? 'PRO ativo' : 'Conheça o PRO'} to="/app/assinatura" />
            <PreferenceRow icon="config" title="Configurações" hint="Conta, segurança, dias de descanso" to="/app/configuracoes" />
            <PreferenceRow icon="habitos" title="Hábitos" to="/app/habitos" />
            <PreferenceRow icon="ia" title="Momentumm AI" to="/app/ia" />
            <PreferenceRow icon="sino" title="Suporte" to="/app/suporte" />
            <PreferenceRow icon="saida" title="Sair da conta" danger onClick={() => void signOut()} />
          </ul>
        </Card>
      </section>

      <p className="flex items-start gap-2.5 px-1 text-xs text-ink-faint">
        <Icon name="cadeado" className="mt-0.5 size-4 shrink-0" />
        <span>
          O que você registra é só seu. Quem te segue vê o que você publica, e compartilhar cria uma imagem no teu
          aparelho, não uma publicação.
        </span>
      </p>

      {listKind ? <FollowListSheet open userId={profile.id} kind={listKind} onClose={() => setListKind(null)} /> : null}

      <StatusEditor
        open={statusOpen}
        profileId={profile.id}
        status={profile.status}
        onClose={() => setStatusOpen(false)}
        onSaved={refreshProfile}
      />

      <BottomSheet open={visibilityOpen} title="Visibilidade do perfil" onClose={() => setVisibilityOpen(false)}>
        <ProfileVisibilityPanel profile={profile} onSaved={refreshProfile} />
      </BottomSheet>

      <BottomSheet open={momentsOpen} title="Momentos recentes" onClose={() => setMomentsOpen(false)}>
        {moments.length === 0 ? (
          <p className="pb-2 text-sm text-ink-muted">Fecha um dia ou avança um objetivo e ele aparece aqui.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {moments.map((event) => (
              <li key={event.id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{event.title}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                    {JOURNEY_EVENT_TYPE_LABELS[event.type]} · {formatDayLabel(event.day, planner.today)}
                  </span>
                </span>
                <CircleToggle event={event} onChange={planner.setEventVisibility} />
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </div>
  )
}

function ProfileClubs() {
  const clubs = useClubs()
  if (clubs.loading || clubs.mine.length === 0) return null

  return (
    <section aria-labelledby="meus-clubes-perfil" className="flex flex-col gap-3">
      <SectionHeader
        id="meus-clubes-perfil"
        title={`Seus clubes (${clubs.mine.length})`}
        caps
        aside={
          <Link to="/app/circulo?aba=clubes" className="font-medium text-brand-hi">
            Ver todos
          </Link>
        }
      />
      <ul className="flex flex-col gap-3">
        {clubs.mine.slice(0, 3).map((club) => (
          <li key={club.id}>
            <ClubCard club={club} to={`/app/clubes/${club.id}`} action={<StatusTag tone="brand">Membro</StatusTag>} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function CircleToggle({
  event,
  onChange,
}: {
  readonly event: JourneyEvent
  readonly onChange: (id: string, visibility: JourneyVisibility) => Promise<void>
}) {
  if (!circleOpen || !belongsInCircle(event.type)) return null
  const shared = event.visibility === 'amigos'

  return (
    <button
      type="button"
      aria-pressed={shared}
      onClick={() => void onChange(event.id, shared ? 'privada' : 'amigos')}
      className={cn(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium',
        shared ? 'bg-brand-dim text-brand-ink' : 'well text-ink-faint',
      )}
    >
      <Icon name={shared ? 'pessoas' : 'cadeado'} className="size-3.5" />
      {shared ? 'No círculo' : 'Só eu'}
    </button>
  )
}
