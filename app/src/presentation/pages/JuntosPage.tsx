import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  alreadySent,
  ENCOURAGEMENTS,
  encouragementSpec,
  PAIR_DAYS,
  sentTodayCount,
} from '@/domain/entities/pair'
import { isPro, type PlanLimits } from '@/domain/entities/plan'
import { track } from '@/infrastructure/analytics/track'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { InvitePanel } from '@/presentation/juntos/InvitePanel'
import { PairStrip } from '@/presentation/juntos/PairStrip'
import { usePairs, type PairView, type PairsController } from '@/presentation/juntos/use-pairs'
import { useFeature } from '@/presentation/plan/use-feature'
import { usePlanner } from '@/presentation/planner/use-planner'
import type { DayKey } from '@/domain/entities/day'
import { PageHeader } from './PageHeader'

/**
 * Juntos — as duplas.
 *
 * Cada dupla responde três perguntas, nessa ordem: como estamos hoje, o que
 * aconteceu nos últimos dias e o que eu posso mandar. Não existe quarta
 * pergunta — nem feed, nem histórico longo, nem perfil da outra pessoa.
 *
 * O que a tela mostra sobre a outra pessoa é exatamente o que o servidor
 * devolve: nome curto, avatar e sete booleanos. Não há aqui nenhuma chamada
 * capaz de trazer mais do que isso.
 *
 * ## Uma tela, dois planos
 *
 * O gratuito tem UMA dupla e o PRO tem quantas quiser, e isso não são duas
 * telas: é a mesma lista, com um item ou com vários. O que muda é o convite
 * (oferecido enquanto `room` for verdadeiro) e a profundidade do que cada card
 * mostra. Duplicar a tela por plano é como as duas versões começam a divergir.
 */
export function JuntosPage() {
  /*
    A flag decide se a rota existe pra esta conta.

    Ela é lida aqui, e não no roteador: a resposta vem do servidor e demora
    um instante, e uma rota que aparece depois faria a tela piscar entre "não
    existe" e "existe" a cada carga.
  */
  const juntos = useFeature('juntos')
  const pairs = usePairs()
  const planner = usePlanner()

  const limits = planner.limits
  const pro = isPro(limits.tier)

  if (juntos.loading || pairs.loading) {
    return <LoadingBlock label="Carregando suas duplas" />
  }
  if (!juntos.enabled) return <Navigate to="/app" replace />

  const vazio = pairs.views.length === 0

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="Juntos"
        description={
          vazio
            ? 'Uma pessoa acompanhando o seu ritmo, e você o dela.'
            : descricaoDe(pairs.views)
        }
      />

      {pairs.error ? <ErrorNote message={pairs.error} /> : null}

      {/*
        O convite vem antes das duplas quando não existe nenhuma, e depois
        quando já existe: quem ainda não tem dupla está ali pra criar uma, e
        quem já tem está ali pra ver a dela.
      */}
      {vazio && pairs.room ? <InvitePanel /> : null}

      {pairs.views.map((view) => (
        <PairCard
          key={view.pair.id}
          view={view}
          limits={limits}
          today={planner.today}
          controller={pairs}
        />
      ))}

      {!vazio && pairs.room ? <InvitePanel /> : null}

      {/*
        Sem vaga, a tela diz por quê em vez de simplesmente não ter botão.
        Recurso que desaparece sem explicação parece defeito.
      */}
      {!pairs.room ? (
        <UpgradeHint
          message={
            pairs.max === 1
              ? 'O plano gratuito mantém uma dupla por vez. No PRO você mantém quantas quiser.'
              : `O teu plano mantém ${pairs.max} duplas por vez. No PRO não tem teto.`
          }
        />
      ) : null}

      {vazio ? <PrivacyPanel /> : null}

      {vazio && !pro ? (
        <UpgradeHint
          message={`No gratuito a dupla mostra hoje e os últimos ${limits.pairDays} dias, com ${limits.pairEncouragementsPerDay} incentivo por dia. O PRO abre a semana inteira e os três gestos.`}
        />
      ) : null}
    </div>
  )
}

/** "Você e a Carol" com uma dupla; a contagem quando são várias. */
function descricaoDe(views: readonly PairView[]): string {
  if (views.length === 1) {
    const partner = views[0]?.pair.members.find((member) => !member.isMe)
    return partner ? `Você e ${partner.name}, em movimento.` : 'Sua dupla de accountability.'
  }
  return `${views.length} duplas acompanhando o teu ritmo.`
}

/**
 * Uma dupla.
 *
 * Era o corpo da página quando só existia uma. Virar componente é o que faz a
 * segunda dupla não precisar de nenhuma linha nova: o estado de "confirmar a
 * saída" passou a ser de cada card, e não da tela, senão desfazer uma dupla
 * abriria o diálogo de todas.
 */
function PairCard({
  view,
  limits,
  today,
  controller,
}: {
  readonly view: PairView
  readonly limits: PlanLimits
  readonly today: DayKey
  readonly controller: PairsController
}) {
  const { pair, reading } = view
  const { user } = useAuth()
  const navigate = useNavigate()
  const [confirmLeave, setConfirmLeave] = useState(false)

  const partner = pair.members.find((member) => !member.isMe)
  const me = pair.members.find((member) => member.isMe)
  const pro = isPro(limits.tier)

  /*
    O teto de incentivos do dia, por dupla.

    O servidor aplica o mesmo número (migration 0053): aqui ele existe pra o
    botão dizer a verdade antes do clique, não pra ser a única barreira.
  */
  const usedToday = user ? sentTodayCount(pair, user.id, today) : 0
  const quotaReached = usedToday >= limits.pairEncouragementsPerDay

  return (
    <section className="flex flex-col gap-4">
      {/* Como estamos hoje. É a primeira dobra porque é a única coisa que muda. */}
      <Panel tone="brand" className="p-5">
        <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">
          {partner ? partner.name : 'Hoje'}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-balance text-ink">
          {reading.headline}
        </h2>
        <p className="mt-1.5 text-sm text-pretty text-ink-muted">{reading.note}</p>

        <div className="mt-4 flex flex-col gap-2">
          {me ? (
            <PairStrip member={me} today={today} maxDays={limits.pairDays} highlight />
          ) : null}
          {partner ? (
            <PairStrip member={partner} today={today} maxDays={limits.pairDays} />
          ) : null}
        </div>

        {pair.daysTogether > 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-faint">
            <Icon name="fogo" className="size-4 text-brand-hi" />
            {pair.daysTogether}{' '}
            {pair.daysTogether === 1 ? 'dia em movimento juntas' : 'dias em movimento juntas'}
          </p>
        ) : null}

        {/*
          A faixa cortada não finge estar inteira.

          Sem essa linha o gratuito veria três pontos e concluiria que a dupla
          só guarda três dias — o limite viraria defeito do produto.
        */}
        {limits.pairDays < PAIR_DAYS ? (
          <UpgradeHint
            className="mt-3"
            message={`Você está vendo os últimos ${limits.pairDays} dias. A semana inteira faz parte do PRO.`}
          />
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
            : pro
              ? 'Um por dia de cada tipo. Sem texto: só o gesto.'
              : 'Um incentivo por dia no gratuito. Sem texto: só o gesto.'}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {ENCOURAGEMENTS.map((spec) => {
            const sent = user ? alreadySent(pair, user.id, spec.kind, today) : false
            const suggested = spec.kind === reading.suggested
            /*
              A vaga do dia já foi gasta em outro gesto.

              Quem já mandou continua vendo "enviado" no botão dele — o que
              fecha é o resto. O gratuito escolhe QUAL dos três manda, e essa
              escolha é o que sobra de agência dentro do limite.
            */
            const outOfQuota = !sent && quotaReached
            const busy =
              controller.sending?.pairId === pair.id && controller.sending.kind === spec.kind

            return (
              <Button
                key={spec.kind}
                variant={suggested && !sent && !outOfQuota ? 'primary' : 'secondary'}
                loading={busy}
                disabled={sent || outOfQuota}
                onClick={() => void controller.send(pair.id, spec.kind)}
                title={outOfQuota ? 'O incentivo de hoje já foi enviado.' : spec.hint}
              >
                <span aria-hidden="true">{spec.emoji}</span>
                {sent ? `${spec.label} · enviado` : spec.label}
              </Button>
            )
          })}
        </div>

        {quotaReached && !pro ? (
          <UpgradeHint
            className="mt-3"
            message={`Hoje você já mandou o teu incentivo nessa dupla. Os ${ENCOURAGEMENTS.length} gestos, todo dia, fazem parte do PRO.`}
          />
        ) : null}
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
        {partner ? `Desfazer a dupla com ${partner.name}` : 'Desfazer a dupla'}
      </button>

      <ConfirmDialog
        open={confirmLeave}
        title="Desfazer a dupla?"
        description={`A dupla acaba para as duas. ${partner?.name ?? 'A outra pessoa'} deixa de ver se você avançou, e você deixa de ver o dia dela. Seu progresso continua igual.`}
        confirmLabel="Desfazer"
        destructive
        onConfirm={() => void controller.leave(pair.id)}
        onClose={() => setConfirmLeave(false)}
      />
    </section>
  )
}

/** O contrato de privacidade, em voz alta, antes de existir dupla. */
function PrivacyPanel() {
  return (
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
