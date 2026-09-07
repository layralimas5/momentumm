import { useId, useRef } from 'react'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import type { SharePhotoState } from './use-share-photo'

/**
 * Escolher a foto de fundo.
 *
 * É um `input[type=file]` de verdade por baixo: no celular ele já abre a
 * bandeja do sistema com câmera e galeria, que é exatamente o que a pessoa
 * espera e o que nenhuma implementação própria faria melhor.
 *
 * Sem foto, o card usa o fundo do template. Com foto, ela vira o fundo e o
 * texto passa a branco com sombra — não existe segunda decisão a tomar aqui.
 */
export function ShareStudioPhotoPicker({ state }: { readonly state: SharePhotoState }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const { photo, loading, error } = state

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void state.choose(file)
          // Zera o campo: sem isso, escolher a MESMA foto de novo depois de
          // remover não dispara evento nenhum e a tela parece travada.
          event.target.value = ''
        }}
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex min-h-13 flex-1 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
            photo
              ? 'border-brand/40 bg-brand-dim/30'
              : 'border-dashed border-line-hi bg-surface-hi/40 active:bg-surface-top',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border',
              photo ? 'border-brand/40' : 'border-line bg-surface-hi text-ink-faint',
            )}
          >
            {photo ? (
              <img
                src={(photo.image as HTMLImageElement).src}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Icon name="mais" className="size-5" />
            )}
          </span>

          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">
              {loading ? 'Abrindo a foto…' : photo ? 'Trocar foto' : 'Usar uma foto de fundo'}
            </span>
            <span className="mt-0.5 block text-xs text-ink-faint">
              {photo ? 'O texto vira branco por cima dela' : 'A foto fica no seu aparelho'}
            </span>
          </span>
        </button>

        {photo ? (
          <button
            type="button"
            onClick={state.clear}
            className="grid size-13 shrink-0 place-items-center rounded-xl border border-line text-ink-faint transition-colors active:bg-surface-top"
          >
            <Icon name="lixeira" className="size-5" />
            <span className="sr-only">Remover a foto</span>
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
