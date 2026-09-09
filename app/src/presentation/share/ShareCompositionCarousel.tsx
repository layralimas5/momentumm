import { useEffect, useRef } from 'react'
import {
  SHARE_COMPOSITIONS,
  SHARE_COMPOSITION_SPECS,
  type ShareCardData,
  type ShareCompositionId,
  type ShareFormat,
  type ShareTemplateId,
} from '@/domain/share/share-card'
import { ShareCardPreview } from './ShareCardPreview'
import type { SharePhoto } from './render/render-share-card'
import { cn } from '@/shared/lib/cn'

interface ShareCompositionCarouselProps {
  readonly data: ShareCardData
  readonly template: ShareTemplateId
  readonly format: ShareFormat
  readonly value: ShareCompositionId
  readonly photo: SharePhoto | null
  readonly onChange: (composition: ShareCompositionId) => void
  readonly className?: string
}

/**
 * O preview, deslizando.
 *
 * A escolha do arranjo acontece no PRÓPRIO card: arrasta pro lado e a mesma
 * informação se reorganiza — número gigante, cartaz, lista de tópicos, anel de
 * progresso, mapa. É o gesto que a pessoa já faz em qualquer app de foto, e
 * troca uma fileira de miniaturas de 60px por seis cards do tamanho real.
 *
 * Cada slide é um preview de verdade, não uma amostra: o desenho é o mesmo que
 * sai no PNG, então não existe "escolhi um e saiu outro".
 *
 * Os pontos embaixo não são só indicador — são botões. Deslizar não funciona
 * por teclado nem por leitor de tela, e um seletor que só existe no gesto
 * deixa de fora justamente quem mais precisa de alternativa.
 */
export function ShareCompositionCarousel({
  data,
  template,
  format,
  value,
  photo,
  onChange,
  className,
}: ShareCompositionCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const slidesRef = useRef(new Map<ShareCompositionId, HTMLDivElement>())
  /*
    Rolagem provocada por clique não pode disparar a troca de novo.

    Sem essa trava, clicar no ponto 5 rola o trilho, o listener lê os slides do
    caminho e chama `onChange` pra cada um deles — e a pessoa vê o nome do
    arranjo piscando entre quatro valores antes de parar.
  */
  const programmatic = useRef(false)

  useEffect(() => {
    const slide = slidesRef.current.get(value)
    const track = trackRef.current
    if (!slide || !track) return

    const target = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2
    if (Math.abs(track.scrollLeft - target) < 8) return

    programmatic.current = true
    track.scrollTo({ left: target, behavior: 'smooth' })

    const timer = window.setTimeout(() => {
      programmatic.current = false
    }, 500)
    return () => window.clearTimeout(timer)
  }, [value])

  const handleScroll = () => {
    if (programmatic.current) return
    const track = trackRef.current
    if (!track) return

    const center = track.scrollLeft + track.clientWidth / 2
    let closest: ShareCompositionId = value
    let distance = Number.POSITIVE_INFINITY

    for (const [id, slide] of slidesRef.current) {
      const slideCenter = slide.offsetLeft + slide.clientWidth / 2
      const delta = Math.abs(slideCenter - center)
      if (delta < distance) {
        distance = delta
        closest = id
      }
    }

    if (closest !== value) onChange(closest)
  }

  const spec = SHARE_COMPOSITION_SPECS[value]
  const index = SHARE_COMPOSITIONS.indexOf(value)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        role="group"
        aria-label="Arranjo do card: arraste para o lado para ver outros"
        /*
          `snap-mandatory` com os slides centrados: soltar o dedo no meio do
          caminho encaixa no card mais próximo em vez de deixar dois pela
          metade — que é o estado em que ninguém consegue decidir.
        */
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
      >
        {SHARE_COMPOSITIONS.map((composition) => (
          <div
            key={composition}
            ref={(node) => {
              if (node) slidesRef.current.set(composition, node)
              else slidesRef.current.delete(composition)
            }}
            className={cn(
              'shrink-0 snap-center transition-opacity duration-200',
              composition === value ? 'opacity-100' : 'opacity-55',
            )}
          >
            <ShareCardPreview
              data={data}
              template={template}
              composition={composition}
              format={format}
              photo={photo}
              className="max-h-[46dvh] sm:max-h-[54dvh]"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink">{spec.label}</span>
          <span className="text-ink-faint"> · {spec.hint}</span>
        </p>

        <div role="radiogroup" aria-label="Arranjo do card" className="flex items-center gap-2">
          {SHARE_COMPOSITIONS.map((composition, position) => {
            const selected = composition === value
            return (
              <button
                key={composition}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={SHARE_COMPOSITION_SPECS[composition].label}
                onClick={() => onChange(composition)}
                className={cn(
                  // Alvo de 24px com o ponto desenhado dentro: o ponto sozinho
                  // teria 8px, que ninguém acerta com o polegar em movimento.
                  'grid size-6 place-items-center rounded-full transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'block rounded-full transition-all duration-200',
                    selected
                      ? 'h-2 w-5 bg-brand'
                      : position === index
                        ? 'size-2 bg-brand'
                        : 'size-2 bg-line-hi',
                  )}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
