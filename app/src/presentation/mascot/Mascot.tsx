import { motion, useAnimationControls, useReducedMotion, type TargetAndTransition } from 'framer-motion'
import { useEffect, useId } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * O Momo, o mascote do Momentumm.
 *
 * Um seixo roxo com uma faísca na antena: a faísca é o "momentum", o
 * empurrãozinho que o produto inteiro promete. Nada de laranja (é da
 * sequência e de mais nada) e nada de nuvem (é da Cláudia, a referência de
 * onde veio a ideia de ter um personagem no quiz).
 *
 * O movimento é em camadas, como o da referência, e cada camada é
 * independente das outras:
 *
 *   flutua (8,4s) → gesto (curto, único) → respira (4,1s) → corpo
 *   olhos piscam (5,2s) · boca fala (0,9s) · halo pulsa (6,2s) · sombra no chão
 *
 * O gesto é o único que a tela comanda: troca a `key` do `gesture` e ele roda
 * uma vez. Humor (`mood`) muda rosto e boca. Com `prefers-reduced-motion` o
 * Momo fica parado, com a expressão certa e nada se mexendo.
 *
 * É decorativo: `aria-hidden`. Tudo que ele "diz" está escrito na tela.
 */

export type MascotMood =
  | 'idle'
  | 'happy'
  | 'talking'
  | 'thinking'
  | 'celebrate'
  | 'gentle'
  | 'focused'
  | 'cheeky'

export type MascotGestureKind = 'pop' | 'yes' | 'no' | 'jump' | 'tilt'

export interface MascotGesture {
  readonly kind: MascotGestureKind
  /** Muda a cada vez que o gesto deve rodar de novo. */
  readonly key: number | string
}

interface MascotProps {
  readonly size?: number
  readonly mood?: MascotMood
  readonly gesture?: MascotGesture | null
  /** Versão de bolso (barra de progresso): sem halo, sombra nem faísca. */
  readonly mini?: boolean
  readonly className?: string
}

const INK = '#1b1530'
const ORIGIN_BOTTOM = { transformBox: 'fill-box', transformOrigin: '50% 100%' } as const
const ORIGIN_CENTER = { transformBox: 'fill-box', transformOrigin: '50% 50%' } as const

/** Os gestos, com os tempos da referência. Valores em unidades do viewBox (120). */
const GESTURES: Readonly<Record<MascotGestureKind, TargetAndTransition>> = {
  pop: {
    scale: [1, 1.1, 0.96, 1],
    transition: { duration: 0.34, times: [0, 0.35, 0.7, 1], ease: [0.3, 1.5, 0.6, 1] },
  },
  yes: {
    y: [0, 4, -2, 1, 0],
    scaleX: [1, 1.05, 0.98, 1.01, 1],
    scaleY: [1, 0.94, 1.03, 0.99, 1],
    transition: { duration: 0.6, times: [0, 0.25, 0.55, 0.8, 1], ease: 'easeInOut' },
  },
  no: {
    rotate: [0, -6, 6, -3, 1, 0],
    x: [0, -2.4, 2.4, -1, 0, 0],
    transition: { duration: 0.72, times: [0, 0.18, 0.44, 0.68, 0.86, 1], ease: 'easeInOut' },
  },
  jump: {
    y: [0, 0, -20, -20, 2, 0],
    scaleX: [1, 1.12, 0.94, 0.95, 1.08, 1],
    scaleY: [1, 0.86, 1.09, 1.07, 0.92, 1],
    transition: { duration: 0.78, times: [0, 0.14, 0.44, 0.56, 0.82, 1], ease: 'easeOut' },
  },
  tilt: {
    rotate: [0, 11, 8.5, -1.5, 0],
    transition: { duration: 1.1, times: [0, 0.26, 0.62, 0.84, 1], ease: [0.3, 1.25, 0.5, 1] },
  },
}

const HALO: TargetAndTransition = {
  opacity: [0.45, 0.8, 0.6, 0.45],
  scale: [0.95, 1.07, 1.02, 0.95],
  transition: { duration: 6.2, times: [0, 0.45, 0.7, 1], repeat: Infinity, ease: 'easeInOut' },
}
const SHADOW: TargetAndTransition = {
  scaleX: [1, 0.86, 1],
  opacity: [0.35, 0.22, 0.35],
  transition: { duration: 8.4, repeat: Infinity, ease: 'easeInOut' },
}
const FLOAT: TargetAndTransition = {
  x: [0, -1.7, 0.7, 1.8, 0],
  y: [0, -3.1, -4.8, -1.7, 0],
  rotate: [-1, 0.8, 1.5, -0.3, -1],
  transition: { duration: 8.4, times: [0, 0.3, 0.55, 0.8, 1], repeat: Infinity, ease: 'easeInOut' },
}
const BREATHE: TargetAndTransition = {
  scaleX: [1, 1.018, 1],
  scaleY: [1, 0.978, 1],
  transition: { duration: 4.1, repeat: Infinity, ease: 'easeInOut' },
}
const TWINKLE: TargetAndTransition = {
  scale: [1, 0.78, 1],
  opacity: [1, 0.7, 1],
  transition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
}
const SPIN: TargetAndTransition = {
  rotate: [0, 180, 360],
  scale: [1, 1.35, 1],
  transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' },
}
const TALK: TargetAndTransition = {
  scaleX: [1, 0.92, 1.02, 0.96, 1, 0.9, 1.04, 0.95, 1],
  scaleY: [1, 0.45, 0.95, 0.3, 0.8, 0.5, 1.05, 0.4, 1],
  transition: { duration: 0.9, times: [0, 0.12, 0.22, 0.35, 0.48, 0.58, 0.72, 0.86, 1], repeat: Infinity, ease: 'linear' },
}

/** Animação contínua, ou nada quando a pessoa pediu movimento reduzido. */
function play(reduced: boolean, target: TargetAndTransition): { animate?: TargetAndTransition } {
  return reduced ? {} : { animate: target }
}

export function Mascot({ size = 56, mood = 'idle', gesture = null, mini = false, className }: MascotProps) {
  const reduced = useReducedMotion() === true
  const id = useId().replace(/:/g, '')
  const gestureControls = useAnimationControls()

  const gestureKind = gesture?.kind
  const gestureKey = gesture?.key
  useEffect(() => {
    if (reduced || !gestureKind) return
    void gestureControls.start(GESTURES[gestureKind])
  }, [gestureKind, gestureKey, reduced, gestureControls])

  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      {mini ? null : (
        <motion.span
          className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,var(--color-brand-hi)_0%,transparent_66%)]"
          initial={{ opacity: 0.55, scale: 0.95 }}
          {...play(reduced, HALO)}
        />
      )}

      <svg viewBox="0 0 120 120" width={size} height={size} className="relative overflow-visible">
        <defs>
          <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b3a8ff" />
            <stop offset="0.55" stopColor="#8878ff" />
            <stop offset="1" stopColor="#5f4ef0" />
          </linearGradient>
          <radialGradient id={`${id}-shine`} cx="0.34" cy="0.26" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {mini ? null : (
          <motion.ellipse
            cx="60"
            cy="112"
            rx="26"
            ry="4.5"
            fill="#000"
            opacity={0.35}
            style={ORIGIN_CENTER}
            {...play(reduced, SHADOW)}
          />
        )}

        <motion.g style={ORIGIN_BOTTOM} {...play(reduced, FLOAT)}>
          <motion.g style={ORIGIN_BOTTOM} animate={gestureControls}>
            <motion.g style={ORIGIN_BOTTOM} {...play(reduced, BREATHE)}>
              {mini ? null : <Spark reduced={reduced} celebrate={mood === 'celebrate'} />}
              <path
                d="M60 24 C88 24 103 45 103 70 C103 95 85 107 60 107 C35 107 17 95 17 70 C17 45 32 24 60 24 Z"
                fill={`url(#${id}-body)`}
              />
              <ellipse cx="46" cy="44" rx="20" ry="13" fill={`url(#${id}-shine)`} />
              <Cheeks mood={mood} />
              <Brows mood={mood} />
              <Eyes mood={mood} reduced={reduced} />
              <Mouth mood={mood} reduced={reduced} />
              {mood === 'thinking' ? <ThinkingDots reduced={reduced} /> : null}
            </motion.g>
          </motion.g>
        </motion.g>
      </svg>
    </span>
  )
}

/** A faísca na antena. Cintila sempre; na comemoração, gira e cresce. */
function Spark({ reduced, celebrate }: { readonly reduced: boolean; readonly celebrate: boolean }) {
  return (
    <g>
      <path d="M60 25 Q58 18 61 12" fill="none" stroke="#8878ff" strokeWidth="2.4" strokeLinecap="round" />
      <motion.path
        d="M61 1 L63.4 7.6 L70 10 L63.4 12.4 L61 19 L58.6 12.4 L52 10 L58.6 7.6 Z"
        fill="#e6e1ff"
        style={{ ...ORIGIN_CENTER, filter: 'drop-shadow(0 0 4px #b3a8ff)' }}
        {...play(reduced, celebrate ? SPIN : TWINKLE)}
      />
    </g>
  )
}

function Cheeks({ mood }: { readonly mood: MascotMood }) {
  const strong = mood === 'happy' || mood === 'celebrate' || mood === 'gentle'
  return (
    <g fill="#f3a6ff" opacity={strong ? 0.45 : 0.25}>
      <ellipse cx="35" cy="78" rx="6.5" ry="4" />
      <ellipse cx="85" cy="78" rx="6.5" ry="4" />
    </g>
  )
}

/** Sobrancelhas só onde mudam a leitura do rosto: foco, malícia e pensamento. */
function Brows({ mood }: { readonly mood: MascotMood }) {
  const common = { fill: 'none', stroke: INK, strokeWidth: 2.4, strokeLinecap: 'round' } as const
  switch (mood) {
    case 'focused':
      return (
        <g {...common}>
          <path d="M39 51 L53 53" />
          <path d="M81 51 L67 53" />
        </g>
      )
    case 'cheeky':
      return (
        <g {...common}>
          <path d="M39 50 Q46 46 53 49" />
          <path d="M67 54 L81 53" />
        </g>
      )
    case 'thinking':
      return (
        <g {...common}>
          <path d="M40 50 Q46 47 52 49" />
          <path d="M68 48 Q74 45 80 48" />
        </g>
      )
    default:
      return null
  }
}

function Eyes({ mood, reduced }: { readonly mood: MascotMood; readonly reduced: boolean }) {
  // Olhos fechados de alegria na comemoração: dois arcos, sem pupila.
  if (mood === 'celebrate') {
    return (
      <g fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round">
        <path d="M40 66 Q47 59 54 66" />
        <path d="M66 66 Q73 59 80 66" />
      </g>
    )
  }
  const look = mood === 'thinking' ? { x: 2, y: -3 } : mood === 'cheeky' ? { x: 2, y: 0 } : { x: 0, y: 1 }
  // Malícia é olho meio fechado: a pálpebra já começa baixa e pisca dali.
  const lid = mood === 'cheeky' ? 0.8 : 1
  const blink: TargetAndTransition = {
    scaleY: [lid, lid, 0.08, lid, lid],
    transition: { duration: 5.2, times: [0, 0.935, 0.955, 0.97, 1], repeat: Infinity, ease: 'easeInOut' },
  }
  return (
    <motion.g style={ORIGIN_CENTER} initial={{ scaleY: lid }} {...play(reduced, blink)}>
      {[47, 73].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="65" rx="7.5" ry="9" fill="#ffffff" />
          <ellipse cx={cx + look.x} cy={66 + look.y} rx="4.3" ry="5.2" fill={INK} />
          <circle cx={cx + look.x + 1.6} cy={63.4 + look.y} r="1.6" fill="#ffffff" />
        </g>
      ))}
    </motion.g>
  )
}

function Mouth({ mood, reduced }: { readonly mood: MascotMood; readonly reduced: boolean }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' } as const
  switch (mood) {
    case 'talking':
      return <motion.ellipse cx="60" cy="83" rx="5" ry="4" fill={INK} style={ORIGIN_CENTER} {...play(reduced, TALK)} />
    case 'celebrate':
      return (
        <g>
          <path d="M50 79 Q60 93 70 79 Z" fill={INK} />
          <path d="M55 86 Q60 90 65 86 Q60 83 55 86 Z" fill="#f3a6ff" />
        </g>
      )
    case 'thinking':
      return <path d="M55 84 Q60 82 65 84" {...line} />
    case 'focused':
      return <path d="M54 83 L66 83" {...line} />
    case 'cheeky':
      return <path d="M52 83 Q60 86 68 79" {...line} />
    case 'happy':
    case 'gentle':
      return <path d="M51 80 Q60 89 69 80" {...line} />
    case 'idle':
      return <path d="M53 81 Q60 86 67 81" {...line} />
  }
}

/** As reticências de quem está pensando, acendendo uma de cada vez. */
function ThinkingDots({ reduced }: { readonly reduced: boolean }) {
  return (
    <g fill="#e6e1ff">
      {[0, 1, 2].map((index) => (
        <motion.circle
          key={index}
          cx={92 + index * 8}
          cy={30 - index * 5}
          r={2.2 + index * 0.9}
          {...play(reduced, {
            opacity: [0.25, 1, 0.25],
            transition: { duration: 1.2, delay: index * 0.2, repeat: Infinity },
          })}
        />
      ))}
    </g>
  )
}
