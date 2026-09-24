import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_PREFERENCES,
  NOTIFICATION_SPECS,
  type NotificationPreferences as Preferences,
  type NotificationType,
} from '@/domain/notifications/notification-types'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { toUserMessage } from '@/shared/errors'

/**
 * O que você quer receber, e quando.
 *
 * Existe porque a alternativa é a pessoa desligar TUDO no primeiro aviso que
 * não fez sentido pra ela — e aí o app perde também os avisos que fariam
 * diferença. Cada linha diz o que aquele tipo faz, não o nome técnico dele.
 *
 * As mudanças salvam sozinhas: um botão "salvar" numa tela de preferência é
 * um jeito de perder a mudança de quem saiu da página achando que já foi.
 */
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void container.push
      .loadPreferences()
      .then((next) => {
        if (alive) setPrefs(next)
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const save = useCallback(async (next: Preferences) => {
    setPrefs(next)
    setSaving(true)
    setError(null)
    try {
      await container.push.savePreferences(next)
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setSaving(false)
    }
  }, [])

  const toggle = useCallback(
    (type: NotificationType) => {
      const has = prefs.types.includes(type)
      void save({
        ...prefs,
        types: has ? prefs.types.filter((item) => item !== type) : [...prefs.types, type],
      })
    },
    [prefs, save],
  )

  if (loading) return null

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">O que você quer receber</p>
        {saving ? <span className="text-xs text-ink-faint">salvando…</span> : null}
      </div>

      <p className="mt-1.5 text-sm text-ink-muted">
        No máximo um aviso por dia, sempre o mais útil no momento. Nada entre {prefs.quietFrom}h e{' '}
        {prefs.quietTo}h.
      </p>

      <ul className="mt-3 flex flex-col gap-1">
        {NOTIFICATION_SPECS.map((spec) => {
          const on = prefs.types.includes(spec.type)
          return (
            <li key={spec.type}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-surface">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(spec.type)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{spec.label}</span>
                  <span className="block text-sm text-ink-faint">{spec.description}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-ink-muted" htmlFor="hora-preferida">
          Horário preferido
        </label>
        <select
          id="hora-preferida"
          value={prefs.preferredHour}
          onChange={(event) => void save({ ...prefs, preferredHour: Number(event.target.value) })}
          className="h-9 rounded-lg border border-line bg-canvas px-2 text-sm text-ink"
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </div>

      {prefs.types.length === 0 ? (
        <p className="mt-3 text-sm text-ink-faint">
          Com tudo desmarcado você não recebe aviso nenhum. O app continua igual: só não te chama.
        </p>
      ) : null}

      <div aria-live="polite" className="min-h-6">
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </div>

      {prefs.types.length > 0 && prefs.types.length < NOTIFICATION_SPECS.length ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1"
          onClick={() => void save(DEFAULT_PREFERENCES)}
        >
          Voltar ao padrão
        </Button>
      ) : null}
    </div>
  )
}
