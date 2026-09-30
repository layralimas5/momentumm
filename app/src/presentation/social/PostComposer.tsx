import { useEffect, useMemo, useRef, useState } from 'react'
import { activityType } from '@/domain/entities/activity-type'
import { formatDayLong, type DayKey } from '@/domain/entities/day'
import { isRunning } from '@/domain/entities/objective'
import {
  MAX_CAPTION_LENGTH,
  MAX_POST_PHOTOS,
  POST_VISIBILITY_HINTS,
  POST_VISIBILITY_LABELS,
  progressLabel,
  type PostProgress,
  type PostVisibility,
} from '@/domain/entities/post'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useObjectives } from '@/presentation/planner/use-objectives'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { preparePostPhoto, previewOf, releasePreview } from './prepare-image'

interface Chosen {
  readonly file: File
  readonly preview: string
}

/**
 * Publicar um momento.
 *
 * O fluxo do pedido, numa folha só: foto, legenda, objetivo (opcional),
 * privacidade, publicar. Numa folha e não em cinco passos porque publicar tem
 * que caber num intervalo de ônibus — um assistente de cinco telas pra postar
 * uma foto é o jeito de garantir que ninguém poste a segunda.
 *
 * ## O objetivo nunca é obrigatório
 *
 * "Nenhum objetivo" é a primeira opção e é a que vem marcada. A pergunta
 * existe pra quem QUER amarrar o momento ao plano; obrigar transformaria cada
 * foto num relatório, e a maior parte da vida que vale contar não está em
 * nenhum plano.
 *
 * ## O progresso começa desligado
 *
 * É a mesma decisão do Share Studio: os campos que carregam informação da
 * pessoa nascem desligados, e quem liga é ela. Aqui o número sai do objetivo
 * que ela mesma escolheu, e ainda assim é uma escolha a mais, porque "1.240 de
 * 1.800 páginas" diz a terceiros o tamanho da meta dela.
 *
 * ## A foto é reduzida no aparelho
 *
 * Antes de subir, não depois: o upload fica rápido no 4G e o feed de quem vê
 * não baixa megabytes por card. A prévia usa o arquivo original, porque ela
 * precisa aparecer no toque.
 */
export function PostComposer({
  open,
  day,
  onClose,
  onPublished,
}: {
  readonly open: boolean
  readonly day: DayKey | null
  readonly onClose: () => void
  readonly onPublished: () => void
}) {
  const { profile } = useAuth()
  const planner = usePlanner()
  const objectives = useObjectives()
  const fileRef = useRef<HTMLInputElement>(null)

  const [photos, setPhotos] = useState<readonly Chosen[]>([])
  const [caption, setCaption] = useState('')
  const [objectiveId, setObjectiveId] = useState<string | null>(null)
  const [withProgress, setWithProgress] = useState(false)
  const [visibility, setVisibility] = useState<PostVisibility>('seguidores')
  const [pickError, setPickError] = useState<string | null>(null)

  const targetDay = day ?? planner.today
  const running = useMemo(
    () => objectives.filter((view) => isRunning(view.progress.objective)),
    [objectives],
  )
  const chosenObjective = running.find((view) => view.progress.objective.id === objectiveId) ?? null

  /** O par congelado, e a unidade em palavra, pro card fazer sentido pra terceiros. */
  const progress = useMemo<PostProgress | null>(() => {
    if (!chosenObjective || !withProgress) return null
    const axis = activityType(chosenObjective.progress.objective.axis)
    return {
      done: Math.round(chosenObjective.progress.done),
      goal: Math.round(chosenObjective.progress.target),
      unit: axis?.unitLabel.many ?? null,
    }
  }, [chosenObjective, withProgress])

  /* Fechar devolve a memória das prévias: dez fotos escolhidas e abandonadas
     ficariam presas até a aba fechar. */
  useEffect(() => {
    if (open) return
    for (const photo of photos) releasePreview(photo.preview)
    setPhotos([])
    setCaption('')
    setObjectiveId(null)
    setWithProgress(false)
    setVisibility('seguidores')
    setPickError(null)
    // Só ao fechar: incluir `photos` faria a limpeza rodar a cada escolha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pick = (list: FileList | null) => {
    if (!list || list.length === 0) return
    setPickError(null)

    const room = MAX_POST_PHOTOS - photos.length
    const accepted: Chosen[] = []
    for (const file of Array.from(list).slice(0, room)) {
      if (!file.type.startsWith('image/')) continue
      accepted.push({ file, preview: previewOf(file) })
    }

    if (accepted.length < list.length) {
      setPickError(
        room <= 0
          ? `Dá pra publicar até ${MAX_POST_PHOTOS} fotos de uma vez.`
          : 'Algumas dessas não são imagens e ficaram de fora.',
      )
    }
    setPhotos((current) => [...current, ...accepted])
  }

  const drop = (index: number) => {
    setPhotos((current) => {
      const photo = current[index]
      if (photo) releasePreview(photo.preview)
      return current.filter((_, position) => position !== index)
    })
  }

  const publish = useAsyncAction(async () => {
    if (!profile) return
    const prepared = await Promise.all(photos.map((photo) => preparePostPhoto(photo.file)))

    await container.social.publish(
      {
        userId: profile.id,
        caption: caption.trim() ? caption.trim() : null,
        day: targetDay,
        visibility,
        objectiveId,
        progress,
      },
      prepared,
    )
    onPublished()
  })

  const canPublish = photos.length > 0 && !publish.running

  return (
    <BottomSheet
      open={open}
      title="Publicar momento"
      description={`Sobre ${formatDayLong(targetDay, planner.today).toLowerCase()}.`}
      onClose={onClose}
      footer={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!canPublish}
          loading={publish.running}
          onClick={() => void publish.run()}
        >
          <Icon name="check" className="size-4" />
          Publicar
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <PhotoPicker
          photos={photos}
          onAdd={() => fileRef.current?.click()}
          onRemove={drop}
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            pick(event.target.files)
            event.target.value = ''
          }}
        />

        {pickError ? <p className="text-sm text-ink-faint">{pickError}</p> : null}

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">Legenda</span>
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value.slice(0, MAX_CAPTION_LENGTH))}
            rows={3}
            placeholder="Hoje foram só 25 minutos, mas eu fui."
            className="w-full resize-none rounded-xl border border-line bg-surface-hi px-3.5 py-3 text-ink placeholder:text-ink-faint focus:border-brand"
          />
          <span className="self-end text-xs text-ink-faint tabular">
            {caption.length}/{MAX_CAPTION_LENGTH}
          </span>
        </label>

        <ObjectivePicker
          objectives={running}
          value={objectiveId}
          onChange={(id) => {
            setObjectiveId(id)
            if (!id) setWithProgress(false)
          }}
        />

        {chosenObjective ? (
          <Toggle
            checked={withProgress}
            onChange={setWithProgress}
            label="Mostrar meu progresso"
            hint={
              progressLabel({
                done: Math.round(chosenObjective.progress.done),
                goal: Math.round(chosenObjective.progress.target),
                unit: activityType(chosenObjective.progress.objective.axis)?.unitLabel.many ?? null,
              }) ?? ''
            }
          />
        ) : null}

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        <div aria-live="polite">
          {publish.error ? <ErrorNote message={publish.error} /> : null}
        </div>
      </div>
    </BottomSheet>
  )
}

/**
 * As fotos escolhidas, em fila horizontal.
 *
 * Horizontal e não em grade porque a ordem importa: a primeira é a capa, e é
 * ela que vira a célula do calendário e da grade do perfil. Numa grade de três
 * colunas "a primeira" é uma informação que a pessoa tem que deduzir.
 */
function PhotoPicker({
  photos,
  onAdd,
  onRemove,
}: {
  readonly photos: readonly Chosen[]
  readonly onAdd: () => void
  readonly onRemove: (index: number) => void
}) {
  if (photos.length === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-hi bg-surface-hi/40 text-ink-muted transition-colors active:bg-surface-hi"
      >
        <Icon name="imagem" className="size-7" />
        <span className="text-sm font-medium">Escolher uma foto</span>
        <span className="text-xs text-ink-faint">Até {MAX_POST_PHOTOS}, e a primeira é a capa</span>
      </button>
    )
  }

  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
      {photos.map((photo, index) => (
        <div key={photo.preview} className="relative shrink-0 snap-start">
          <img
            src={photo.preview}
            alt={`Foto ${index + 1}`}
            className="size-28 rounded-xl object-cover"
          />
          {index === 0 ? (
            <span className="absolute bottom-1 left-1 rounded-full bg-canvas/80 px-2 py-0.5 text-[0.625rem] font-medium text-ink backdrop-blur-sm">
              capa
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full border border-line-hi bg-canvas text-ink-muted transition-colors active:bg-surface-top"
          >
            <Icon name="fechar" className="size-3.5" strokeWidth={2.25} />
            <span className="sr-only">Tirar a foto {index + 1}</span>
          </button>
        </div>
      ))}

      {photos.length < MAX_POST_PHOTOS ? (
        <button
          type="button"
          onClick={onAdd}
          className="grid size-28 shrink-0 snap-start place-items-center rounded-xl border border-dashed border-line-hi text-ink-muted transition-colors active:bg-surface-hi"
        >
          <Icon name="mais" className="size-6" />
          <span className="sr-only">Escolher mais fotos</span>
        </button>
      ) : null}
    </div>
  )
}

function ObjectivePicker({
  objectives,
  value,
  onChange,
}: {
  readonly objectives: ReturnType<typeof useObjectives>
  readonly value: string | null
  readonly onChange: (id: string | null) => void
}) {
  if (objectives.length === 0) return null

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">Isso faz parte de algum objetivo?</legend>
      <div className="flex flex-wrap gap-2">
        {/* "Nenhum" vem primeiro e nasce marcado: a resposta mais comum não pode
            exigir que a pessoa procure por ela. */}
        <Chip label="Nenhum objetivo" active={value === null} onClick={() => onChange(null)} />
        {objectives.map((view) => (
          <Chip
            key={view.progress.objective.id}
            label={view.progress.objective.title}
            active={value === view.progress.objective.id}
            onClick={() => onChange(view.progress.objective.id)}
          />
        ))}
      </div>
    </fieldset>
  )
}

function VisibilityPicker({
  value,
  onChange,
}: {
  readonly value: PostVisibility
  readonly onChange: (next: PostVisibility) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">Quem vê</legend>
      <div className="flex flex-col gap-1">
        {(['seguidores', 'privada'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              'flex min-h-14 items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
              value === option
                ? 'border-brand/50 bg-brand-dim/30'
                : 'border-line active:bg-surface-hi',
            )}
          >
            <Icon
              name={option === 'seguidores' ? 'pessoas' : 'cadeado'}
              className={cn('mt-0.5 size-5 shrink-0', value === option ? 'text-brand-hi' : 'text-ink-faint')}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">
                {POST_VISIBILITY_LABELS[option]}
              </span>
              <span className="mt-0.5 block text-sm text-ink-faint">
                {POST_VISIBILITY_HINTS[option]}
              </span>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Chip({
  label,
  active,
  onClick,
}: {
  readonly label: string
  readonly active: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-11 max-w-full truncate rounded-full border px-3.5 text-sm transition-colors',
        active
          ? 'border-brand/50 bg-brand-dim/40 text-brand-ink'
          : 'border-line text-ink-muted active:bg-surface-hi',
      )}
    >
      {label}
    </button>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  readonly checked: boolean
  readonly onChange: (next: boolean) => void
  readonly label: string
  readonly hint: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors active:bg-surface-hi"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-0.5 block truncate text-sm text-ink-faint">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-line-hi',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white transition-all',
            checked ? 'left-[1.375rem]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}
