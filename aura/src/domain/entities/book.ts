/**
 * Livro / Leitura — parte da jornada de transformação. A usuária acompanha
 * o que quer ler, o que está lendo e o que já concluiu.
 * Camada de domínio: pura, sem dependências externas.
 */

export type ReadingStatus = 'to_read' | 'reading' | 'read'

export interface Book {
  readonly id: string
  readonly userId: string
  title: string
  author: string | null
  status: ReadingStatus
  /** Progresso de leitura de 0 a 100. */
  progress: number
  /** Anotação/reflexão pessoal sobre a leitura. */
  notes: string | null
  readonly createdAt: string
}

export interface NewBook {
  title: string
  author?: string | null
  status?: ReadingStatus
}

export const READING_STATUS_LABEL: Record<ReadingStatus, string> = {
  to_read: 'Quero ler',
  reading: 'Lendo',
  read: 'Lido',
}

export const BookRules = {
  minTitleLength: 1,
  maxTitleLength: 200,

  isValidTitle(title: string): boolean {
    const t = title.trim()
    return t.length >= this.minTitleLength && t.length <= this.maxTitleLength
  },

  /** Deriva o progresso implícito pelo status quando não informado. */
  progressForStatus(status: ReadingStatus): number {
    switch (status) {
      case 'to_read':
        return 0
      case 'reading':
        return 50
      case 'read':
        return 100
    }
  },
} as const
