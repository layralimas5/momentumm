import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { DayKey } from '@/domain/entities/day'
import {
  QUOTE_CATEGORIES,
  QUOTE_CATEGORY_LABELS,
  quoteOfDay,
  type QuoteCategory,
} from '@/domain/entities/quote'
import { SHARE_TEMPLATE_SPECS, SHARE_TEMPLATES, type ShareTemplateId } from '@/domain/share/share-card'
import { track } from '@/infrastructure/analytics/track'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Panel } from '@/presentation/components/ui/Surface'
import {
  downloadImage,
  shareImage,
  supportsFileShare,
} from '@/presentation/share/render/export-image'
import { renderQuoteCard } from '@/presentation/share/render/render-quote-card'
import { cn } from '@/shared/lib/cn'

const CATEGORY_KEY = 'momentumm.quote.category.v1'

/**
 * A frase do dia.
 *
 * Um card de texto grande, sem explicação em volta: a frase é o conteúdo. A
 * categoria é escolha da pessoa e fica salva; "outra" avança na lista do dia
 * sem sair do dia; compartilhar gera o Story com as cores do Share Studio.
 */
export function QuoteCard({ today, className }: { readonly today: DayKey; readonly className?: string }) {
  const [category, setCategory] = useState<QuoteCategory>(loadCategory)
  const [offset, setOffset] = useState(0)
  const [sharing, setSharing] = useState(false)
  const reduceMotion = useReducedMotion()

  const quote = useMemo(() => quoteOfDay(today, category, offset), [today, category, offset])

  const pick = (next: QuoteCategory) => {
    setCategory(next)
    setOffset(0)
    persistCategory(next)
  }

  return (
    <Panel tone="brand" className={cn('overflow-hidden', className)} aria-labelledby="frase-do-dia">
      <div className="flex items-center justify-between gap-3">
        <h2 id="frase-do-dia" className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
          Frase do dia
        </h2>
        <div className="flex gap-1" role="group" aria-label="Categoria da frase">
          {QUOTE_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === category}
              onClick={() => pick(item)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                item === category
                  ? 'bg-brand text-white'
                  : 'text-ink-faint hover:bg-surface-hi hover:text-ink',
              )}
            >
              {QUOTE_CATEGORY_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.blockquote
          key={quote.id}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 text-xl font-semibold tracking-tight text-balance text-ink sm:text-2xl"
        >
          {quote.text}
        </motion.blockquote>
      </AnimatePresence>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setSharing(true)}>
          <Icon name="globo" className="size-4" />
          Compartilhar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOffset((current) => current + 1)}>
          <Icon name="desfazer" className="size-4" />
          Outra
        </Button>
      </div>

      <QuoteShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        quote={quote}
        day={today}
      />
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// compartilhar
// ---------------------------------------------------------------------------

function QuoteShareSheet({
  open,
  onClose,
  quote,
  day,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly quote: ReturnType<typeof quoteOfDay>
  readonly day: DayKey
}) {
  const { profile } = useAuth()
  const [template, setTemplate] = useState<ShareTemplateId>('dark')
  const [status, setStatus] = useState<'idle' | 'generating' | 'saved' | 'shared'>('idle')
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const username = profile ? `@${profile.handle}` : null

  // Preview ao vivo: o mesmo renderizador desenha no canvas visível.
  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = 1080
    canvas.height = 1920
    renderQuoteCard(ctx, quote, template, username)
  }, [open, quote, template, username])

  const generate = useCallback(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1920
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('Este navegador não conseguiu preparar a imagem.')
    renderQuoteCard(ctx, quote, template, username)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Não consegui gerar a imagem agora. Tenta de novo.')
    return blob
  }, [quote, template, username])

  const fileName = `momentumm-frase-${quote.id}-${day}.png`

  const handleShare = async () => {
    setStatus('generating')
    setError(null)
    try {
      const blob = await generate()
      if (!supportsFileShare()) {
        downloadImage(blob, fileName)
        setStatus('saved')
      } else {
        const outcome = await shareImage(blob, fileName, 'Frase do dia')
        setStatus(outcome === 'shared' ? 'shared' : 'idle')
      }
      track('share_exported', 'compartilhamento', { template, mode: 'quote' })
    } catch (cause) {
      setStatus('idle')
      setError(cause instanceof Error ? cause.message : 'Não deu pra compartilhar agora.')
    }
  }

  const handleSave = async () => {
    setStatus('generating')
    setError(null)
    try {
      downloadImage(await generate(), fileName)
      setStatus('saved')
    } catch (cause) {
      setStatus('idle')
      setError(cause instanceof Error ? cause.message : 'Não deu pra salvar agora.')
    }
  }

  return (
    <BottomSheet open={open} title="Compartilhar frase" onClose={onClose}>
      <div className="flex flex-col gap-4 pb-2">
        <div className="mx-auto w-full max-w-[170px] overflow-hidden rounded-2xl border border-line bg-surface-top">
          <canvas ref={canvasRef} className="block aspect-[9/16] w-full" aria-label="Prévia do card" />
        </div>

        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Cor do card">
          {SHARE_TEMPLATES.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === template}
              onClick={() => setTemplate(id)}
              className={cn(
                'min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors',
                id === template
                  ? 'border-brand bg-brand-dim/60 text-ink'
                  : 'border-line text-ink-muted hover:border-line-hi hover:text-ink',
              )}
            >
              {SHARE_TEMPLATE_SPECS[id].label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void handleShare()} loading={status === 'generating'}>
            <Icon name="globo" className="size-4" />
            Compartilhar
          </Button>
          <Button variant="secondary" onClick={() => void handleSave()} disabled={status === 'generating'}>
            Salvar PNG
          </Button>
        </div>

        <p aria-live="polite" className="min-h-5 text-center text-xs text-ink-faint">
          {error ?? (status === 'saved' ? 'Imagem salva.' : status === 'shared' ? 'Compartilhado.' : '')}
        </p>
      </div>
    </BottomSheet>
  )
}

function loadCategory(): QuoteCategory {
  try {
    const raw = window.localStorage.getItem(CATEGORY_KEY)
    return QUOTE_CATEGORIES.find((item) => item === raw) ?? 'disciplina'
  } catch {
    return 'disciplina'
  }
}

function persistCategory(category: QuoteCategory): void {
  try {
    window.localStorage.setItem(CATEGORY_KEY, category)
  } catch {
    // Sem armazenamento a escolha vale só nesta sessão.
  }
}
