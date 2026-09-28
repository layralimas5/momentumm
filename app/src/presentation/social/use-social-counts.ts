import { useEffect, useState } from 'react'
import { EMPTY_SOCIAL_COUNTS, type SocialCounts } from '@/domain/entities/social-graph'
import { container } from '@/infrastructure/container'
import { useSocialRevision } from './PostComposerProvider'

/**
 * Publicações, seguidores e seguindo, numa chamada.
 *
 * Os três vêm juntos porque a linha do perfil mostra os três lado a lado, e
 * três idas ao servidor pra encher uma linha seriam três esperas pra responder
 * a mesma pergunta — com a segunda e a terceira chegando depois, fazendo os
 * números aparecerem um a um.
 *
 * ## A contagem é `security definer`, e não é descuido
 *
 * `profile_stats` roda por cima da RLS de `follows` porque contar pelo SELECT
 * normal devolveria só as linhas que a política deixa ver: cada pessoa veria
 * "1 seguidor" em todo perfil que ela mesma segue. O retorno é estreito de
 * propósito — três números, nenhum id, nenhum nome. É a mesma decisão que
 * `follow_counts` (0060) já tinha tomado.
 *
 * ## Falha não vira erro na tela
 *
 * Se a contagem não veio, o perfil mostra zero e segue em frente. Nada aqui
 * muda uma decisão da pessoa, e um aviso vermelho em cima do nome dela seria
 * alarme por uma informação de vitrine.
 */
export function useSocialCounts(userId: string | null): SocialCounts {
  const revision = useSocialRevision()
  const [counts, setCounts] = useState<SocialCounts>(EMPTY_SOCIAL_COUNTS)

  useEffect(() => {
    if (!userId) {
      setCounts(EMPTY_SOCIAL_COUNTS)
      return
    }

    let alive = true

    void container.social
      .counts(userId)
      .then((result) => {
        if (alive) setCounts(result)
      })
      .catch(() => {
        if (alive) setCounts(EMPTY_SOCIAL_COUNTS)
      })

    return () => {
      alive = false
    }
  }, [userId, revision])

  return counts
}
