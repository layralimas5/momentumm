import { useEffect, useRef, useState } from 'react'
import { MAX_STORY_CAPTION, STORY_HOURS } from '@/domain/entities/story'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { prepareStoryImage, previewOf, releasePreview } from './prepare-image'

/** O que o bucket aceita em vídeo (migration 0067). */
const VIDEO_TYPES = ['video/mp4', 'video/webm']
/** 20MB é o teto do bucket. Quinze segundos de 720p cabem com folga. */
const MAX_VIDEO_BYTES = 20 * 1024 * 1024

/**
 * O story: foto ou vídeo curto, com legenda opcional, por 24 horas.
 *
 * ## Por que o vídeo entra, e entra pequeno
 *
 * O pedido dizia "vídeo curto, se a infraestrutura permitir sem complexidade
 * excessiva". Ela permite: o bucket já aceita `video/mp4` e `video/webm`, e a
 * política de leitura é a mesma da foto. O que NÃO entra é transcodificação —
 * o arquivo sobe como veio, e o único freio é o tamanho, checado aqui e no
 * bucket. Gravar, cortar e comprimir vídeo no navegador é outro projeto.
 *
 * A foto passa pela mesma redução da publicação. O vídeo não passa por
 * nenhuma: mexer nele no cliente exigiria um codificador inteiro no bundle.
 */
export function StoryComposer({
  open,
  onClose,
  onPublished,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly onPublished: () => void
}) {
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [pickError, setPickError] = useState<string | null>(null)

  useEffect(() => {
    if (open) return
    if (preview) releasePreview(preview)
    setFile(null)
    setPreview(null)
    setCaption('')
    setPickError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pick = (chosen: File | undefined) => {
    if (!chosen) return
    setPickError(null)

    const isVideo = VIDEO_TYPES.includes(chosen.type)
    if (!isVideo && !chosen.type.startsWith('image/')) {
      setPickError('Story aceita foto ou vídeo curto (mp4 ou webm).')
      return
    }
    if (isVideo && chosen.size > MAX_VIDEO_BYTES) {
      setPickError('Esse vídeo passa de 20MB. Tenta um trecho mais curto.')
      return
    }

    if (preview) releasePreview(preview)
    setFile(chosen)
    setPreview(previewOf(chosen))
  }

  const publish = useAsyncAction(async () => {
    if (!profile || !file) return
    const isVideo = VIDEO_TYPES.includes(file.type)

    if (isVideo) {
      await container.social.publishStory(
        {
          userId: profile.id,
          path: '',
          kind: 'video',
          caption: caption.trim() || null,
          width: null,
          height: null,
        },
        file,
      )
    } else {
      const prepared = await prepareStoryImage(file)
      await container.social.publishStory(
        {
          userId: profile.id,
          path: '',
          kind: 'imagem',
          caption: caption.trim() || null,
          width: prepared.width,
          height: prepared.height,
        },
        prepared.blob,
      )
    }

    onPublished()
  })

  const isVideo = file ? VIDEO_TYPES.includes(file.type) : false

  return (
    <BottomSheet
      open={open}
      title="Novo story"
      description={`Fica no ar por ${STORY_HOURS} horas e some sozinho.`}
      onClose={onClose}
      footer={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!file || publish.running}
          loading={publish.running}
          onClick={() => void publish.run()}
        >
          <Icon name="check" className="size-4" />
          Publicar story
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {preview ? (
          <div className="relative overflow-hidden rounded-2xl bg-surface-hi">
            {isVideo ? (
              <video
                src={preview}
                controls
                playsInline
                className="mx-auto max-h-80 w-full object-contain"
              />
            ) : (
              <img src={preview} alt="Prévia do story" className="mx-auto max-h-80 object-contain" />
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute right-2 top-2 rounded-full border border-line-hi bg-canvas/85 px-3 py-1.5 text-xs font-medium text-ink backdrop-blur-sm"
            >
              Trocar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-hi bg-surface-hi/40 text-ink-muted transition-colors active:bg-surface-hi"
          >
            <Icon name="imagem" className="size-7" />
            <span className="text-sm font-medium">Escolher foto ou vídeo</span>
            <span className="text-xs text-ink-faint">Vídeo curto, até 20MB</span>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/mp4,video/webm"
          className="sr-only"
          onChange={(event) => {
            pick(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        {pickError ? <p className="text-sm text-ink-faint">{pickError}</p> : null}

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">Legenda (opcional)</span>
          <input
            value={caption}
            maxLength={MAX_STORY_CAPTION}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="5h da manhã e o café já está pronto"
            className="h-13 w-full rounded-xl border border-line bg-surface-hi px-3.5 text-ink placeholder:text-ink-faint focus:border-brand"
          />
        </label>

        <div aria-live="polite">{publish.error ? <ErrorNote message={publish.error} /> : null}</div>
      </div>
    </BottomSheet>
  )
}
