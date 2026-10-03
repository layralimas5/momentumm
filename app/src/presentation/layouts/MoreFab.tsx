import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { useFeature } from '@/presentation/plan/use-feature'
import { AddSheet } from './AddSheet'
import { APP_NAV, visibleNav } from './nav-items'
import { PROFILE_PATH, SHELL_TABS } from './shell-nav'

/** Onde o botão aparece: as três telas de execução. */
const FAB_ROUTES: readonly string[] = ['/app', '/app/rotina', '/app/objetivos']

/** O que já mora no Perfil (conta, plano, suporte) não se repete aqui. */
const IN_PROFILE: readonly string[] = ['/app/configuracoes', '/app/assinatura', '/app/suporte']

const IN_SHELL: readonly string[] = [...SHELL_TABS.map((tab) => tab.to), PROFILE_PATH, ...IN_PROFILE]

/**
 * O botão flutuante das telas de execução: as outras telas do Momentumm
 * (hábitos, plano, foco, review, jornada, IA...) que não cabem na barra de
 * baixo, numa grade só, com o "Adicionar" no topo.
 */
export function MoreFab() {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  const juntos = useFeature('juntos')
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  if (!FAB_ROUTES.includes(pathname)) return null

  const screens = visibleNav(
    APP_NAV.filter((item) => !IN_SHELL.includes(item.to)),
    { juntos: juntos.enabled },
  )

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        {...(reduce ? {} : { whileTap: { scale: 0.92 } })}
        className="fixed right-4 bottom-above-tabbar z-40 grid size-14 place-items-center rounded-full bg-gradient-to-b from-brand to-brand-hi text-white shadow-[var(--shadow-cta)] sm:right-[max(1rem,calc(50%-21rem))] sm:bottom-24"
      >
        <Icon name="grade" className="size-6" strokeWidth={2} />
        <span className="sr-only">Mais telas do Momentumm</span>
      </motion.button>

      <BottomSheet open={open} title="Mais do Momentumm" onClose={() => setOpen(false)}>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setAdding(true)
          }}
          className="press mb-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-dim text-sm font-semibold text-brand-ink"
        >
          <Icon name="mais" className="size-4" strokeWidth={2.5} />
          Adicionar tarefa, hábito, rotina ou objetivo
        </button>

        <ul className="grid grid-cols-3 gap-2.5">
          {screens.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={() => setOpen(false)}
                className="card press flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl px-2 py-3 text-center"
              >
                <span className="well grid size-10 place-items-center rounded-full text-brand-hi">
                  <Icon name={item.icon} className="size-5" />
                </span>
                <span className="text-xs leading-tight font-medium text-ink">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <AddSheet open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
