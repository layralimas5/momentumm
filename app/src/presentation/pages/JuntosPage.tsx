import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { alreadySent, ENCOURAGEMENTS, encouragementSpec } from '@/domain/entities/pair'
import { track } from '@/infrastructure/analytics/track'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { InvitePanel } from '@/presentation/juntos/InvitePanel'
import { PairStrip } from '@/presentation/juntos/PairStrip'
import { usePair } from '@/presentation/juntos/use-pair'
import { useFeature } from '@/presentation/plan/use-feature'
import { usePlanner } from '@/presentation/planner/use-planner'
import { PageHeader } from './PageHeader'

/**
 * Juntos — a dupla.
 *
 * A tela inteira responde três perguntas, nessa ordem: como estamos hoje, o
 * que aconteceu nos últimos dias e o que eu posso mandar. Não existe quarta
 * pergunta — nem feed, nem histórico longo, nem perfil da outra pessoa.
 *
 * O que ela mostra sobre a outra pessoa é exatamente o que o servidor devolve:
 * nome curto, avatar e sete booleanos. Não há aqui nenhuma chamada capaz de
 * trazer mais do que isso.
 */
export function JuntosPage() {
  /*
    A flag decide se a rota existe pra esta conta.

    Ela é lida aqui, e não no roteador: a resposta vem do servidor e demora
    um instante, e uma rota que aparece depois faria a tela piscar entre "não
    existe" e "existe" a cada carga.
  */
  const juntos = useFeature('juntos')
  const { pair, reading, loading, error, sending, send, leave } = usePair()
  const { user } = useAuth()
  const planner = usePlanner()
  const navigate = useNavigate()
  const [confirmLeave, setConfirmLeave] = useState(false)

  if (juntos.loading || loading) return <LoadingBlock label="Carregando sua dupla" />
  if (!juntos.enabled) return <Navigate to="/app" replace />

  if (!pair || !reading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageHeader
          title="Juntos"
          description="Uma pessoa acompanhando o seu ritmo — e você, o dela."
        />
        {error ? <ErrorNote message={error} /> : null}
        <InvitePanel />
        <Panel className="p-5">
          <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
            O que a outra pessoa vê
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-muted">
            <Item ok>Se você avançou hoje</Item>
            <Item ok>Em quais dos últimos sete dias você avançou</Item>
            <Item>Seus objetivos, ações e hábitos</Item>
            <Item>Suas notas, check-ins e registros</Item>
            <Item>Seu XP, nível, score e conquistas</Item>
          </ul>
        </Panel>
      </div>
    )
  }

  const partner = pair.members.find((member) => !member.isMe)
  const me = pair.members.find((member) => member.isMe)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="Juntos"
        description={
          partner ? `Você e ${partner.name}, em movimento.` : 'Sua dupla de accountability.'
        }
      />

      {error ? <ErrorNote message={error} /> : null}

      {/* Como estamos hoje. É a primeira dobra porque é a única coisa que muda. */}
      <Panel tone="brand" className="p-5">
        <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">Hoje</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-balance text-ink">
          {reading.headline}
        </h2>
        <p className="mt-1.5 text-sm text-pretty text-ink-muted">{reading.note}</p>

        <div className="mt-4 flex flex-col gap-2">
          {me ? <PairStrip member={me} today={planner.today} highlight /> : null}
          {partner ? <PairStrip member={partner} today={planner.today} /> : null}
        </div>

        {pair.daysTogether > 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-faint">
            <Icon name="fogo" className="size-4 text-brand-hi" />
            {pair.daysTogether}{' '}
            {pair.daysTogether === 1 ? 'dia em movimento juntas' : 'dias em movimento juntas'}
          </p>
        ) : null}
      </Panel>

      {/* O que eu mando. Três botões, um deles sugerido pelo estado do dia. */}
      <Panel className="p-5">
        <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
          Mandar um incentivo
        </h2>
        <p className="mt-1.5 text-sm text-ink-faint">
          {reading.partnerReturning
            ? 'Hoje, apoio funciona melhor que cobrança.'
            : 'Um por dia de cada tipo. Sem texto: só o gesto.'}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {ENCOURAGEMENTS.map((spec) => {
            const sent = user ? alreadySent(pair, user.id, spec.kind, planner.today) : false
            const suggested = spec.kind === reading.suggested

            return (
              <Button
                key={spec.kind}
                variant={suggested && !sent ? 'primary' : 'secondary'}
                loading={sending === spec.kind}
                disabled={sent}
                onClick={() => void send(spec.kind)}
                title={spec.hint}
              >
                <span aria-hidden="true">{spec.emoji}</span>
                {sent ? `${spec.label} · enviado` : spec.label}
              </Button>
            )
          })}
        </div>
      </Panel>

      {/* O que chegou hoje. Some quando não há nada: caixa vazia não é conteúdo. */}
      {pair.encouragementsToday.some((item) => item.recipientId === user?.id) ? (
        <Panel className="p-5">
          <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
            Chegou pra você
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {pair.encouragementsToday
              .filter((item) => item.recipientId === user?.id)
              .map((item) => {
                const spec = encouragementSpec(item.kind)
                return (
                  <li key={item.id} className="flex items-center gap-2.5 text-sm text-ink">
                    <span aria-hidden="true" className="text-lg">
                      {spec.emoji}
                    </span>
                    <span>
                      {partner?.name} mandou <strong className="font-medium">{spec.label}</strong>
                    </span>
                  </li>
                )
              })}
          </ul>
        </Panel>
      ) : null}

      {/* A retomada em dupla tem caminho próprio: volta com uma ação pequena. */}
      {reading.bothAway ? (
        <Panel className="p-5">
          <h2 className="text-base font-semibold text-ink">Retomar juntas</h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            Uma ação pequena de cada lado hoje já recomeça a contagem. Ninguém precisa recuperar o
            que passou.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              track('pair_return_started', 'juntos')
              navigate('/app')
            }}
          >
            Escolher minha ação de hoje
          </Button>
        </Panel>
      ) : null}

      <button
        type="button"
        onClick={() => setConfirmLeave(true)}
        className="self-start text-sm text-ink-faint underline-offset-2 hover:text-ink hover:underline"
      >
        Desfazer a dupla
      </button>

      <ConfirmDialog
        open={confirmLeave}
        title="Desfazer a dupla?"
        description={`A dupla acaba para as duas. ${partner?.name ?? 'A outra pessoa'} deixa de ver se você avançou, e você deixa de ver o dia dela. Seu progresso continua igual.`}
        confirmLabel="Desfazer"
        destructive
        onConfirm={() => void leave()}
        onClose={() => setConfirmLeave(false)}
      />
    </div>
  )
}

/** Uma linha da lista de privacidade: o que atravessa e o que não atravessa. */
function Item({ children, ok = false }: { readonly children: string; readonly ok?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon
        name={ok ? 'check' : 'fechar'}
        className={ok ? 'mt-0.5 size-4 shrink-0 text-positive' : 'mt-0.5 size-4 shrink-0 text-ink-faint'}
        strokeWidth={2}
      />
      <span className={ok ? 'text-ink' : 'text-ink-faint line-through decoration-line-hi'}>
        {children}
      </span>
    </li>
  )
}
