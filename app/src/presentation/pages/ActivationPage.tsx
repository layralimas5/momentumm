import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/presentation/auth/use-auth'
import { Activation } from '@/presentation/components/dashboard/Activation'
import { useActivation } from '@/presentation/planner/use-activation'
import { usePlanner } from '@/presentation/planner/use-planner'

/**
 * O primeiro acesso, em tela cheia.
 *
 * A casca do app manda toda conta vazia pra cá antes de qualquer outra tela
 * (`ActivationGate`). Aqui não existe barra de abas nem menu: a única saída
 * é responder ou "deixar pra depois", e as duas desembocam no Hoje.
 *
 * Conta que já tem alguma coisa criada não fica aqui: o onboarding é sobre
 * o primeiro objetivo, e quem já tem um cria os próximos pelo diálogo comum.
 */
export function ActivationPage() {
  const { profile } = useAuth()
  const planner = usePlanner()
  const navigate = useNavigate()
  const activation = useActivation()

  // Pulou ou salvou: o Hoje é o destino. O `skipped` muda por estado, então
  // a navegação acontece na renderização seguinte, não dentro do clique.
  useEffect(() => {
    if (activation.skipped) navigate('/app', { replace: true })
  }, [activation.skipped, navigate])

  if (!planner.loading && !planner.isNewUser) return <Navigate to="/app" replace />

  return (
    <Activation
      firstName={profile?.name.split(' ')[0] ?? null}
      today={planner.today}
      control={activation}
    />
  )
}
