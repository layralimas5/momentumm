import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QUIZ_AREA_LABELS, isQuizArea } from '@/domain/entities/quiz'
import { formatPhone } from '@/domain/entities/quiz-lead'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { useAdmin } from '../admin-context'
import { ActionDialog } from '../components/ActionDialog'
import { AdminPage, Empty, QueryState, Section, StatusTag, formatDate } from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'

const EVENT_LABELS: Readonly<Record<string, string>> = {
  quiz_started: 'Abriu o quiz',
  quiz_step_viewed: 'Viu o passo',
  quiz_step_answered: 'Respondeu',
  quiz_contact_submitted: 'Deixou o contato',
  quiz_completed: 'Terminou o quiz',
  quiz_abandoned: 'Abandonou',
  quiz_diagnosis_viewed: 'Viu o diagnóstico',
  quiz_signup_clicked: 'Clicou pra criar conta',
  quiz_linked: 'Virou conta',
  quiz_activated: 'Ativou o plano',
}

/**
 * A ficha de um contato do quiz.
 *
 * A lista responde "com quem eu falo hoje". Esta tela responde "o que eu
 * digo pra essa pessoa": o que ela respondeu, o que ela viu como
 * diagnóstico e onde ela parou. É material de conversa, não relatório.
 */
export function AdminLeadDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const admin = useAdmin()
  const query = useAdminQuery(() => container.admin.quizLeadDetail(id), `lead:${id}`)
  const [removing, setRemoving] = useState(false)
  const lead = query.data

  return (
    <AdminPage
      title={lead?.name ?? 'Contato do quiz'}
      description="O que essa pessoa respondeu, o que ela viu e onde parou."
      action={
        <Link
          to="/admin/contatos"
          className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-ink-muted hover:bg-surface hover:text-ink"
        >
          Voltar pros contatos
        </Link>
      }
    >
      <QueryState loading={query.loading && !lead} error={query.error} onRetry={() => void query.reload()} />

      {lead ? (
        <>
          <Section
            title="Contato"
            hint="Tocar no e-mail abre o cliente de e-mail; no WhatsApp, a conversa."
            action={
              <div className="flex items-center gap-2">
                {lead.has_account ? (
                  <StatusTag tone="positive">Virou conta</StatusTag>
                ) : (
                  <StatusTag tone="warn">Sem conta</StatusTag>
                )}
                {admin.can('users.act') && lead.email ? (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>
                    Apagar
                  </Button>
                ) : null}
              </div>
            }
          >
            {lead.email === null ? (
              <Empty
                title="Contato esquecido"
                description="Os dados pessoais desta sessão foram apagados. A resposta continua contando no funil, sem dono."
              />
            ) : (
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Campo rotulo="Nome" valor={lead.name ?? '—'} />
                <Campo rotulo="Idade" valor={lead.age === null ? '—' : `${lead.age} anos`} />
                <Campo
                  rotulo="E-mail"
                  valor={
                    <a href={`mailto:${lead.email}`} className="text-brand-hi hover:underline">
                      {lead.email}
                    </a>
                  }
                />
                <Campo
                  rotulo="WhatsApp"
                  valor={
                    lead.phone === null ? (
                      '—'
                    ) : (
                      <a
                        href={`https://wa.me/55${lead.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-hi hover:underline"
                      >
                        {formatPhone(lead.phone)}
                      </a>
                    )
                  }
                />
                <Campo rotulo="Consentiu em" valor={formatDate(lead.consent_at, true)} />
                {lead.user_id ? (
                  <Campo
                    rotulo="Conta"
                    valor={
                      <Link to={`/admin/usuarios/${lead.user_id}`} className="text-brand-hi hover:underline">
                        Ver a conta
                      </Link>
                    }
                  />
                ) : null}
              </dl>
            )}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="O que respondeu" hint="Como veio do quiz, sem interpretação.">
              <Respostas answers={lead.answers} />
            </Section>

            <Section title="Diagnóstico que ela viu" hint="O plano que a tela montou no fim do quiz.">
              {Object.keys(lead.diagnosis).length === 0 ? (
                <Empty title="Sem diagnóstico" description="A pessoa saiu antes do fim do quiz." />
              ) : (
                <Respostas answers={lead.diagnosis} />
              )}
            </Section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="De onde veio" hint="Parâmetros da URL na entrada.">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Campo rotulo="Origem" valor={lead.source.utm_source ?? 'direto'} />
                <Campo rotulo="Mídia" valor={lead.source.utm_medium ?? '—'} />
                <Campo rotulo="Campanha" valor={lead.source.utm_campaign ?? '—'} />
                <Campo rotulo="Conteúdo" valor={lead.source.utm_content ?? '—'} />
                <Campo rotulo="Tema" valor={lead.theme ?? 'padrão'} />
                <Campo rotulo="Parou no passo" valor={String(lead.step)} />
              </dl>
            </Section>

            <Section title="Linha do tempo" hint="Cada evento que o navegador registrou nesta sessão.">
              {lead.timeline.length === 0 ? (
                <Empty title="Sem eventos" description="A sessão foi criada antes da medição do funil." />
              ) : (
                <ol className="flex flex-col gap-2">
                  {lead.timeline.map((evento, index) => (
                    <li
                      key={`${evento.name}-${index}`}
                      className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2 last:border-0"
                    >
                      <span className="text-sm text-ink">
                        {EVENT_LABELS[evento.name] ?? evento.name}
                        {evento.step === null ? null : (
                          <span className="ml-2 text-xs text-ink-faint">passo {evento.step}</span>
                        )}
                      </span>
                      <span className="tabular shrink-0 text-xs text-ink-faint">{formatDate(evento.at, true)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </div>

          <ActionDialog
            open={removing}
            title="Esquecer este contato"
            description="Nome, e-mail, telefone e idade saem do banco. A resposta do quiz continua contando no funil, sem dono."
            confirmLabel="Esquecer contato"
            destructive
            onConfirm={async (reason) => {
              await container.admin.deleteQuizLead(lead.id, reason)
              navigate('/admin/contatos', { replace: true })
            }}
            onClose={() => setRemoving(false)}
          />
        </>
      ) : null}
    </AdminPage>
  )
}

function Campo({ rotulo, valor }: { readonly rotulo: string; readonly valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-ink">{valor}</dd>
    </div>
  )
}

/**
 * As respostas do quiz em forma legível.
 *
 * O formato do `answers` acompanha o quiz e muda quando o quiz muda, então
 * a tela não assume chave nenhuma: ela mostra o que veio, traduzindo só as
 * áreas, que são as únicas com vocabulário próprio.
 */
function Respostas({ answers }: { readonly answers: Readonly<Record<string, unknown>> }) {
  const entradas = Object.entries(answers).filter(([, valor]) => valor !== null && valor !== '')

  if (entradas.length === 0) {
    return <Empty title="Nada respondido" description="A pessoa deixou o contato antes de responder." />
  }

  return (
    <dl className="flex flex-col gap-3">
      {entradas.map(([chave, valor]) => (
        <div key={chave}>
          <dt className="text-xs text-ink-faint">{chave}</dt>
          <dd className="mt-0.5 text-pretty text-sm text-ink">{comoTexto(valor)}</dd>
        </div>
      ))}
    </dl>
  )
}

function comoTexto(valor: unknown): string {
  if (Array.isArray(valor)) return valor.map(comoTexto).join(', ')
  if (typeof valor === 'string') return isQuizArea(valor) ? QUIZ_AREA_LABELS[valor] : valor
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  if (valor && typeof valor === 'object') {
    return Object.entries(valor as Record<string, unknown>)
      .map(([chave, item]) => `${chave}: ${comoTexto(item)}`)
      .join(' · ')
  }
  return '—'
}
