import { Link } from 'react-router-dom'
import { activityType } from '@/domain/entities/activity-type'
import {
  CHALLENGE_STATUS_LABELS,
  describeChallenge,
  daysLeftOf,
} from '@/domain/entities/challenge'
import type { DayKey } from '@/domain/entities/day'
import { ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import type { ChallengeView } from './use-challenges'

/**
 * O desafio na lista.
 *
 * Mostra o SEU avanço grande e o do grupo pequeno, nessa ordem. Invertido, a
 * primeira coisa que a pessoa leria seria a média dos outros — e desafio entre
 * amigos que abre com a comparação vira cobrança antes de virar companhia.
 */
export function ChallengeCard({
  view,
  today,
}: {
  readonly view: ChallengeView
  readonly today: DayKey
}) {
  const { challenge, progress } = view
  const type = activityType(challenge.axis)
  const daysLeft = daysLeftOf(challenge, today)

  return (
    <Link
      to={`/app/desafios/${challenge.id}`}
      className="surface-card flex flex-col gap-3 p-4 transition-colors hover:border-line-hi active:bg-surface-hi"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight text-ink">
            {challenge.name}
          </h3>
          <p className="mt-0.5 truncate text-sm text-ink-faint">
            {describeChallenge(challenge, view.habitName)}
          </p>
        </div>
        <Tag color={type.colorToken}>{type.label}</Tag>
      </div>

      {progress ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="tabular text-2xl font-semibold text-ink">
              {progress.done}
              <span className="text-base font-normal text-ink-faint"> de {progress.required} dias</span>
            </p>
            <span className="shrink-0 text-xs text-ink-faint">
              {view.running
                ? daysLeft === 1
                  ? 'último dia'
                  : `${daysLeft} dias restantes`
                : CHALLENGE_STATUS_LABELS[progress.status]}
            </span>
          </div>

          <ProgressBar
            value={progress.ratio}
            label={`Teu avanço em ${challenge.name}`}
            color={type.colorToken}
          />

          <p className="text-sm text-ink-muted">{progress.summary}</p>
        </>
      ) : null}

      <p className="border-t border-line pt-3 text-xs text-ink-faint">
        {view.people === 1
          ? 'Só você por enquanto. Chama alguém do teu círculo.'
          : `${view.people} pessoas · grupo em ${Math.round(view.groupRatio * 100)}%`}
      </p>
    </Link>
  )
}
