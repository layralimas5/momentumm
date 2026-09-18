import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { DayKey } from '@/domain/entities/day'
import {
  QUOTE_CATEGORIES,
  QUOTE_CATEGORY_LABELS,
  QUOTES,
  quoteOfDay,
  quotesOf,
  type Quote,
  type QuoteCategory,
} from '@/domain/entities/quote'
import { SHARE_TEMPLATE_SPECS, SHARE_TEMPLATES, type ShareTemplateId } from '@/domain/share/share-card'
import { track } from '@/infrastructure/analytics/track'
import { useAuth } from '@/presentation/auth/use-auth'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Panel } from '@/presentation/components/ui/Surface'
import { downloadImage, shareImage, supportsFileShare } from '@/presentation/share/render/export-image'
import { loadBrandLogo, renderQuoteCard } from '@/presentation/share/render/render-quote-card'
import { cn } from '@/shared/lib/cn'

const CHOICE_KEY = 'momentumm.quote.choice.v2'

interface StoredChoice {
  readonly category: QuoteCategory
  /** A frase escolhida à mão, ou null pra "a do dia". */
  readonly quoteId: string | null
}

/**
 * A frase do dia, com a estética do card de compartilhar: a frase grande e o
 * logo logo abaixo. Sem título de categoria em cima: a frase fala sozinha.
 *
 * A do dia vem sozinha; quem quiser escolhe outra na lista da categoria e
 * compartilha a que quiser, direto da lista ou do card.
 */
export function QuoteCard({ today, className }: { readonly today: DayKey; readonly className?: string }) {
  const [choice, setChoice] = useState<StoredChoice>(loadChoice)
  const [picking, setPicking] = useState(false)
  const [sharing, setSharing] = useState<Quote | null>(null)
  const reduceMotion = useReducedMotion()

  const quote = useMemo(() => {
    const chosen = choice.quoteId ? QUOTES.find((item) => item.id === choice.quoteId) : null
    return chosen ?? quoteOfDay(today, choice.category)
  }, [choice, today])

  const choose = (next: StoredChoice) => {
    setChoice(next)
    persistChoice(next)
  }

  return (
    <Panel tone="brand" className={cn('overflow-hidden', className)} aria-labelledby="frase-do-dia">
      <h2 id="frase-do-dia" className="sr-only">
        Frase do dia
      </h2>

      <AnimatePresence mode="wait" initial={false}>
        <motion.blockquote
          key={quote.id}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-2xl font-bold tracking-tight text-balance text-ink sm:text-3xl"
        >
          {quote.text}
        </motion.blockquote>
      </AnimatePresence>

      <div className="mt-3 flex justify-center">
        <Wordmark decorative className="w-20 opacity-60 sm:w-24" />
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        <Button size="sm" onClick={() => setSharing(quote)}>
          <Icon name="globo" className="size-4" />
          Compartilhar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>
          <Icon name="busca" className="size-4" />
          Escolher frase
        </Button>
      </div>

      <QuotePickerSheet
        open={picking}
        onClose={() => setPicking(false)}
        category={choice.category}
        current={quote}
        today={today}
        onPick={(picked) => {
          choose({ category: picked.category, quoteId: picked.id })
          setPicking(false)
        }}
        onCategory={(category) => choose({ category, quoteId: null })}
        onShare={(picked) => {
          setPicking(false)
          setSharing(picked)
        }}
      />

      <QuoteShareSheet
        open={sharing !== null}
        onClose={() => setSharing(null)}
        quote={sharing ?? quote}
        day={today}
      />
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// escolher
// ---------------------------------------------------------------------------

function QuotePickerSheet({
  open,
  onClose,
  category,
  current,
  today,
  onPick,
  onCategory,
  onShare,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly category: QuoteCategory
  readonly current: Quote
  readonly today: DayKey
  readonly onPick: (quote: Quote) => void
  readonly onCategory: (category: QuoteCategory) => void
  readonly onShare: (quote: Quote) => void
}) {
  const ofDay = quoteOfDay(today, category)
  const list = quotesOf(category)

  return (
    <BottomSheet open={open} title="Escolher frase" onClose={onClose}>
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Tema">
          {QUOTE_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === category}
              onClick={() => onCategory(item)}
              className={cn(
                'min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
                item === category
                  ? 'border-brand bg-brand-dim/60 text-ink'
                  : 'border-line text-ink-muted hover:border-line-hi hover:text-ink',
              )}
            >
              {QUOTE_CATEGORY_LABELS[item]}
            </button>
          ))}
        </div>

        <ul className="flex max-h-[55vh] flex-col gap-1 overflow-y-auto">
          {list.map((item) => {
            const selected = item.id === current.id
            return (
              <li key={item.id} className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  aria-pressed={selected}
                  className={cn(
                    'min-h-12 flex-1 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                    selected ? 'bg-brand-dim/50 text-ink' : 'text-ink-muted active:bg-surface-hi',
                  )}
                >
                  {item.text}
                  {item.id === ofDay.id ? (
                    <span className="ml-2 text-[10px] font-semibold tracking-wide text-brand-ink uppercase">
                      hoje
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => onShare(item)}
                  className="grid w-11 shrink-0 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink"
                >
                  <Icon name="globo" className="size-4" />
                  <span className="sr-only">Compartilhar esta frase</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </BottomSheet>
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
  readonly quote: Quote
  readonly day: DayKey
}) {
  const { profile } = useAuth()
  const [template, setTemplate] = useState<ShareTemplateId>('dark')
  const [status, setStatus] = useState<'idle' | 'generating' | 'saved' | 'shared'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const username = profile ? `@${profile.handle}` : null

  useEffect(() => {
    if (!open || logo) return
    void loadBrandLogo().then(setLogo)
  }, [open, logo])

  // Preview ao vivo: o mesmo renderizador desenha no canvas visível.
  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = 1080
    canvas.height = 1920
    renderQuoteCard(ctx, quote, template, username, logo)
  }, [open, quote, template, username, logo])

  const generate = useCallback(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1920
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('Este navegador não conseguiu preparar a imagem.')
    renderQuoteCard(ctx, quote, template, username, logo)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Não consegui gerar a imagem agora. Tenta de novo.')
    return blob
  }, [quote, template, username, logo])

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

function loadChoice(): StoredChoice {
  try {
    const raw = window.localStorage.getItem(CHOICE_KEY)
    if (!raw) return { category: 'disciplina', quoteId: null }
    const parsed = JSON.parse(raw) as Partial<StoredChoice>
    const category = QUOTE_CATEGORIES.find((item) => item === parsed.category) ?? 'disciplina'
    return { category, quoteId: typeof parsed.quoteId === 'string' ? parsed.quoteId : null }
  } catch {
    return { category: 'disciplina', quoteId: null }
  }
}

function persistChoice(choice: StoredChoice): void {
  try {
    window.localStorage.setItem(CHOICE_KEY, JSON.stringify(choice))
  } catch {
    // Sem armazenamento a escolha vale só nesta sessão.
  }
}
