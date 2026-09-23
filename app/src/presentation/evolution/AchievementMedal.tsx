import { motion, useReducedMotion } from 'framer-motion'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * A medalha de uma conquista.
 *
 * Três estados, e a diferença entre eles é o material, não só a cor: bloqueada
 * é uma peça fosca, conquistada é ouro, e a rara é ouro com o brilho da marca
 * por trás. Assim a estante tem hierarquia à distância, que é o que faz alguém
 * querer colecionar.
 *
 * O ouro só existe aqui. Laranja continua exclusivo do streak e violeta, da
 * marca: uma cor que aparece em um lugar só é uma cor que significa alguma
 * coisa quando aparece.
 *
 * O hexágono é desenhado em SVG e não em imagem: cada conquista nova entra sem
 * pedir um arquivo novo, e a peça acompanha o tema claro e o escuro.
 */
export type MedalState = 'bloqueada' | 'conquistada' | 'rara'

const SIZES = {
  sm: { box: 'size-14', icon: 'size-5' },
  md: { box: 'size-20', icon: 'size-7' },
} as const

export function AchievementMedal({
  icon,
  state,
  size = 'sm',
  className,
}: {
  readonly icon: IconName
  readonly state: MedalState
  readonly size?: keyof typeof SIZES
  readonly className?: string
}) {
  const reduceMotion = useReducedMotion()
  const dimension = SIZES[size]
  const gradientId = `medalha-${state}-${size}`

  return (
    <motion.span
      aria-hidden="true"
      initial={reduceMotion || state === 'bloqueada' ? false : { scale: 0.86, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className={cn('relative grid shrink-0 place-items-center', dimension.box, className)}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0.4" y2="1">
            {state === 'rara' || state === 'conquistada' ? (
              <>
                <stop offset="0%" stopColor="var(--color-medal-hi)" />
                <stop offset="55%" stopColor="var(--color-medal)" />
                <stop offset="100%" stopColor="var(--color-medal-deep)" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="var(--color-surface-hi)" />
                <stop offset="100%" stopColor="var(--color-surface)" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* Hexágono de ponta pra cima: a silhueta de medalha sem virar troféu. */}
        <path
          d="M50 3 92 27v46L50 97 8 73V27z"
          fill={`url(#${gradientId})`}
          stroke={
            state === 'bloqueada' ? 'var(--color-line)' : 'var(--color-medal-hi)'
          }
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* A luz de cima: é ela que dá relevo sem sombra pesada. */}
        <path
          d="M50 3 92 27 50 50 8 27z"
          fill="var(--color-ink)"
          opacity={state === 'bloqueada' ? 0.03 : 0.1}
        />
      </svg>

      <Icon
        name={icon}
        className={cn(
          'relative',
          dimension.icon,
          // Sobre ouro o ícone é escuro: é o par que passa em contraste nos dois temas.
          state === 'bloqueada' ? 'text-ink-faint opacity-60' : 'text-[#1a1408]',
        )}
        strokeWidth={2.25}
      />

      {/* A rara não muda de metal: ganha o halo da marca atrás do ouro. */}
      {state === 'rara' ? (
        <span
          className="absolute -inset-1.5 -z-10 rounded-full bg-brand/35 blur-lg"
          aria-hidden="true"
        />
      ) : null}
    </motion.span>
  )
}
