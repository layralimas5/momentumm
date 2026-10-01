import { motion, useReducedMotion } from 'framer-motion'

/**
 * O fundo do hero, o mesmo da tela de entrada `/inicio` (a referência foi o
 * Comandis): uma grade fina que some nas bordas e um brilho da marca que anda
 * devagar. Aqui ele é mais alto que o hero e se dissolve por trás da seção
 * seguinte, em vez de ser cortado na borda.
 *
 * Tudo em CSS e tokens, sem imagem pra baixar. Gradiente radial e não `blur`:
 * um filtro de 120px num elemento que se move é caro no celular e, no Chrome,
 * chegou a sumir com elementos da tela na hora de compor. Com movimento
 * reduzido, o brilho fica parado.
 *
 * Fica atrás de tudo (`-z-10`, com o `isolate` da página); o corte lateral é do
 * contêiner da página, pra não criar rolagem horizontal.
 */
const GRID_MASK = 'radial-gradient(ellipse 70% 60% at 50% 35%, black 25%, transparent 75%)'

export function HeroBackdrop() {
  const reduced = useReducedMotion()

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[140%]">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: GRID_MASK,
          WebkitMaskImage: GRID_MASK,
        }}
      />
      <motion.div
        className="absolute left-1/2 top-[30%] size-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full sm:size-[56rem]"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--color-brand) 28%, transparent) 0%, transparent 65%)',
        }}
        animate={reduced ? {} : { x: [0, 60, -40, 0], y: [0, -30, 40, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* A base: o brilho desce e se apaga devagar, sem linha de corte. */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-canvas" />
    </div>
  )
}
