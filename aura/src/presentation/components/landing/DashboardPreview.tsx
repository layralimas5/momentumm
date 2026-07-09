import { Target, BookOpen, TrendingUp, Compass } from 'lucide-react'

/**
 * Mockup estilizado do dashboard "Jornada" em dark glass — prova visual do
 * produto real. Decorativo (aria-hidden).
 */
export function DashboardPreview() {
  return (
    <div
      aria-hidden
      className="w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40 backdrop-blur-md"
    >
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-3 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <Compass className="h-3.5 w-3.5" />
          Sua jornada
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <p className="text-sm font-semibold text-white">Sua jornada</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          A realização de nossos sonhos depende exclusivamente de nós.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            { icon: Target, label: 'Metas', value: '3' },
            { icon: TrendingUp, label: 'Progresso', value: '40%' },
            { icon: BookOpen, label: 'Lendo', value: '1' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-500/15 text-brand-300">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <p className="mt-1.5 text-[10px] text-zinc-500">{label}</p>
              <p className="text-sm font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2.5">
          {[
            { title: 'Ler 12 livros este ano', pct: 66 },
            { title: 'Rotina de manhã', pct: 40 },
          ].map((goal) => (
            <div key={goal.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-200">{goal.title}</span>
                <span className="text-[10px] font-medium text-brand-300">{goal.pct}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-blush-400"
                  style={{ width: `${goal.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
