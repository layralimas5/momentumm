import { Link } from 'react-router-dom'
import { Icon } from '@/presentation/components/ui/Icon'
import type { AlertTone, DayAlert } from '@/presentation/planner/use-day-alerts'
import { cn } from '@/shared/lib/cn'

/** Cor só no ícone. Card inteiro pintado de vermelho não faz ninguém agir: faz fechar o app. */
const TONES: Record<AlertTone, string> = {
  danger: 'bg-danger/12 text-danger',
  warn: 'bg-flame-dim/70 text-flame',
  brand: 'bg-brand-dim/70 text-brand-ink',
  positive: 'bg-positive/12 text-positive',
}

/**
 * Os recados que abrem o dia, logo abaixo da saudação.
 *
 * Eram notificações dentro do sino — e notificação escondida atrás de um ícone
 * não muda decisão nenhuma. Aqui elas são a primeira coisa que a pessoa lê,
 * porque é o que ficou pra trás que determina o tamanho do dia que ela vai
 * montar logo abaixo.
 *
 * Só os dois primeiros aparecem. O terceiro recado seguido empurra a ação do
 * dia pra fora da primeira dobra, e uma tela que começa com cinco avisos é uma
 * tela que começa com uma cobrança. O resto continua inteiro no sino.
 *
 * Cada cartão tem duas saídas: o texto leva pra tela que resolve, e o X diz
 * "já li". Dispensar vale pelo DIA — amanhã, se o motivo continuar de pé, o
 * recado volta. Esconder um problema para sempre porque alguém o viu uma vez
 * seria o app mentindo por educação.
 */
export function MobileAlerts({
  alerts,
  onDismiss,
  limit = 2,
}: {
  readonly alerts: readonly DayAlert[]
  /** Lido, sai da tela. Volta amanhã se o motivo continuar de pé. */
  readonly onDismiss: (id: string) => void
  readonly limit?: number
}) {
  const shown = alerts.slice(0, limit)
  if (shown.length === 0) return null

  return (
    <section aria-label="Precisa da sua atenção" className="flex flex-col gap-2.5">
      {shown.map((alert) => (
        /*
          Dois alvos na mesma linha, e por isso o cartão não é um link inteiro:
          o texto leva pra tela que resolve, o X à direita diz "já li". Um
          botão dentro de um link seria um alvo dentro de outro, e o polegar
          erraria os dois.
        */
        <div
          key={alert.id}
          className="flex items-center gap-2 rounded-2xl border border-line bg-surface pr-1.5"
        >
          <Link
            to={alert.to}
            className="flex min-w-0 flex-1 items-center gap-3.5 py-3.5 pl-4 transition-colors active:bg-surface-hi"
          >
            <span
              aria-hidden="true"
              className={cn('grid size-10 shrink-0 place-items-center rounded-full', TONES[alert.tone])}
            >
              <Icon name={alert.icon} className="size-5" strokeWidth={2} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug font-semibold text-ink">{alert.title}</span>
              <span className="mt-0.5 block text-sm leading-snug text-pretty text-ink-faint">
                {alert.body}
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => onDismiss(alert.id)}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors active:bg-surface-hi active:text-ink"
          >
            <Icon name="fechar" className="size-4" />
            <span className="sr-only">Dispensar: {alert.title}</span>
          </button>
        </div>
      ))}
    </section>
  )
}
