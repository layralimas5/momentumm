import { useEffect } from 'react'
import { INVITE_STORAGE_KEY, parseInviteCode } from '@/domain/entities/referral'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'

/**
 * O convite guardado no navegador virando a origem da conta.
 *
 * A pessoa abre o link hoje, cria a conta amanhã, e o código continua lá — é
 * por isso que a captura mora aqui, na casca do app logado, e não no cadastro:
 * o caminho entre clicar no link e existir uma conta tem login social, e-mail
 * de confirmação e troca de aparelho no meio.
 *
 * Gasta uma vez e apaga, qualquer que seja a resposta. Se o servidor recusou
 * (conta velha demais, @ que não existe, o próprio @), tentar de novo amanhã
 * daria o mesmo não — e um código eterno no navegador acabaria atribuindo uma
 * conta criada meses depois.
 *
 * Nada aqui muda o que a pessoa vê. A atribuição é de análise: ela não conecta
 * ninguém a ninguém, porque acompanhar o progresso de alguém continua sendo
 * pedido e aceite dos dois lados.
 */
export function useInviteCapture(): void {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const stored = read()
    if (!stored) return

    clear()

    void container.referrals
      .register(stored)
      .then((registered) => {
        if (registered) track('friend_invite_accepted', 'circulo', { result: 'registrado' })
      })
      .catch(() => undefined)
  }, [user])
}

function read(): string | null {
  try {
    return parseInviteCode(window.localStorage.getItem(INVITE_STORAGE_KEY))
  } catch {
    return null
  }
}

function clear(): void {
  try {
    window.localStorage.removeItem(INVITE_STORAGE_KEY)
  } catch {
    // Sem armazenamento não havia o que apagar.
  }
}
