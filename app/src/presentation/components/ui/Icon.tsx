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
  // O botao Compartilhar do iOS: quadrado com a seta saindo por cima.
  compartilhar:
    'M12 3v12M8.5 6.5 12 3l3.5 3.5M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2',
  celular: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM10 18h4',
  // "Adicionar a Tela de Inicio": o mais dentro do quadrado.
  maisQuadrado: 'M12 8v8M8 12h8M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
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
  // As redes do perfil. Desenhos de traço, como o resto: a marca de cada uma
  // reconhecida pela forma, sem colar o logotipo oficial de ninguém dentro do
  // bundle.
  instagram:
    'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4ZM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17.2 6.9h.01',
  tiktok:
    'M14 4v10.2a3.3 3.3 0 1 1-2.6-3.2M14 4c.4 2.3 1.9 3.7 4.2 3.9M14 4h.01',
  linkedin:
    'M4.5 3.5h15a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1ZM8 10.5V16M8 7.8h.01M12 16v-3.2a1.8 1.8 0 0 1 3.6 0V16M12 10.5V16',
  // A barra de baixo fala por desenho: casa e pessoa dizem "inicio" e "meu
  // perfil" sem depender do rotulo embaixo.
  casa: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z',
  pessoa: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  // Aspas de abertura: marca a frase do dia sem precisar do rotulo em cima dela.
  aspas:
    'M6 16c-1.7 0-3-1.4-3-3.2 0-3.2 2.3-6 5.4-6.8M15 16c-1.7 0-3-1.4-3-3.2 0-3.2 2.3-6 5.4-6.8M3 12.8V16h5.4M12 12.8V16h5.4',
  /*
    Os gestos do Feed.

    Coração e marcador são traçados como caminho FECHADO, com o `Z` no fim: são
    os dois únicos ícones do app que também aparecem preenchidos (curtido,
    salvo), e um caminho aberto pintado por dentro vaza tinta pela abertura.
  */
  coracao:
    'M12 20.3 4.3 12.9a4.7 4.7 0 0 1 0-6.8 4.9 4.9 0 0 1 6.8 0l.9.9.9-.9a4.9 4.9 0 0 1 6.8 0 4.7 4.7 0 0 1 0 6.8Z',
  comentario:
    'M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.5-5.4A8.5 8.5 0 1 1 21 11.5Z',
  salvar: 'M6 3.8h12a1 1 0 0 1 1 1v15.4l-7-4.2-7 4.2V4.8a1 1 0 0 1 1-1Z',
  // As reticências do menu de cada publicação.
  maisOpcoes: 'M6 12h.01M12 12h.01M18 12h.01',
  // Foto: o retângulo com o sol e a montanha.
  imagem:
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM3.5 16.5 9 12l5 4 2.5-2 4 3.5',
  // Denunciar: a bandeirinha fincada.
  bandeira: 'M5 21V4M5 4h10l-1.5 3.5L15 11H5',
  // Bloquear: o círculo cortado.
  bloquear: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8',
  // A dupla de pessoas: seguidores e seguindo.
  pessoas:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 19.5a6.5 6.5 0 0 1 13 0M16 11.2A3.5 3.5 0 0 0 16 4.3M18 19.5a6.5 6.5 0 0 0-2.2-4.9',
  // A grade de publicações do perfil.
  grade: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  // 3S: navegação e telas novas.
  abaixo: 'm6 9 6 6 6-6',
  acima: 'm6 15 6-6 6 6',
  bussola: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15.5 8.5l-2 5-5 2 2-5 5-2Z',
  tendencia: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  calendarioGrade:
    'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM4 10h16M8 3v4M16 3v4',
  bateria: 'M9 4h6M8 6h8a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM10 16h4',
  escudo: 'M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6l-7-3ZM9 12l2 2 4-4',
  filtros: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  camera:
    'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  estrela: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z',
  lampada:
    'M9 21h6M10 18h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z',
  retomar: 'M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4',
  local: 'M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  pulso: 'M3 12h4l2-5 4 10 2-5h6',
  medidor: 'M4 16a8 8 0 1 1 16 0M12 16l4-5',
  cubo: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM12 12l8-4.5M12 12v9M12 12 4 7.5',
  convidar:
    'M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 8v6M16 11h6',
  cronometro: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2 2M10 2h4',
  verificado:
    'm12 3 2.2 1.6 2.7-.1.8 2.6 2.2 1.6-.9 2.6.9 2.6-2.2 1.6-.8 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.8-2.6-2.2-1.6.9-2.6-.9-2.6 2.2-1.6.8-2.6 2.7.1L12 3ZM9 12l2 2 4-4',
} as const

export type IconName = keyof typeof ICON_PATHS

interface IconProps {
  readonly name: IconName
  readonly className?: string
  readonly strokeWidth?: number
  /**
   * Pinta o miolo com a cor do traço. Só faz sentido nos caminhos fechados
   * (`coracao`, `salvar`): é o estado ligado de curtir e de salvar, e é o
   * preenchimento, não a cor, que diz "já fiz isso" a um metro de distância.
   */
  readonly filled?: boolean
}

export function Icon({ name, className, strokeWidth = 1.75, filled = false }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
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

/** O domínio guarda ícone como texto; isto diz se ele existe aqui. */
export function isIconName(name: string): name is IconName {
  return Object.prototype.hasOwnProperty.call(ICON_PATHS, name)
}
