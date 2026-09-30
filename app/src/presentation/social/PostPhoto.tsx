import { useState } from 'react'
import type { PostMedia } from '@/domain/entities/post'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { useSignedUrls } from './use-signed-media'

/**
 * As fotos de uma publicação.
 *
 * ## O espaço vem antes da imagem
 *
 * O `aspect-ratio` sai das medidas guardadas na linha (`width`/`height`), e é
 * aplicado ao contêiner ANTES de a imagem existir. Sem isso, cada foto que
 * carrega empurra o resto do feed pra baixo — é o CLS que o produto mede, e no
 * celular ele aparece como "eu ia tocar em curtir e o card pulou".
 *
 * Sem medida guardada (publicação antiga), o padrão é 4:5, que é a proporção
 * mais comum de foto de celular em pé.
 *
 * ## O carrossel
 *
 * Rolagem nativa com `snap`, e não uma biblioteca: o gesto do sistema já é o
 * melhor que existe, tem inércia certa, respeita o `prefers-reduced-motion` e
 * funciona com teclado. Os pontos embaixo são só indicador; quem navega por
 * teclado usa a própria rolagem, e cada foto tem rótulo.
 */
export function PostPhoto({
  media,
  alt,
  rounded = true,
}: {
  readonly media: readonly PostMedia[]
  readonly alt: string
  readonly rounded?: boolean
}) {
  const urls = useSignedUrls(media.map((item) => item.path))
  const [active, setActive] = useState(0)

  if (media.length === 0) return null

  const first = media[0]
  const ratio = first?.width && first?.height ? `${first.width} / ${first.height}` : '4 / 5'

  return (
    <div className="relative">
      <div
        className={cn(
          'flex snap-x snap-mandatory overflow-x-auto bg-surface-hi',
          rounded && 'rounded-xl',
        )}
        style={{ aspectRatio: ratio }}
        onScroll={(event) => {
          const target = event.currentTarget
          const width = target.clientWidth || 1
          setActive(Math.round(target.scrollLeft / width))
        }}
      >
        {media.map((item, index) => (
          <Frame
            key={item.id}
            url={urls.get(item.path) ?? null}
            alt={media.length > 1 ? `${alt} (${index + 1} de ${media.length})` : alt}
          />
        ))}
      </div>

      {media.length > 1 ? (
        <>
          <span className="absolute right-2 top-2 rounded-full bg-canvas/75 px-2 py-0.5 text-[0.6875rem] font-medium text-ink tabular backdrop-blur-sm">
            {active + 1}/{media.length}
          </span>
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5"
          >
            {media.map((item, index) => (
              <span
                key={item.id}
                className={cn(
                  'size-1.5 rounded-full transition-colors',
                  index === active ? 'bg-white' : 'bg-white/40',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

/**
 * Uma foto do carrossel, com os dois estados que sobram quando dá errado.
 *
 * Enquanto o link não chegou: um bloco pulsando, do tamanho exato da foto.
 * Quando o arquivo não abre (link vencido, arquivo apagado por fora, sem
 * rede): um aviso discreto, no lugar da imagem. `onError` do `<img>` é a
 * única forma de saber isso — o link pode ter sido assinado com sucesso e o
 * arquivo não existir mais.
 */
function Frame({ url, alt }: { readonly url: string | null; readonly alt: string }) {
  const [broken, setBroken] = useState(false)

  if (!url || broken) {
    return (
      <div className="grid w-full shrink-0 snap-center place-items-center">
        {broken ? (
          <span className="flex flex-col items-center gap-1.5 text-ink-faint">
            <Icon name="imagem" className="size-6" />
            <span className="text-xs">Imagem indisponível</span>
          </span>
        ) : (
          <span className="size-full animate-pulse bg-surface-top/60" aria-hidden="true" />
        )}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="w-full shrink-0 snap-center object-cover"
    />
  )
}
