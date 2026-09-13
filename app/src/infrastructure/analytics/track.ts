import type {
  ProductEventMetadata,
  ProductEventName,
  ProductFeature,
} from '@/domain/analytics/product-events'
import { isDemoMode } from '@/infrastructure/config/env'
import { supabase } from '@/infrastructure/supabase/client'

/**
 * Registra um evento de uso. Dispara e esquece.
 *
 * Analytics nunca pode quebrar a tela nem atrasar a ação: a chamada não é
 * aguardada e o erro é engolido de propósito — o painel mostra menos um
 * evento, e é só. No modo demo não existe servidor, então não existe evento.
 *
 * O payload é o tipo fechado `ProductEventMetadata`. Passar um objeto do
 * domínio aqui não compila, e é assim que "só metadados" deixa de ser uma
 * frase de documentação.
 */
export function track(
  name: ProductEventName,
  feature: ProductFeature | null = null,
  metadata: ProductEventMetadata = {},
): void {
  if (isDemoMode) return
  void supabase()
    .rpc('track_event', { p_name: name, p_feature: feature, p_metadata: metadata })
    .then(() => undefined, () => undefined)
}

const viewed = new Set<string>()

/**
 * Uma visualização por recurso por sessão-hora. Contar cada render inflaria
 * "Hoje" a centenas por pessoa por dia e enterraria tudo o mais.
 */
export function trackFeatureView(feature: ProductFeature): void {
  const key = `${feature}:${new Date().toISOString().slice(0, 13)}`
  if (viewed.has(key)) return
  viewed.add(key)
  track('feature_view', feature)
}
