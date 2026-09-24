import { Link } from 'react-router-dom'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'

export interface ShortcutRow {
  readonly to: string
  readonly icon: IconName
  readonly label: string
  /** O número que muda a decisão de abrir. Null quando não há nada a dizer. */
  readonly value: string | null
  /** Destaca a linha quando o número pede atenção (atrasado, novo). */
  readonly alert?: boolean
}

/**
 * O resto do produto, em uma linha cada.
 *
 * Antes, "Ver mais do meu dia" abria seis cards completos — objetivos com
 * parágrafo de diagnóstico, metas em carrossel, insight com dois botões,
 * seletor de foco, campo de vitórias com sugestões. Seis telas de rolagem, e
 * todas elas versões resumidas de telas que já existem no app.
 *
 * O resumo de uma tela não substitui a tela: ele compete com ela. Aqui fica só
 * o que faz alguém decidir abrir — o nome e o número —, e o toque leva pro
 * lugar onde a coisa é feita de verdade.
 *
 * ## Por que número e não gráfico
 *
 * "3 · 1 atrasado" responde em meio segundo, de relance, sem interpretar nada.
 * É a mesma escolha dos cards de cima da tela (Momentum, Hoje, Foco) — e a
 * repetição do padrão é o que faz a tela inteira parecer uma coisa só.
 */
export function MobileShortcutRows({ rows }: { readonly rows: readonly ShortcutRow[] }) {
  return (
    <nav aria-label="Outras partes do seu Momentumm">
      <ul className="surface-card divide-y divide-line overflow-hidden">
        {rows.map((row) => (
          <li key={row.to}>
            <Link
              to={row.to}
              className="flex min-h-14 items-center gap-3.5 px-4 py-3 transition-colors active:bg-surface-hi"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-hi text-ink-muted">
                <Icon name={row.icon} className="size-4" />
              </span>

              <span className="min-w-0 flex-1 text-sm font-medium text-ink">{row.label}</span>

              {row.value ? (
                <span
                  className={
                    row.alert
                      ? 'tabular shrink-0 text-sm font-medium text-flame'
                      : 'tabular shrink-0 text-sm text-ink-faint'
                  }
                >
                  {row.value}
                </span>
              ) : null}

              <Icon name="seta" aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
