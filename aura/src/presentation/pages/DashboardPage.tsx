import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Target, BookOpen, TrendingUp, ArrowRight } from 'lucide-react'
import { GoalRules } from '@/domain/entities/goal'
import { READING_STATUS_LABEL } from '@/domain/entities/book'
import { useGoals } from '@/presentation/hooks/use-goals'
import { useBooks } from '@/presentation/hooks/use-books'
import { Card } from '@/presentation/components/ui/Card'
import { Badge } from '@/presentation/components/ui/Badge'
import { ProgressBar } from '@/presentation/components/ui/ProgressBar'

const PHRASES = [
  'A realização de nossos sonhos depende exclusivamente de nós.',
  'Um passo por dia ainda é movimento. Simbora.',
  'Você não precisa ser perfeita, só constante.',
  'A mulher que você quer ser começa nas escolhas de hoje.',
]

export function DashboardPage() {
  const reduce = useReducedMotion()
  const { goals, loading: loadingGoals } = useGoals()
  const { books, loading: loadingBooks } = useBooks()

  const activeGoals = goals.filter((g) => !GoalRules.isComplete(g))
  const reading = books.find((b) => b.status === 'reading') ?? null

  const avgProgress = useMemo(() => {
    if (activeGoals.length === 0) return 0
    const sum = activeGoals.reduce((acc, g) => acc + g.progress, 0)
    return Math.round(sum / activeGoals.length)
  }, [activeGoals])

  // Frase do dia — determinística, muda a cada dia.
  const phrase =
    PHRASES[new Date().getDate() % PHRASES.length] ?? PHRASES[0]

  const loading = loadingGoals || loadingBooks

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl dark:text-zinc-50">
          Sua jornada
        </h1>
        <p className="mt-1 text-pretty text-zinc-600 dark:text-zinc-400">{phrase}</p>
      </motion.header>

      {/* Métricas */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Target} label="Metas ativas" value={activeGoals.length} loading={loading} />
        <StatCard
          icon={TrendingUp}
          label="Progresso médio"
          value={`${avgProgress}%`}
          loading={loading}
        />
        <StatCard
          icon={BookOpen}
          label="Lendo agora"
          value={books.filter((b) => b.status === 'reading').length}
          loading={loading}
        />
      </section>

      {/* Metas em andamento */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Metas em andamento
          </h2>
          <Link
            to="/app/metas"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
          >
            Ver todas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <SkeletonList />
        ) : activeGoals.length === 0 ? (
          <EmptyState
            text="Nenhuma meta ativa ainda. Que passo você quer dar primeiro?"
            to="/app/metas"
            cta="Criar meta"
          />
        ) : (
          <div className="grid gap-4">
            {activeGoals.slice(0, 3).map((goal) => (
              <Card key={goal.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="mt-1 line-clamp-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <Badge tone="brand">{goal.progress}%</Badge>
                </div>
                <ProgressBar
                  value={goal.progress}
                  label={`Progresso de ${goal.title}`}
                  className="mt-4"
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Leitura atual */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Leitura atual
          </h2>
          <Link
            to="/app/leituras"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
          >
            Ver estante <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <SkeletonList rows={1} />
        ) : reading ? (
          <Card className="flex items-center gap-4 p-5">
            <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-400 to-blush-400 text-white">
              <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {reading.title}
                </h3>
                <Badge tone="success">{READING_STATUS_LABEL[reading.status]}</Badge>
              </div>
              {reading.author && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{reading.author}</p>
              )}
              <ProgressBar
                value={reading.progress}
                label={`Progresso de ${reading.title}`}
                className="mt-3"
              />
            </div>
          </Card>
        ) : (
          <EmptyState
            text="Nenhuma leitura em andamento. Qual livro vai te acompanhar agora?"
            to="/app/leituras"
            cta="Adicionar livro"
          />
        )}
      </section>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof Target
  label: string
  value: string | number
  loading: boolean
}) {
  return (
    <Card className="p-5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {loading ? '—' : value}
      </p>
    </Card>
  )
}

function EmptyState({ text, to, cta }: { text: string; to: string; cta: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 border-dashed py-10 text-center">
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
      >
        {cta} <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  )
}

function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        />
      ))}
    </div>
  )
}
