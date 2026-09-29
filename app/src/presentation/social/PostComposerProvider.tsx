import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DayKey } from '@/domain/entities/day'
import { PostComposer } from './PostComposer'
import { StoryComposer } from './StoryComposer'
import { Toast, type ToastMessage } from './Toast'

interface PostComposerControls {
  /** Abre o criador de publicação. O dia entra preenchido quando vem do calendário. */
  open(day?: DayKey): void
  openStory(): void
  close(): void
  /**
   * Sobe a cada publicação, story ou exclusão.
   *
   * É o sinal de "relê" pra quem lista: feed, grade do perfil e calendário
   * dependem dele. Sem isso, publicar mostraria o aviso de sucesso e o feed
   * continuaria exatamente igual, que é a interação que ensina a pessoa a
   * recarregar a página na mão.
   *
   * Um número, e não um evento com payload: as três telas precisam RELER, não
   * inserir a publicação nova na posição certa de uma lista que elas paginam.
   */
  readonly revision: number
  /** Um aviso curto e que some sozinho. Sucesso não merece diálogo. */
  notify(message: string): void
  /** O mesmo lugar, pro que deu errado fora de um formulário (curtir, apagar). */
  warn(message: string): void
}

const PostComposerContext = createContext<PostComposerControls | null>(null)

/**
 * O criador de publicação e de story, acima das páginas.
 *
 * Ele fica aqui, e não dentro do Feed, porque três lugares o abrem: o "+" da
 * barra inferior, a bandeja de stories e o calendário do perfil (num dia
 * específico). Um criador por tela seria o começo de três publicações com
 * regras diferentes, e é exatamente o que o `ShareStudioProvider` já tinha
 * evitado pro card de imagem.
 */
export function PostComposerProvider({ children }: { children: ReactNode }) {
  const [postDay, setPostDay] = useState<DayKey | null>(null)
  const [postOpen, setPostOpen] = useState(false)
  const [storyOpen, setStoryOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const notify = useCallback((text: string) => setToast({ text, tone: 'ok' }), [])
  const warn = useCallback((text: string) => setToast({ text, tone: 'erro' }), [])

  const controls = useMemo<PostComposerControls>(
    () => ({
      open: (day?: DayKey) => {
        setPostDay(day ?? null)
        setPostOpen(true)
      },
      openStory: () => setStoryOpen(true),
      close: () => {
        setPostOpen(false)
        setStoryOpen(false)
      },
      revision,
      notify,
      warn,
    }),
    [revision, notify, warn],
  )

  const bump = useCallback(() => setRevision((value) => value + 1), [])

  return (
    <PostComposerContext.Provider value={controls}>
      {children}

      <PostComposer
        open={postOpen}
        day={postDay}
        onClose={() => setPostOpen(false)}
        onPublished={() => {
          setPostOpen(false)
          bump()
          notify('Publicado. Já está no teu calendário.')
        }}
      />

      <StoryComposer
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        onPublished={() => {
          setStoryOpen(false)
          bump()
          notify('Teu story está no ar por 24 horas.')
        }}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </PostComposerContext.Provider>
  )
}

export function usePostComposer(): PostComposerControls {
  const controls = useContext(PostComposerContext)
  if (!controls) {
    throw new Error('usePostComposer precisa estar dentro de PostComposerProvider.')
  }
  return controls
}

/**
 * O sinal de "alguma coisa da camada social mudou".
 *
 * Existe separado de `usePostComposer` porque quase toda tela que lista
 * publicação quer só este número, e depender do objeto inteiro faria cada uma
 * delas re-renderizar quando o criador abre ou fecha.
 */
export function useSocialRevision(): number {
  return usePostComposer().revision
}

/** O aviso curto, pra quem age fora do criador (apagou, bloqueou, denunciou). */
export function useSocialNotify(): {
  readonly notify: (message: string) => void
  readonly warn: (message: string) => void
} {
  const controls = usePostComposer()
  return { notify: controls.notify, warn: controls.warn }
}
