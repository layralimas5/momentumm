import { useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'

/**
 * A faixa de objetivos logo abaixo do hero.
 *
 * O Momentumm é multi eixo, e a página só mostrava um exemplo (ler 12
 * livros). A esteira responde "serve pro meu objetivo?" antes da pessoa
 * perguntar. São exemplos de meta com prazo, não depoimentos: nenhum nome,
 * nenhum número de usuário. Cada cor é a do eixo no app.
 *
 * Com movimento reduzido a faixa para e vira uma linha que quebra.
 */
const GOALS: readonly { readonly label: string; readonly color: string }[] = [
  { label: 'Ler 12 livros até dezembro', color: 'var(--color-axis-leitura)' },
  { label: 'Correr 5 km em 8 semanas', color: 'var(--color-axis-treino)' },
  { label: 'Inglês 20 minutos por dia', color: 'var(--color-axis-estudo)' },
  { label: 'Meditar antes de dormir', color: 'var(--color-axis-meditacao)' },
  { label: 'Juntar R$ 5 mil até julho', color: 'var(--color-axis-custom-2)' },
  { label: 'Terminar o TCC no prazo', color: 'var(--color-axis-estudo)' },
  { label: 'Lançar meu projeto', color: 'var(--color-axis-custom-1)' },
  { label: 'Passar no concurso', color: 'var(--color-axis-custom-3)' },
]

export function GoalsMarquee() {
  const reduced = useReducedMotion() === true

  return (
    <section aria-label="Exemplos de objetivos" className="relative py-10 sm:py-14">
      <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-ink-faint">
        Qualquer objetivo com prazo cabe aqui
      </p>

      <div
        className="group mt-6 overflow-hidden"
        style={{
          maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
        }}
      >
        <div
          className={cn(
            reduced
              ? 'mx-auto flex max-w-5xl flex-wrap justify-center gap-3 px-4'
              : 'flex w-max animate-marquee group-hover:[animation-play-state:paused]',
          )}
          style={reduced ? undefined : { animationDuration: '45s' }}
        >
          <GoalList wrap={reduced} />
          {reduced ? null : <GoalList hidden />}
        </div>
      </div>
    </section>
  )
}

/** A segunda cópia existe só pra emenda da esteira, e fica fora do leitor de tela. */
function GoalList({ hidden = false, wrap = false }: { readonly hidden?: boolean; readonly wrap?: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className={cn('flex shrink-0 gap-3', wrap ? 'flex-wrap justify-center' : 'pr-3')}
    >
      {GOALS.map((goal) => (
        <li
          key={goal.label}
          className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-surface/60 px-4 py-2 text-sm text-ink-muted"
        >
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: goal.color, boxShadow: `0 0 10px ${goal.color}` }}
          />
          {goal.label}
        </li>
      ))}
    </ul>
  )
}
