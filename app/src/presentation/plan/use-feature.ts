import { useEffect, useState } from 'react'
import type { PublicSettings } from '@/domain/admin/admin-schemas'
import { container } from '@/infrastructure/container'

/**
 * As chaves de `features` que o app consulta por nome.
 *
 * A lista existe pra o erro de digitação virar erro de compilação. O banco
 * aceita qualquer chave em `features` (é um `record<string, boolean>`), então
 * `useFeature('juntoss')` responderia `false` pra sempre, calado.
 */
export type FeatureKey = 'juntos' | 'ai' | 'share' | 'circle' | 'challenges' | 'recovery' | 'adaptiveDay'

/**
 * Uma leitura por carga de página, compartilhada.
 *
 * Sem o cache, cada tela que pergunta por uma flag faria a própria chamada —
 * e a barra de navegação, a tela e o card dentro dela perguntam a mesma coisa
 * na mesma renderização.
 */
let cache: Promise<PublicSettings> | null = null

function settings(): Promise<PublicSettings> {
  if (container.demo) return Promise.resolve({})
  cache ??= container.support.publicSettings().catch(() => ({}) as PublicSettings)
  return cache
}

export interface FeatureState {
  readonly enabled: boolean
  /** Ainda perguntando. A tela não decide nada enquanto isso for verdade. */
  readonly loading: boolean
}

/**
 * Um recurso está ligado?
 *
 * O padrão é o do `fallback`, não `true`: enquanto a resposta não chega, um
 * recurso novo aparecendo e sumindo é pior do que ele demorar um instante pra
 * aparecer. No modo demo tudo o que é visual fica ligado, senão não dá pra
 * trabalhar nas telas sem servidor.
 */
export function useFeature(key: FeatureKey, fallback = false): FeatureState {
  const [state, setState] = useState<FeatureState>(() =>
    container.demo ? { enabled: true, loading: false } : { enabled: fallback, loading: true },
  )

  useEffect(() => {
    if (container.demo) return
    let alive = true
    void settings().then((value) => {
      if (!alive) return
      setState({ enabled: value.features?.[key] === true, loading: false })
    })
    return () => {
      alive = false
    }
  }, [key])

  return state
}
