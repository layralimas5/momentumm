import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { INVITE_STORAGE_KEY, parseInviteCode } from '@/domain/entities/referral'
import { track } from '@/infrastructure/analytics/track'
import { useAuth } from '@/presentation/auth/use-auth'
import { LogoMark } from '@/presentation/components/brand/Logo'
import { buttonClass } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'

/**
 * A tela do link de convite de amigo.
 *
 * É PÚBLICA de propósito: quem recebe o link normalmente não tem conta, e
 * mandar essa pessoa direto pro cadastro sem dizer do que se trata é perder a
 * maior parte dos convites.
 *
 * O que ela NÃO mostra: quem convidou. O código é um @, e confirmar na tela
 * que aquele @ existe transformaria o link numa sonda, qualquer pessoa
 * poderia descobrir quem tem conta aqui testando nomes. Quem convidou a pessoa
 * sabe; ela vai reconhecer o nome quando o pedido de amizade chegar, depois do
 * cadastro, com o aceite dos dois lados.
 *
 * O código fica guardado no navegador e é gasto no primeiro login: é o que
 * permite a pessoa ler a página hoje, criar a conta amanhã e a origem continuar
 * certa.
 */
export function FriendInvitePage() {
  const { code = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const invite = parseInviteCode(code)

  useEffect(() => {
    if (!invite) return

    try {
      window.localStorage.setItem(INVITE_STORAGE_KEY, invite)
    } catch {
      // Sem armazenamento o convite vale só enquanto esta aba estiver aberta;
      // quem já vai criar a conta agora não perde nada.
    }

    track('friend_invite_opened', 'circulo', { result: user ? 'com_sessao' : 'sem_sessao' })
  }, [invite, user])

  // Quem já tem conta não precisa de apresentação: vai pro app, e a origem é
  // resolvida lá dentro (ou ignorada, se a conta já for antiga).
  useEffect(() => {
    if (user) navigate('/app', { replace: true })
  }, [user, navigate])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-5 py-10">
      <LogoMark className="mx-auto size-10" />

      <Panel className="text-center">
        <p className="text-[0.6875rem] font-medium tracking-[0.12em] text-brand-ink uppercase">
          Você foi convidado
        </p>

        <h1 className="mt-3 text-2xl leading-tight font-bold tracking-tight text-balance text-ink">
          Evoluir junto é mais fácil
        </h1>

        <p className="mt-3 text-sm text-pretty text-ink-muted">
          O Momentumm é onde você decide o que importa hoje e vê o quanto já andou. Quem te chamou
          já está por aqui, e vocês podem acompanhar o progresso um do outro, se os dois quiserem.
        </p>

        <ul className="mt-5 flex flex-col gap-2.5 text-left">
          <Line icon="objetivo">Um objetivo, um plano e uma ação por dia.</Line>
          <Line icon="hoje">O seu ritmo, medido sem cobrança.</Line>
          <Line icon="jornada">O progresso de quem você escolher acompanhar.</Line>
        </ul>

        <Link
          to="/entrar"
          onClick={() => track('friend_invite_accepted', 'circulo')}
          className={buttonClass({ size: 'lg', className: 'mt-6 w-full' })}
        >
          Criar minha conta
        </Link>

        <Link
          to="/entrar"
          className="mt-3 inline-block min-h-11 px-3 py-3 text-sm text-ink-faint transition-colors hover:text-ink"
        >
          Já tenho conta
        </Link>
      </Panel>

      <p className="text-center text-xs text-ink-faint">
        Entrar por um convite não compartilha nada automaticamente. Acompanhar o progresso de
        alguém é sempre um combinado entre as duas pessoas.
      </p>
    </main>
  )
}

function Line({ icon, children }: { readonly icon: 'objetivo' | 'hoje' | 'jornada'; readonly children: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink-muted">
      <Icon name={icon} className="mt-0.5 size-4 shrink-0 text-brand-ink" />
      <span className="text-pretty">{children}</span>
    </li>
  )
}
