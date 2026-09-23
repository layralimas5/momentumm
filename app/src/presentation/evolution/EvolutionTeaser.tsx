import { Link } from 'react-router-dom'
import { achievementSpec } from '@/domain/entities/evolution'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader, ProgressBar } from '@/presentation/components/ui/Surface'
import { AchievementMedal } from './AchievementMedal'
import { useEvolution } from './use-evolution'

/** Quantas medalhas cabem antes de virar catálogo. O resto está na Evolução. */
const SHELF_SIZE = 6

/**
 * A evolução dentro do Progresso.
 *
 * As duas telas medem coisas diferentes e o app precisa que isso fique óbvio:
 * o Momentumm é o estado de hoje, de 0 a 100, e cai sozinho quando a pessoa
 * para; o XP é tudo que ela já construiu e nunca desce. Ver os dois na mesma
 * tela, um embaixo do outro, é o que ensina a diferença sem explicar.
 *
 * Aqui entra só a estante: nível, XP acumulado e as medalhas mais recentes.
 * O detalhamento continua inteiro na Evolução, a um toque.
 */
export function EvolutionTeaser() {
  const { summary, loading } = useEvolution()
  if (loading) return null

  const { progress } = summary
  const unlocked = summary.achievements.filter((item) => item.unlockedAt !== null)

  // Conquistadas primeiro; o resto entra bloqueado, que é o que dá vontade de ir buscar.
  const shelf = [...unlocked, ...summary.achievements.filter((item) => item.unlockedAt === null)]
    .slice(0, SHELF_SIZE)

  return (
    <Panel aria-labelledby="evolucao-resumo">
      <PanelHeader
        id="evolucao-resumo"
        title="Sua evolução"
        icon="trofeu"
        action={
          <Link
            to="/app/evolucao"
            className="inline-flex items-center gap-1 text-sm text-brand-ink transition-colors hover:text-brand-hi"
          >
            Ver tudo
            <Icon name="seta" className="size-3.5" />
          </Link>
        }
      />

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink">
          Nível {progress.level}
          <span className="text-ink-muted"> · {progress.name}</span>
        </p>
        <p className="tabular text-sm text-ink-muted">{progress.xpTotal} XP</p>
      </div>

      <ProgressBar
        className="mt-2"
        value={progress.percent / 100}
        label={`Progresso do nível ${progress.level}`}
      />

      <p className="mt-1.5 text-xs text-ink-faint">
        {progress.xpToNext > 0
          ? `Faltam ${progress.xpToNext} XP pro nível ${progress.level + 1}.`
          : 'Nível máximo da tabela: daqui pra frente o XP continua somando.'}
      </p>

      <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {shelf.map((item) => {
          const spec = achievementSpec(item.key)
          const done = item.unlockedAt !== null

          return (
            <li key={item.key} className="flex flex-col items-center gap-1.5 text-center">
              <AchievementMedal
                icon={medalIcon(spec.icon)}
                state={done ? (spec.rarity === 'rara' ? 'rara' : 'conquistada') : 'bloqueada'}
              />
              <span className="text-[0.6875rem] leading-tight text-balance text-ink-faint">
                {spec.name}
              </span>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-xs text-ink-faint">
        O Momentumm mede como está o teu momento agora. O XP é o que você já construiu: ele não
        desce.
      </p>
    </Panel>
  )
}

/** O domínio guarda a chave como texto; sem ícone conhecido, medalha genérica. */
function medalIcon(name: string): IconName {
  return name in KNOWN ? (name as IconName) : 'trofeu'
}

const KNOWN: Readonly<Record<string, true>> = {
  check: true,
  calendario: true,
  plano: true,
  jornada: true,
  raio: true,
  fogo: true,
  trofeu: true,
  objetivo: true,
  metas: true,
  insights: true,
  progresso: true,
}
