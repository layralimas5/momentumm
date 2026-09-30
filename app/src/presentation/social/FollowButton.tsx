import { useEffect, useState } from 'react'
import { followButtonLabel, NO_FOLLOW_STATE, type FollowState } from '@/domain/entities/social-graph'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { toUserMessage } from '@/shared/errors'
import { useSocialNotify } from './PostComposerProvider'

/**
 * Seguir, solicitar, deixar de seguir e desbloquear, num botão só.
 *
 * Ele existe porque o mesmo botão aparece no perfil, na busca, na sugestão e na
 * lista de seguidores. Quatro cópias escreveriam "Solicitado" de quatro jeitos
 * e uma delas esqueceria de tratar o perfil fechado.
 *
 * ## O estado vem do servidor, sempre
 *
 * Seguir um perfil ABERTO vira "Seguindo" na hora; seguir um FECHADO vira
 * "Solicitado". Quem decide é um trigger (migration 0067), e adivinhar aqui,
 * pela visibilidade que a tela tem em mãos, daria "Seguindo" num perfil que
 * acabou de fechar — e a pessoa acharia que está vendo o que não vê.
 *
 * Por isso a mudança não é otimista: o botão mostra "carregando" pelo tempo da
 * ida. É meio segundo uma vez, contra um rótulo que mente.
 *
 * ## Deixar de seguir pergunta, seguir não
 *
 * Seguir se desfaz num toque. Deixar de seguir um perfil FECHADO custa um
 * pedido novo e a espera de outra pessoa, então esse caso confirma; o aberto
 * não.
 */
export function FollowButton({
  userId,
  size = 'md',
  closedProfile = false,
  onChange,
}: {
  readonly userId: string
  readonly size?: 'sm' | 'md'
  /** Perfil fechado: deixar de seguir aqui custa um pedido novo. */
  readonly closedProfile?: boolean
  readonly onChange?: (state: FollowState) => void
}) {
  const { warn } = useSocialNotify()
  const [state, setState] = useState<FollowState>(NO_FOLLOW_STATE)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [confirmUnfollow, setConfirmUnfollow] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)

    void container.social
      .followState(userId)
      .then((result) => {
        if (alive) setState(result)
      })
      .catch(() => {
        if (alive) setState(NO_FOLLOW_STATE)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [userId])

  const apply = (next: FollowState) => {
    setState(next)
    onChange?.(next)
  }

  const act = async () => {
    setWorking(true)
    try {
      if (state.blocked) {
        await container.social.unblock(userId)
        apply(await container.social.followState(userId))
        return
      }

      if (state.following || state.requested) {
        await container.social.unfollow(userId)
        apply({ ...state, following: false, requested: false })
        return
      }

      apply(await container.social.follow(userId))
    } catch (cause) {
      warn(toUserMessage(cause))
    } finally {
      setWorking(false)
      setConfirmUnfollow(false)
    }
  }

  const following = state.following || state.requested

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={following || state.blocked ? 'secondary' : 'primary'}
        loading={working}
        disabled={loading || working}
        onClick={() => {
          if (state.following && closedProfile) {
            setConfirmUnfollow(true)
            return
          }
          void act()
        }}
        className="shrink-0"
      >
        {loading ? ' ' : followButtonLabel(state)}
      </Button>

      <ConfirmDialog
        open={confirmUnfollow}
        title="Deixar de seguir?"
        description="Esse perfil é fechado. Pra voltar a acompanhar, você vai precisar pedir de novo e esperar a resposta."
        confirmLabel="Deixar de seguir"
        destructive
        onConfirm={() => void act()}
        onClose={() => setConfirmUnfollow(false)}
      />
    </>
  )
}
