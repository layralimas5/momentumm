import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  SHARE_FORMAT_SPECS,
  SHARE_TEMPLATE_SPECS,
  type ShareCardData,
  type ShareFormat,
  type ShareTemplateId,
} from '@/domain/share/share-card'
import { renderShareCard } from './render/render-share-card'
import { cn } from '@/shared/lib/cn'

interface ShareCardPreviewProps {
  readonly data: ShareCardData
  readonly template: ShareTemplateId
  readonly format: ShareFormat
  readonly className?: string
}

/**
 * O preview.
 *
 * É o MESMO desenho da exportação, só que num canvas menor: a escala do
 * contexto faz o card de 1080 caber na largura disponível. Nenhuma linha de
 * layout é duplicada aqui, então "o preview mostra uma coisa e o arquivo sai
 * outra" não é um bug possível.
 *
 * O canvas é um elemento cego pra leitor de tela, então ele recebe `role="img"`
 * e uma descrição escrita a partir dos mesmos dados. Quem não enxerga a imagem
 * precisa saber o que está prestes a publicar — principalmente por causa dos
 * campos de privacidade.
 */
export function ShareCardPreview({ data, template, format, className }: ShareCardPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  const spec = SHARE_FORMAT_SPECS[format]
  const transparent = SHARE_TEMPLATE_SPECS[template].transparent

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(frame)
    setWidth(frame.clientWidth)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0) return

    // O canvas nasce na resolução real da tela e é reduzido por CSS: em tela
    // retina, desenhar em CSS pixels deixaria o número grande borrado, que é o
    // primeiro elemento que a pessoa olha.
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const height = (width * spec.height) / spec.width

    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const scale = (width * dpr) / spec.width
    ctx.scale(scale, scale)
    renderShareCard(ctx, data, { template, format })
  }, [data, template, format, width, spec.height, spec.width])

  return (
    /*
      A proporção vive no QUADRO, não no canvas: é ela que permite limitar o
      preview pela ALTURA e deixar a largura se resolver sozinha. Sem isso, um
      card 9:16 numa tela de 390px nasce com 690px de altura, e o celular
      mostra o topo do card com o resto cortado.
    */
    <div
      ref={frameRef}
      style={{ aspectRatio: `${spec.width} / ${spec.height}`, ...checkerStyle(transparent) }}
      className={cn(
        'relative w-auto self-center overflow-hidden rounded-2xl border border-line',
        // O xadrez aparece só no template sem fundo: é como a pessoa entende,
        // sem ler nada, que aquilo vai por cima de uma foto dela.
        transparent && 'bg-surface-hi',
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={describeCard(data)}
        className="block size-full"
      />
    </div>
  )
}

/** Xadrez atrás do template sem fundo: mostra a transparência sem explicar. */
function checkerStyle(transparent: boolean): CSSProperties {
  if (!transparent) return {}
  return {
    backgroundImage:
      'linear-gradient(45deg, var(--color-surface) 25%, transparent 25%), linear-gradient(-45deg, var(--color-surface) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-surface) 75%), linear-gradient(-45deg, transparent 75%, var(--color-surface) 75%)',
    backgroundSize: '24px 24px',
    backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0',
  }
}

/** A imagem em palavras. Lista o que está visível, e só o que está visível. */
export function describeCard(data: ShareCardData): string {
  const parts: string[] = ['Prévia do card']

  if (data.kicker) parts.push(data.kicker)
  parts.push(data.title)

  if (data.primaryMetric.value) {
    parts.push(
      data.primaryMetric.label
        ? `${data.primaryMetric.value} ${data.primaryMetric.label}`
        : data.primaryMetric.value,
    )
  }

  if (data.momentumAfter !== null) {
    parts.push(
      data.momentumBefore !== null && data.momentumBefore !== data.momentumAfter
        ? `Momentum de ${data.momentumBefore} para ${data.momentumAfter}`
        : `Momentum ${data.momentumAfter}`,
    )
  }

  if (data.items.length > 0) parts.push(`${data.items.length} itens listados`)
  if (data.username) parts.push(`assinado por ${data.username}`)
  if (data.date) parts.push(data.date)

  return `${parts.join('. ')}.`
}
