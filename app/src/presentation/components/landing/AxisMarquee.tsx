import { BUILTIN_ACTIVITY_TYPE_LIST } from '@/domain/entities/activity-type'

/** Eixos que já existem, seguidos dos que entram conforme o produto cresce. */
const COMING = ['Escrita', 'Sono', 'Hidratação', 'Terapia', 'Curso', 'Caminhada'] as const

const AXES: readonly string[] = [
  ...BUILTIN_ACTIVITY_TYPE_LIST.map((type) => type.label),
  ...COMING,
]

export function AxisMarquee() {
  return (
    <div className="marquee relative overflow-hidden border-y border-line bg-surface/40 py-4">
      {/* Desvanece nas pontas pra faixa não começar nem terminar num corte seco. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-canvas to-transparent sm:w-28"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-canvas to-transparent sm:w-28"
      />

      <div className="marquee-track flex w-max">
        {/* Duas cópias idênticas: a segunda cobre o vão enquanto a primeira sai. */}
        <AxisList />
        <AxisList duplicate />
      </div>
    </div>
  )
}

function AxisList({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center"
      {...(duplicate ? { 'aria-hidden': true } : { 'aria-label': 'Eixos do Momentumm' })}
    >
      {AXES.map((label) => (
        <li key={label} className="shrink-0 px-6 text-sm font-medium text-ink">
          {label}
        </li>
      ))}
    </ul>
  )
}
