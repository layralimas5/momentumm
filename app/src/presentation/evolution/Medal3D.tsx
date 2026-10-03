import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

export type MedalMetal = 'ouro' | 'prata'

const METALS: Readonly<Record<MedalMetal, { face: string; rim: string; edge: string; ink: string }>> = {
  ouro: {
    face: 'conic-gradient(from 210deg, #fff3c4, #e8b44a 18%, #a8762a 32%, #f7d489 48%, #c68f33 64%, #fff0b8 80%, #e8b44a)',
    rim: 'conic-gradient(from 30deg, #8a6220, #f7d489, #a8762a, #fff3c4, #8a6220)',
    edge: '#8a6220',
    ink: '#5c3d0c',
  },
  prata: {
    face: 'conic-gradient(from 210deg, #ffffff, #c9c6dd 18%, #8f8ab0 32%, #f1effa 48%, #a7a2c6 64%, #ffffff 80%, #c9c6dd)',
    rim: 'conic-gradient(from 30deg, #5b5480, #e9e6f7, #7c76a3, #ffffff, #5b5480)',
    edge: '#5b5480',
    ink: '#2f2a52',
  },
}

/** Camadas da borda: a espessura da moeda é feita de discos empilhados em Z. */
const EDGE_LAYERS = 14
const THICKNESS = 14
const AUTO_SPEED = 18 // graus por segundo quando ninguém está mexendo

/**
 * A medalha da conquista em 3D: dá pra girar com o dedo, o mouse ou as setas
 * do teclado. Parada, ela gira devagar sozinha; o brilho corre pela face
 * conforme o ângulo, que é o que faz o metal parecer metal.
 */
export function Medal3D({
  icon,
  metal,
  title,
  caption,
  locked = false,
  size = 168,
  className,
}: {
  readonly icon: IconName
  readonly metal: MedalMetal
  readonly title: string
  readonly caption: string
  readonly locked?: boolean
  readonly size?: number
  readonly className?: string
}) {
  const reduce = useReducedMotion()
  const rotateY = useMotionValue(-18)
  const rotateX = useMotionValue(8)
  const dragging = useRef<{ x: number; y: number; ry: number; rx: number } | null>(null)
  const idleSince = useRef(0)

  /* O reflexo acompanha o giro: a faixa clara atravessa a face a cada volta. */
  const shineX = useTransform(rotateY, (value) => `${((((value % 360) + 360) % 360) / 360) * 300 - 100}%`)
  const shine = useMotionTemplate`linear-gradient(105deg, transparent 30%, rgb(255 255 255 / 0.75) 48%, transparent 62%) ${shineX} 0 / 220% 100% no-repeat`

  useEffect(() => {
    if (reduce || locked) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      if (!dragging.current && now - idleSince.current > 1200) {
        rotateY.set(rotateY.get() + AUTO_SPEED * dt)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reduce, locked, rotateY])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = { x: event.clientX, y: event.clientY, ry: rotateY.get(), rx: rotateX.get() }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragging.current
    if (!start) return
    rotateY.set(start.ry + (event.clientX - start.x) * 0.8)
    rotateX.set(Math.max(-30, Math.min(30, start.rx - (event.clientY - start.y) * 0.4)))
  }

  const release = () => {
    dragging.current = null
    idleSince.current = performance.now()
    animate(rotateX, 8, { type: 'spring', stiffness: 120, damping: 14 })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowLeft' ? -30 : event.key === 'ArrowRight' ? 30 : 0
    if (step === 0) return
    event.preventDefault()
    idleSince.current = performance.now()
    animate(rotateY, rotateY.get() + step, { type: 'spring', stiffness: 160, damping: 18 })
  }

  const colors = METALS[metal]
  const faceSize = size
  const inner = size * 0.74

  const face = (back: boolean) => (
    <div
      className="absolute inset-0 grid place-items-center rounded-full"
      style={{
        background: colors.rim,
        transform: `${back ? 'rotateY(180deg) ' : ''}translateZ(${THICKNESS / 2}px)`,
        backfaceVisibility: 'hidden',
        boxShadow: 'inset 0 0 0 2px rgb(255 255 255 / 0.35)',
      }}
    >
      <div
        className="relative grid place-items-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: colors.face,
          boxShadow: 'inset 0 3px 6px rgb(255 255 255 / 0.6), inset 0 -4px 8px rgb(0 0 0 / 0.25)',
          color: colors.ink,
        }}
      >
        {back ? (
          <div className="px-4 text-center">
            <p className="text-[0.55rem] font-bold tracking-[0.2em] uppercase opacity-80">Momentumm</p>
            <p className="mt-1 text-[0.72rem] leading-tight font-bold">{title}</p>
            <p className="mt-1 text-[0.55rem] font-semibold opacity-80">{caption}</p>
          </div>
        ) : (
          <Icon
            name={icon}
            className="size-[42%] drop-shadow-[0_1px_0_rgb(255_255_255/0.6)]"
            strokeWidth={2.1}
          />
        )}
        <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full" style={{ background: shine }} />
      </div>
    </div>
  )

  return (
    <div
      role="img"
      tabIndex={0}
      aria-roledescription="medalha giratória"
      aria-label={`${title}. ${caption}. Arraste ou use as setas pra girar.`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      className={cn('relative grid cursor-grab touch-none place-items-center select-none active:cursor-grabbing', className)}
      style={{ width: faceSize, height: faceSize, perspective: 900 }}
    >
      <div
        aria-hidden="true"
        className="absolute bottom-[-10%] h-[14%] w-[70%] rounded-[50%] bg-black/45 blur-md"
      />
      <motion.div
        className={cn('relative size-full', locked && 'opacity-40 grayscale')}
        style={{ rotateY, rotateX, transformStyle: 'preserve-3d' }}
      >
        {Array.from({ length: EDGE_LAYERS }, (_, index) => {
          const z = -THICKNESS / 2 + (THICKNESS * index) / (EDGE_LAYERS - 1)
          return (
            <div
              key={index}
              className="absolute inset-0 rounded-full"
              style={{
                background: colors.edge,
                transform: `translateZ(${z}px)`,
                filter: `brightness(${0.8 + (index % 3) * 0.12})`,
              }}
            />
          )
        })}
        {face(false)}
        {face(true)}
      </motion.div>
    </div>
  )
}
