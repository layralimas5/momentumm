import type { HabitIcon } from '@/domain/entities/habit'
import { cn } from '@/shared/lib/cn'

/**
 * Ícones desenhados inline. Nada de biblioteca: são poucos, são de traço e
 * entram no bundle como texto, sem uma dependência inteira junto.
 */

export const ICON_PATHS = {
  hoje: 'M4 13h5v7H4zM10 8h5v12h-5zM16 4h4v16h-4z',
  jornada: 'M4 18h4l3-7 3 12 3-9h3',
  habitos: 'm4 12 4 4 12-12M4 20h16',
  metas: 'M12 21a9 9 0 1 0-9-9M12 3v9l6 3',
  foco: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  insights: 'M9 21h6M10 17h4a5 5 0 1 0-4 0ZM12 3v1',
  config:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.5 12a7.5 7.5 0 0 1 .3-2l-2-1.5 2-3.5 2.3 1a7.5 7.5 0 0 1 1.7-1L9.2 2h5.6l.4 2.5a7.5 7.5 0 0 1 1.7 1l2.3-1 2 3.5-2 1.5a7.5 7.5 0 0 1 0 4l2 1.5-2 3.5-2.3-1a7.5 7.5 0 0 1-1.7 1l-.4 2.5H9.2l-.4-2.5a7.5 7.5 0 0 1-1.7-1l-2.3 1-2-3.5 2-1.5a7.5 7.5 0 0 1-.3-2Z',
  mais: 'M12 5v14M5 12h14',
  busca: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  sino: 'M18 16V11a6 6 0 1 0-12 0v5l-2 3h16l-2-3ZM10 21a2 2 0 0 0 4 0',
  play: 'm8 5 11 7-11 7V5Z',
  pausa: 'M9 5v14M15 5v14',
  check: 'm5 13 4 4L19 7',
  seta: 'm9 6 6 6-6 6',
  setaEsq: 'm15 6-6 6 6 6',
  fechar: 'M6 6l12 12M18 6 6 18',
  recolher: 'M15 5v14M9 9l-3 3 3 3',
  expandir: 'M9 5v14M15 9l3 3-3 3',
  relogio: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  calendario:
    'M4 8h16M7 4v3M17 4v3M5 20h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Z',
  raio: 'M13 3 5 14h6l-1 7 8-11h-6l1-7Z',
  desfazer: 'M4 9h11a5 5 0 0 1 0 10h-6M4 9l4-4M4 9l4 4',
  adiar: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 8v4l3 2M3 5l3-2',
  minimo: 'M6 12h12M9 8h6M9 16h6',
  trofeu: 'M8 4h8v5a4 4 0 1 1-8 0V4ZM5 5h3M16 5h3M10 18h4M9 21h6',
  fogo: 'M12 3c.6 3-1.3 4.4-2.6 5.8C8.1 10.1 7.2 11.3 7.2 13a4.8 4.8 0 0 0 9.6 0c0-1.5-.6-2.7-1.4-3.7-.3 1-.9 1.6-1.7 1.8.5-2.5-.4-5.8-1.7-8.1Z',
  editar: 'm4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z',
  saida: 'M15 12H4m0 0 3-3m-3 3 3 3M12 4h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-6',
  objetivo:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  plano: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  progresso: 'M4 19V5m0 14h16M8 15l3.5-4.5 3 3L20 7',
  ia: 'm12 3 1.9 4.6 4.6 1.9-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3ZM18 16l.9 2.1 2.1.9-2.1.9L18 22l-.9-2.1-2.1-.9 2.1-.9L18 16Z',
  arquivar: 'M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8ZM3 4h18v4H3zM10 12h4',
  arrastar: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  subir: 'M12 19V5M6 11l6-6 6 6',
  descer: 'M12 5v14M6 13l6 6 6-6',
  cadeado:
    'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z',
  lixeira: 'M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3',
  // "Isso está aparecendo". Não confundir com `cadeado`, que diz o contrário.
  visivel: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  // O mesmo olho com a barra: "isso esta escondido".
  oculto:
    'M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M7 6.9C4.2 8.6 2 12 2 12s3.6 7 10 7c1.9 0 3.6-.6 5-1.4M10 5.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a18.6 18.6 0 0 1-2.7 3.6',
  // Areas de objetivo, usadas na faixa do hero da landing.
  formatura: 'm2 10 10-5 10 5-10 5-10-5ZM6 12.2V16c0 1.5 3 3 6 3s6-1.5 6-3v-3.8M22 10v5',
  livro:
    'M12 6.5c-1.5-1.5-3.5-2-6-2v13c2.5 0 4.5.5 6 2 1.5-1.5 3.5-2 6-2v-13c-2.5 0-4.5.5-6 2Zm0 0v13',
  halter: 'M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12',
  lotus:
    'M12 4c2.5 2.5 3.8 5.2 3.8 8.2A3.8 3.8 0 0 1 12 16a3.8 3.8 0 0 1-3.8-3.8C8.2 9.2 9.5 6.5 12 4ZM4 12.5c2.6.2 4.8 1.8 5.8 4.5-2.7.3-4.9-1.3-5.8-4.5ZM20 12.5c-2.6.2-4.8 1.8-5.8 4.5 2.7.3 4.9-1.3 5.8-4.5ZM12 16v4',
  globo:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  lua: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
} as const

export type IconName = keyof typeof ICON_PATHS

interface IconProps {
  readonly name: IconName
  readonly className?: string
  readonly strokeWidth?: number
}

export function Icon({ name, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0', className)}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

const HABIT_ICON_PATHS: Readonly<Record<HabitIcon, string>> = {
  livro:
    'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z',
  cerebro:
    'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8V15a3 3 0 0 0 3 3h1V4ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8V15a3 3 0 0 1-3 3h-1V4Z',
  halter: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
  lotus:
    'M12 20c-4 0-7-2.5-8-6 3-1 5.5 0 8 3 2.5-3 5-4 8-3-1 3.5-4 6-8 6ZM12 17c-2-2.5-2-6 0-9 2 3 2 6.5 0 9Z',
  agua: 'M12 3s6 6.5 6 10.5A6 6 0 1 1 6 13.5C6 9.5 12 3 12 3Z',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  lua: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  caneta: 'm4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z',
}

export function HabitGlyph({ icon, className }: { icon: HabitIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0', className)}
    >
      <path d={HABIT_ICON_PATHS[icon]} />
    </svg>
  )
}
