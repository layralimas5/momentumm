import { X } from 'lucide-react'
import { Section } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'

const frictions = [
  'Sem dez apps.',
  'Sem metas esquecidas nas notas do celular.',
  'Sem perder de vista o que importa pra você.',
]

/** Reforço de valor — remove a fricção e afirma o essencial (copy da Layra). */
export function WhyAura() {
  return (
    <Section className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute right-1/2 top-1/2 -z-10 h-80 w-[600px] max-w-full translate-x-1/2 -translate-y-1/2 rounded-full bg-blush-500/10 blur-[120px]"
      />
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          Tudo pra você continuar evoluindo.
        </h2>
      </Reveal>

      <Reveal className="mx-auto mt-10 max-w-md">
        <ul className="space-y-3">
          {frictions.map((f) => (
            <li
              key={f}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-zinc-400 hover:aura-pulse"
            >
              <X className="h-4 w-4 shrink-0 text-zinc-600" />
              {f}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal className="mx-auto mt-10 max-w-2xl text-center">
        <p className="text-balance text-2xl font-medium leading-snug md:text-3xl">
          <span className="bg-gradient-to-r from-brand-300 to-blush-400 bg-clip-text text-transparent">
            Só você e a vida que decidiu construir.
          </span>
        </p>
      </Reveal>
    </Section>
  )
}
