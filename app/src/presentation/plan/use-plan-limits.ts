import { useMemo } from 'react'
import { limitsOf, type PlanLimits } from '@/domain/entities/plan'
import { useAuth } from '@/presentation/auth/use-auth'

/**
 * O que o plano desta conta permite, num lugar só.
 *
 * Existe por causa de uma duplicação que já estava espalhada: quatro telas
 * escreviam `limitsOf(profile?.plan ?? 'free')` cada uma por conta própria. O
 * risco não é a repetição, é o PADRÃO — o dia em que uma delas esquecer o
 * `?? 'free'`, ou escrever `?? 'pro'`, aquela tela passa a liberar recurso pago
 * pra sessão que ainda está carregando o perfil, e nada acusa.
 *
 * Sem perfil carregado, gratuito. Enquanto a resposta não chega, oferecer menos
 * e corrigir pra mais é o erro barato; o contrário mostra o recurso e tira da
 * mão da pessoa.
 *
 * Isto é UI, e UI não autoriza nada: quem recusa de verdade é o servidor. O
 * teto de objetivos e a categoria de suporte são aplicados no banco (migrations
 * 0057 e 0058), e este hook só decide o que a tela oferece.
 */
export function usePlanLimits(): PlanLimits {
  const { profile } = useAuth()
  return useMemo(() => limitsOf(profile?.plan ?? 'free'), [profile?.plan])
}
