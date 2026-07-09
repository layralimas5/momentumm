import { Section } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'

/** Vira a objeção: não é motivação que falta, é um lugar pra continuar. */
export function NoMoreMotivation() {
  return (
    <Section className="relative">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          Você não precisa de mais motivação.
        </h2>

        <div className="mt-8 space-y-2 text-lg leading-relaxed text-zinc-400">
          <p>Você provavelmente já salvou vídeos.</p>
          <p>Já fez listas.</p>
          <p>Já prometeu que segunda-feira seria diferente.</p>
        </div>

        <div className="mt-8 space-y-3 text-lg leading-relaxed text-zinc-300">
          <p>Talvez você não precise de mais uma frase dizendo para acreditar em si.</p>
          <p>
            Talvez você só precise de um lugar que{' '}
            <span className="font-medium text-white">te ajude a continuar</span>.
          </p>
        </div>

        <p className="mt-8 text-balance text-2xl font-medium leading-snug md:text-3xl">
          <span className="bg-gradient-to-r from-brand-300 to-blush-400 bg-clip-text text-transparent">
            É isso que o Aura quer ser.
          </span>
        </p>
      </Reveal>
    </Section>
  )
}
