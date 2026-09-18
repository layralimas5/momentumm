import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { activityType } from '@/domain/entities/activity-type'
import {
  CHALLENGE_STATUS_LABELS,
  daysLeftOf,
  describeChallenge,
  isChallengeRunning,
  requiredDays,
} from '@/domain/entities/challenge'
import { formatDayLong } from '@/domain/entities/day'
import { isHabitRunning } from '@/domain/entities/habit'
import { challengeShareEvent } from '@/domain/share/journey-event-builders'
import {
  useChallenges,
  type ChallengesState,
  type ChallengeView,
} from '@/presentation/challenges/use-challenges'
import { useCircle } from '@/presentation/circle/use-circle'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Field, Select } from '@/presentation/components/ui/Field'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { useAuth } from '@/presentation/auth/use-auth'
import { usePlanner } from '@/presentation/planner/use-planner'
import { ShareButton } from '@/presentation/share/ShareButton'
import { PageHeader } from './PageHeader'

/**
 * O desafio por dentro.
 *
 * Quatro blocos, nessa ordem: o combinado, o teu avanço, quem está junto e a
 * manutenção (convidar, sair, encerrar). O teu avanço vem antes do dos outros
 * de propósito — a tela existe pra te dizer o que falta, e só depois quem mais
 * está caminhando.
 */
export function ChallengeDetailPage() {
  const { id = '' } = useParams()
  const challenges = useChallenges()
  const planner = usePlanner()

  if (challenges.loading) return <LoadingBlock label="Carregando o desafio" />

  const view = challenges.viewOf(id)

  if (!view) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title="Desafio não encontrado"
          description="Ele pode ter sido encerrado, ou você não faz parte dele."
        />
        <Link to="/app/desafios" className="mt-4 inline-block text-sm text-brand-hi">
          Voltar pros desafios
        </Link>
      </div>
    )
  }

  const type = activityType(view.challenge.axis)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 lg:gap-6">
      <PageHeader
        title={view.challenge.name}
        description={describeChallenge(view.challenge, view.habitName)}
      />

      {challenges.error ? <ErrorNote message={challenges.error} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Tag color={type.colorToken}>{type.label}</Tag>
        <Tag>
          {formatDayLong(view.challenge.startsOn, planner.today)} a{' '}
          {formatDayLong(view.challenge.endsOn, planner.today)}
        </Tag>
        {view.running ? (
          <Tag tone="brand">
            {daysLeftOf(view.challenge, planner.today) === 1
              ? 'Último dia'
              : `${daysLeftOf(view.challenge, planner.today)} dias restantes`}
          </Tag>
        ) : (
          <Tag tone="neutral">Encerrado</Tag>
        )}
      </div>

      {view.challenge.description ? (
        <p className="text-pretty text-sm text-ink-muted">{view.challenge.description}</p>
      ) : null}

      <MyProgress view={view} challenges={challenges} />
      <Participants view={view} challenges={challenges} />
      <Manage view={view} challenges={challenges} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// o meu avanço
// ---------------------------------------------------------------------------

function MyProgress({
  view,
  challenges,
}: {
  readonly view: ChallengeView
  readonly challenges: ChallengesState
}) {
  const planner = usePlanner()
  const { user } = useAuth()
  const { progress, me } = view

  if (!progress || !me) return null

  const type = activityType(view.challenge.axis)
  const habits = planner.habits.filter(
    (habit) => isHabitRunning(habit) && habit.axis === view.challenge.axis,
  )

  return (
    <Panel tone="raised">
      <PanelHeader title="Teu avanço" icon="progresso" />

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="tabular text-3xl font-semibold text-ink">
          {progress.done}
          <span className="text-lg font-normal text-ink-faint"> de {progress.required} dias</span>
        </p>
        <span className="shrink-0 text-sm text-ink-faint">
          {CHALLENGE_STATUS_LABELS[progress.status]}
        </span>
      </div>

      <ProgressBar
        value={progress.ratio}
        label="Teu avanço no desafio"
        color={type.colorToken}
        className="mt-3"
      />

      <p className="mt-3 text-sm text-ink-muted">{progress.summary}</p>

      {/*
        O vínculo do hábito é individual e fica aqui, junto do progresso: é o
        controle que muda o número logo acima, e escondê-lo em configurações
        faria a pessoa procurar por que o desafio não conta o treino dela.
      */}
      <div className="mt-4 border-t border-line pt-4">
        <Field
          label="De onde vem o teu progresso"
          hint={
            me.habitId
              ? 'Cada dia em que você cumpre esse hábito conta aqui.'
              : `Conta o dia em que você registrar ${type.unitLabel.many} suficientes em ${type.label}.`
          }
        >
          {(id) => (
            <Select
              id={id}
              value={me.habitId ?? ''}
              disabled={challenges.acting}
              onChange={(event) => void challenges.setHabit(me.id, event.target.value || null)}
            >
              <option value="">Pelo que eu registrar em {type.label}</option>
              {habits.map((habit) => (
                <option key={habit.id} value={habit.id}>
                  Quando eu cumprir “{habit.name}”
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {user ? (
        <div className="mt-4">
          <ShareButton
            label="Compartilhar"
            build={() =>
              challengeShareEvent({
                userId: user.id,
                today: planner.today,
                challengeId: view.challenge.id,
                name: view.challenge.name,
                axis: view.challenge.axis,
                doneDays: progress.done,
                requiredDays: requiredDays(view.challenge),
                people: view.people,
                momentum: null,
              })
            }
          />
        </div>
      ) : null}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// quem está junto
// ---------------------------------------------------------------------------

function Participants({
  view,
  challenges,
}: {
  readonly view: ChallengeView
  readonly challenges: ChallengesState
}) {
  const { user } = useAuth()
  const type = activityType(view.challenge.axis)
  const waiting = view.participants.filter((item) => item.status === 'convidado')

  return (
    <Panel>
      <PanelHeader
        title="Quem está junto"
        icon="jornada"
        hint={`Grupo em ${Math.round(view.groupRatio * 100)}% do combinado.`}
      />

      {/*
        A classificação existe DENTRO do desafio e só com o número que as duas
        pessoas combinaram cumprir. Nenhum Momentumm, nenhuma constância, nenhum
        volume: o score é a comparação de alguém com ela mesma, e trazê-lo pra
        cá montaria a tabela entre amigos que o produto recusa.
      */}
      <ol className="mt-4 flex flex-col divide-y divide-line">
        {view.ranking.map(({ progress, position }) => {
          const isMe = progress.participant.userId === user?.id
          const person = challenges.personOf(progress.participant.userId)
          const name = isMe ? 'Você' : (person?.name ?? 'Alguém do círculo')

          return (
            <li key={progress.participant.id} className="flex items-center gap-3 py-3">
              <span className="tabular w-5 shrink-0 text-sm text-ink-faint">{position}</span>
              <Avatar name={name} src={person?.avatarUrl ?? null} className="size-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{name}</span>
                <ProgressBar
                  value={progress.ratio}
                  label={`Avanço de ${name}`}
                  color={isMe ? type.colorToken : 'var(--color-line-hi)'}
                  className="mt-1.5"
                />
              </span>
              <span className="tabular shrink-0 text-sm text-ink-muted">
                {progress.done}/{progress.required}
              </span>
            </li>
          )
        })}
      </ol>

      {waiting.length > 0 ? (
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-faint">
          {waiting.length === 1
            ? '1 convite ainda sem resposta.'
            : `${waiting.length} convites ainda sem resposta.`}
        </p>
      ) : null}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// convidar, sair, encerrar
// ---------------------------------------------------------------------------

function Manage({
  view,
  challenges,
}: {
  readonly view: ChallengeView
  readonly challenges: ChallengesState
}) {
  const navigate = useNavigate()
  const planner = usePlanner()
  /*
    O Círculo é a única fonte de quem dá pra convidar, e não é um atalho: o
    convite só existe entre amigos, e a RLS recusa qualquer outro. Ler daqui
    garante que a lista da tela é exatamente a lista que o banco aceita.
  */
  const circle = useCircle()
  const [leaving, setLeaving] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const already = new Set(view.participants.map((item) => item.userId))
  const invitable = circle.friends.filter((friend) => !already.has(friend.person.id))
  const running = isChallengeRunning(view.challenge, planner.today)

  return (
    <>
      {view.isOwner && running ? (
        <Panel>
          <PanelHeader title="Chamar alguém" icon="busca" />

          {circle.loading ? (
            <p className="mt-4 text-sm text-ink-muted">Carregando teu círculo…</p>
          ) : invitable.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">
              {circle.friends.length === 0 ? (
                <>
                  Você ainda não tem ninguém no círculo.{' '}
                  <Link to="/app/circulo" className="text-brand-hi">
                    Adicionar alguém
                  </Link>
                  .
                </>
              ) : (
                'Todo mundo do teu círculo já está aqui.'
              )}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-line">
              {invitable.map((friend) => (
                <li key={friend.person.id} className="flex items-center gap-3 py-2.5">
                  <Avatar
                    name={friend.person.name}
                    src={friend.person.avatarUrl}
                    className="size-9"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {friend.person.name}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={challenges.acting}
                    onClick={() =>
                      void challenges.invite(view.challenge.id, friend.person.id)
                    }
                  >
                    Convidar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {view.isOwner ? (
          running ? (
            <Button variant="danger" onClick={() => setFinishing(true)}>
              Encerrar desafio
            </Button>
          ) : null
        ) : (
          <Button variant="danger" onClick={() => setLeaving(true)}>
            Sair do desafio
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={finishing}
        title="Encerrar o desafio?"
        description="Ele fecha pra todo mundo e o progresso de cada um fica como está. Não dá pra reabrir."
        confirmLabel="Encerrar"
        onConfirm={() => {
          void challenges.finish(view.challenge.id)
          setFinishing(false)
        }}
        onClose={() => setFinishing(false)}
      />

      <ConfirmDialog
        open={leaving}
        title="Sair do desafio?"
        description="Você deixa de aparecer pros outros e para de acompanhar o combinado. Teus hábitos e registros continuam intactos."
        confirmLabel="Sair"
        onConfirm={() => {
          if (view.me) void challenges.leave(view.me.id)
          setLeaving(false)
          navigate('/app/desafios')
        }}
        onClose={() => setLeaving(false)}
      />
    </>
  )
}
