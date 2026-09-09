import { useState } from 'react'
import {
  PROFILE_VISIBILITIES,
  PROFILE_VISIBILITY_HINTS,
  PROFILE_VISIBILITY_LABELS,
  type Profile,
  type ProfileVisibility,
} from '@/domain/entities/profile'
import { container } from '@/infrastructure/container'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import { toUserMessage } from '@/shared/errors'
import { cn } from '@/shared/lib/cn'

interface ProfileVisibilityPanelProps {
  readonly profile: Profile
  readonly onSaved: () => Promise<void>
}

/**
 * Quem vê o teu perfil.
 *
 * Três degraus, e o padrão é o mais fechado. A escolha vale pro PERFIL — os
 * números, as conquistas, os objetivos ativos —, nunca pros momentos: um perfil
 * público não torna público nada que a pessoa não marcou, e é por isso que o
 * texto de "Público" diz isso em voz alta em vez de deixar a dedução por conta
 * de quem clica.
 *
 * Salva no toque, sem botão de confirmar. É uma escolha reversível de uma
 * propriedade só — um "Salvar" aqui criaria o estado intermediário em que a
 * tela mostra uma coisa e o banco guarda outra.
 */
export function ProfileVisibilityPanel({ profile, onSaved }: ProfileVisibilityPanelProps) {
  const [saving, setSaving] = useState<ProfileVisibility | null>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = async (visibility: ProfileVisibility) => {
    if (visibility === profile.visibility) return
    setSaving(visibility)
    setError(null)
    try {
      await container.profiles.update(profile.id, { visibility })
      await onSaved()
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setSaving(null)
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Quem vê teu perfil"
        icon="cadeado"
        hint="Vale pros teus números e conquistas. O que você compartilha continua sendo escolha de cada momento."
      />

      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <ul
        role="radiogroup"
        aria-label="Visibilidade do perfil"
        className="mt-4 flex flex-col gap-2"
      >
        {PROFILE_VISIBILITIES.map((visibility) => {
          const selected = profile.visibility === visibility
          const busy = saving === visibility

          return (
            <li key={visibility}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving !== null}
                onClick={() => void choose(visibility)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  selected
                    ? 'border-brand bg-brand-dim/40'
                    : 'border-line bg-surface-hi/40 hover:border-line-hi active:bg-surface-top',
                  saving !== null && !busy && 'opacity-60',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
                    selected ? 'border-brand bg-brand text-white' : 'border-line-hi',
                  )}
                >
                  {selected ? <Icon name="check" className="size-3" strokeWidth={3} /> : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {PROFILE_VISIBILITY_LABELS[visibility]}
                    </span>
                    {visibility === 'privado' ? (
                      <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-faint">
                        padrão
                      </span>
                    ) : null}
                    {busy ? (
                      <span
                        aria-hidden="true"
                        className="size-3.5 animate-spin rounded-full border-2 border-line-hi border-t-brand"
                      />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-pretty text-xs text-ink-muted">
                    {PROFILE_VISIBILITY_HINTS[visibility]}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/*
        A frase que fecha o painel existe pra não deixar a promessa implícita.
        Enquanto não houver feed nem comunidade, "público" significa uma coisa
        pequena — e dizer isso agora é o que evita a sensação de que o app
        mudou de ideia quando o feed chegar.
      */}
      <p className="mt-3 text-xs text-ink-faint">
        Ainda não existe feed, seguidores nem comunidade no Momentumm. Hoje isso decide só quem
        consegue abrir teu perfil.
      </p>
    </Panel>
  )
}
