import { useState } from 'react'
import { Section } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'

/**
 * Prova autêntica no lugar de depoimentos inventados: a fala da fundadora, na
 * voz da marca. Usa a foto real (/founder.jpg) se existir; senão, um monograma.
 */
export function Manifesto() {
  const [photoOk, setPhotoOk] = useState(true)

  return (
    <Section className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-[560px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/10 blur-[130px]"
      />
      <Reveal className="mx-auto max-w-3xl text-center">
        <span className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-400">
          Uma palavra de quem criou
        </span>

        <blockquote className="mt-8 space-y-5 text-balance text-xl font-medium leading-snug text-white md:text-2xl">
          <p>
            “Eu criei o Aura porque também sei como é ter a cabeça cheia de sonhos e, mesmo
            assim, sentir que não estou saindo do lugar.
          </p>
          <p className="text-zinc-400">
            Eu não queria mais uma frase motivacional ou uma rotina impossível de seguir.
          </p>
          <p className="text-zinc-400">
            Queria um lugar onde eu pudesse olhar e enxergar:{' '}
            <span className="text-white">eu estou caminhando</span>.
          </p>
          <p className="text-zinc-400">O Aura nasceu disso.</p>
          <p className="text-zinc-400">
            E espero que, quando você abrir o seu, também consiga enxergar quem está se
            tornando.”
          </p>
        </blockquote>

        <div className="mt-10 flex items-center justify-center gap-3.5">
          {photoOk ? (
            <img
              src="/founder.jpg"
              alt="Layra Lima"
              width={48}
              height={48}
              loading="lazy"
              onError={() => setPhotoOk(false)}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-white/15"
            />
          ) : (
            <span
              aria-hidden
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-blush-500 text-sm font-semibold text-white ring-2 ring-white/15"
            >
              LL
            </span>
          )}
          <div className="text-left">
            <p className="font-semibold text-white">Layra Lima</p>
            <p className="text-sm text-zinc-400">Criadora do Aura</p>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
