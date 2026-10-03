import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { DayKey } from '@/domain/entities/day'
import { alreadySent, ENCOURAGEMENTS, encouragementSpec, PAIR_DAYS, sentTodayCount } from '@/domain/entities/pair'
import { isPro, type PlanLimits } from '@/domain/entities/plan'
import { track } from '@/infrastructure/analytics/track'
import { useAuth } from '@/presentation/auth/use-auth'
import { Card, Eyebrow, IconWell } from '@/presentation/components/ds/Card'
import { PrimaryButton } from '@/presentation/components/ds/Controls'
import { ProLock } from '@/presentation/components/ds/ProLock'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { InvitePanel } from '@/presentation/juntos/InvitePanel'
import { EncouragementTile, PairHero, PairWeek } from '@/presentation/juntos/PairCards'
import { usePairs, type PairsController, type PairView } from '@/presentation/juntos/use-pairs'
import { useFeature } from '@/presentation/plan/use-feature'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'

/**
 * Juntos: uma pessoa acompanhando o teu ritmo, e você o dela. A dupla vê só se
 * o outro avançou no dia; o resto do app continua só seu.
 *
 * A flag é lida aqui, e não no roteador: a resposta vem do servidor, e uma
 * rota que aparece depois faria a tela piscar a cada carga.
 */
export function JuntosPage() {
  const juntos = useFeature('juntos')
  const pairs = usePairs()
  const planner = usePlanner()
  const limits = planner.limits

  if (juntos.loading || pairs.loading) return <LoadingBlock label="Carregando suas duplas" />
  if (!juntos.enabled) return <Navigate to="/app" replace />

  const empty = pairs.views.length === 0

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="px-1">
        <Eyebrow dot>Accountability em dupla</Eyebrow>
        <h2 className="mt-1 text-[1.4rem] leading-tight font-bold tracking-tight text-ink">Juntos</h2>
        <p className="mt-0.5 text-sm text-ink-faint">{subtitleOf(pairs.views)}</p>
      </header>

      {pairs.error ? <ErrorNote message={pairs.error} /> : null}

      {empty && pairs.room ? <InvitePanel /> : null}

      {pairs.views.map((view) => (
        <PairSection key={view.pair.id} view={view} limits={limits} today={planner.today} controller={pairs} />
      ))}

      {!empty && pairs.room ? <InvitePanel compact /> : null}

      {!pairs.room ? (
        <UpgradeHint
          message={
            pairs.max === 1
              ? 'O plano gratuito mantém uma dupla por vez. No PRO você mantém quantas quiser.'
              : `O teu plano mantém ${pairs.max} duplas por vez. No PRO não tem teto.`
          }
        />
      ) : null}

      {empty ? <PrivacyCard /> : null}
    </div>
  )
}

function subtitleOf(views: readonly PairView[]): string {
  if (views.length === 0) return 'Uma pessoa acompanhando o teu ritmo, e você o dela.'
  if (views.length === 1) {
    const partner = views[0]?.pair.members.find((member) => !member.isMe)
    return partner ? `Você e ${partner.name.split(' ')[0]}, em movimento.` : 'Sua dupla de accountability.'
  }
  return `${views.length} duplas acompanhando o teu ritmo.`
}

function PairSection({
  view,
  limits,
  today,
  controller,
}: {
  readonly view: PairView
  readonly limits: PlanLimits
  readonly today: DayKey
  readonly controller: PairsController
}) {
  const { pair, reading } = view
  const { user } = useAuth()
  const navigate = useNavigate()
  const [confirmLeave, setConfirmLeave] = useState(false)

  const partner = pair.members.find((member) => !member.isMe)
  const me = pair.members.find((member) => member.isMe)
  const pro = isPro(limits.tier)

  /* O teto do dia é aplicado também no servidor; aqui ele faz o botão dizer a verdade antes do clique. */
  const usedToday = user ? sentTodayCount(pair, user.id, today) : 0
  const quotaReached = usedToday >= limits.pairEncouragementsPerDay
  const received = pair.encouragementsToday.filter((item) => item.recipientId === user?.id)

  return (
    <section className="flex flex-col gap-4" aria-label={partner ? `Dupla com ${partner.name}` : 'Dupla'}>
      <PairHero me={me} partner={partner} reading={reading} daysTogether={pair.daysTogether} />

      {received.length > 0 ? (
        <Card padded={false} className="flex flex-wrap items-center gap-2 p-3">
          <span className="eyebrow px-1 text-[0.62rem] text-ink-faint">Chegou pra você</span>
          {received.map((item) => {
            const spec = encouragementSpec(item.kind)
            return (
              <span key={item.id} className="flex items-center gap-1.5 rounded-full bg-brand-dim px-3 py-1.5 text-sm text-brand-ink">
                <span aria-hidden="true">{spec.emoji}</span>
                <span>
                  <strong className="font-semibold">{spec.label}</strong>
                  <span className="sr-only"> de {partner?.name}</span>
                </span>
              </span>
            )
          })}
        </Card>
      ) : null}

      {me && partner ? (
        <PairWeek
          me={me}
          partner={partner}
          today={today}
          maxDays={limits.pairDays}
          {...(limits.pairDays < PAIR_DAYS
            ? {
                lockedNote: (
                  <ProLock
                    className="mt-3 min-h-0 py-3"
                    message={`Você vê os últimos ${limits.pairDays} dias. A semana inteira faz parte do PRO.`}
                  />
                ),
              }
            : {})}
        />
      ) : null}

      <Card aria-labelledby={`incentivo-${pair.id}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id={`incentivo-${pair.id}`} className="eyebrow text-[0.72rem] text-ink-muted">
            Mandar um incentivo
          </h2>
          <span className="text-xs text-ink-faint tabular">
            {usedToday}/{limits.pairEncouragementsPerDay} hoje
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-faint">
          {reading.partnerReturning ? 'Hoje, apoio funciona melhor que cobrança.' : 'Sem texto: só o gesto.'}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {ENCOURAGEMENTS.map((spec) => {
            const sent = user ? alreadySent(pair, user.id, spec.kind, today) : false
            return (
              <EncouragementTile
                key={spec.kind}
                spec={spec}
                suggested={spec.kind === reading.suggested}
                sent={sent}
                disabled={!sent && quotaReached}
                busy={controller.sending?.pairId === pair.id && controller.sending.kind === spec.kind}
                onSend={() => void controller.send(pair.id, spec.kind)}
              />
            )
          })}
        </div>

        {quotaReached && !pro ? (
          <UpgradeHint
            className="mt-3"
            message={`Hoje você já mandou o teu incentivo nessa dupla. Os ${ENCOURAGEMENTS.length} gestos, todo dia, fazem parte do PRO.`}
          />
        ) : null}
      </Card>

      {reading.bothAway ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <IconWell name="retomar" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink">Retomar em dupla</h2>
              <p className="text-sm text-ink-muted">Uma ação pequena de cada lado hoje já recomeça a contagem.</p>
            </div>
          </div>
          <PrimaryButton
            onClick={() => {
              track('pair_return_started', 'juntos')
              navigate('/app')
            }}
          >
            Escolher minha ação de hoje
          </PrimaryButton>
        </Card>
      ) : null}

      <button
        type="button"
        onClick={() => setConfirmLeave(true)}
        className="self-center px-2 py-2 text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
      >
        {partner ? `Desfazer a dupla com ${partner.name.split(' ')[0]}` : 'Desfazer a dupla'}
      </button>

      <ConfirmDialog
        open={confirmLeave}
        title="Desfazer a dupla?"
        description={`A dupla acaba para os dois lados. ${partner?.name ?? 'A outra pessoa'} deixa de ver se você avançou, e você deixa de ver o dia dela. Seu progresso continua igual.`}
        confirmLabel="Desfazer"
        destructive
        onConfirm={() => void controller.leave(pair.id)}
        onClose={() => setConfirmLeave(false)}
      />
    </section>
  )
}

const VISIBLE = ['Se você avançou hoje', 'Em quais dos últimos sete dias você avançou'] as const
const HIDDEN = ['Objetivos, ações e hábitos', 'Notas, check-ins e registros', 'XP, nível, score e conquistas'] as const

function PrivacyCard() {
  return (
    <Card aria-labelledby="privacidade-dupla">
      <h2 id="privacidade-dupla" className="eyebrow text-[0.72rem] text-ink-muted">
        O que a outra pessoa vê
      </h2>
      <ul className="mt-3 grid gap-2 text-sm">
        {VISIBLE.map((item) => (
          <PrivacyItem key={item} ok>
            {item}
          </PrivacyItem>
        ))}
        {HIDDEN.map((item) => (
          <PrivacyItem key={item}>{item}</PrivacyItem>
        ))}
      </ul>
    </Card>
  )
}

function PrivacyItem({ children, ok = false }: { readonly children: string; readonly ok?: boolean }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full',
          ok ? 'bg-positive/15 text-positive-ink' : 'well text-ink-faint',
        )}
      >
        <Icon name={ok ? 'check' : 'oculto'} className="size-3.5" strokeWidth={2.25} />
      </span>
      <span className={ok ? 'text-ink' : 'text-ink-faint'}>
        {children}
        <span className="sr-only">{ok ? ': visível' : ': nunca aparece'}</span>
      </span>
    </li>
  )
}
