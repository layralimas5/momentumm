import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { publicQuizSchema, type PublicQuiz, type AdminQuizQuestion } from '@/domain/admin/admin-schemas'
import { readAttribution } from '@/domain/analytics/funnel-events'
import { formatPhone, isLeadReady, leadErrors, normalizeLead } from '@/domain/entities/quiz-lead'
import {
  saveCustomQuizAnswers,
  saveCustomQuizLead,
  startCustomQuiz,
  trackCustomQuiz,
} from '@/infrastructure/analytics/funnel'
import { supabase } from '@/infrastructure/supabase/client'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { Button } from '@/presentation/components/ui/Button'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'

type Resposta = string | readonly string[]

/**
 * Os funis criados no painel.
 *
 * Uma tela só pra todos eles: as perguntas vêm do banco, e é por isso que
 * criar um funil novo não precisa de deploy. O `/criar-meu-plano` continua
 * com tela própria, porque ele termina montando um plano de verdade e isso
 * é código, não configuração.
 */
export function CustomQuizPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sessao, setSessao] = useState('')
  const [passo, setPasso] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({})
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    let vivo = true
    void supabase()
      .rpc('quiz_public', { p_slug: slug })
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) {
          setErro('Esse questionário não está disponível.')
          return
        }
        const parsed = publicQuizSchema.safeParse(data)
        if (!parsed.success) {
          setErro('Esse questionário não está disponível.')
          return
        }
        setQuiz(parsed.data)
        setSessao(startCustomQuiz(slug, readAttribution(params)))
      })
    return () => {
      vivo = false
    }
  }, [slug])

  if (erro) {
    return (
      <Moldura>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Não achei esse questionário</h1>
        <p className="mt-2 text-sm text-ink-muted">
          O endereço pode ter mudado, ou ele saiu do ar.{' '}
          <Link to="/" className="text-brand-hi underline-offset-2 hover:underline">
            Voltar pro início
          </Link>
        </p>
      </Moldura>
    )
  }

  if (!quiz) {
    return (
      <Moldura>
        <div role="status" aria-live="polite" className="grid min-h-40 place-items-center">
          <span className="sr-only">Carregando</span>
          <span aria-hidden="true" className="size-6 animate-spin rounded-full border-2 border-line-hi border-t-brand" />
        </div>
      </Moldura>
    )
  }

  if (pronto) {
    return (
      <Moldura>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Recebi, obrigada.</h1>
        <p className="mt-2 text-pretty text-sm text-ink-muted">
          {quiz.outro ?? 'Vou olhar suas respostas e te chamo em breve.'}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex text-sm text-brand-hi underline-offset-2 hover:underline"
        >
          Conhecer o Momentumm
        </Link>
      </Moldura>
    )
  }

  const total = quiz.questions.length
  const naContato = passo >= total

  return (
    <Moldura>
      <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">
        {naContato ? 'Último passo' : `Pergunta ${passo + 1} de ${total}`}
      </p>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total + 1}
        aria-valuenow={passo + 1}
        aria-label="Progresso"
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-hi"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${((passo + 1) / (total + 1)) * 100}%` }}
        />
      </div>

      {passo === 0 && quiz.headline ? (
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">{quiz.headline}</h1>
      ) : null}
      {passo === 0 && quiz.subheadline ? (
        <p className="mt-1 text-pretty text-sm text-ink-muted">{quiz.subheadline}</p>
      ) : null}

      {naContato ? (
        <PassoContato
          quiz={quiz}
          sessao={sessao}
          respostas={respostas}
          onVoltar={() => setPasso(total - 1)}
          onPronto={() => setPronto(true)}
        />
      ) : (
        <PassoPergunta
          key={quiz.questions[passo]?.key ?? passo}
          pergunta={quiz.questions[passo] as AdminQuizQuestion}
          valor={respostas[quiz.questions[passo]?.key ?? ''] ?? (quiz.questions[passo]?.kind === 'multipla' ? [] : '')}
          primeiro={passo === 0}
          onVoltar={() => setPasso((p) => Math.max(0, p - 1))}
          onResponder={(valor) => {
            const chave = quiz.questions[passo]?.key
            if (!chave) return
            const proximas = { ...respostas, [chave]: valor }
            setRespostas(proximas)
            saveCustomQuizAnswers(sessao, proximas, passo + 1)
            trackCustomQuiz(sessao, 'quiz_question_answered', passo + 1)
            setPasso((p) => p + 1)
          }}
        />
      )}
    </Moldura>
  )
}

function Moldura({ children }: { readonly children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <Wordmark className="mx-auto mb-8 w-32 sm:w-36" />
      {children}
    </main>
  )
}

function PassoPergunta({
  pergunta,
  valor,
  primeiro,
  onResponder,
  onVoltar,
}: {
  readonly pergunta: AdminQuizQuestion
  readonly valor: Resposta
  readonly primeiro: boolean
  readonly onResponder: (valor: Resposta) => void
  readonly onVoltar: () => void
}) {
  const [atual, setAtual] = useState<Resposta>(valor)
  const vazio = Array.isArray(atual) ? atual.length === 0 : String(atual).trim() === ''

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-pretty text-ink">{pergunta.title}</h2>
      {pergunta.hint ? <p className="mt-1 text-sm text-ink-muted">{pergunta.hint}</p> : null}

      <div className="mt-5 flex flex-col gap-2">
        {pergunta.kind === 'texto' ? (
          <TextInput
            value={String(atual)}
            autoFocus
            aria-label={pergunta.title}
            onChange={(event) => setAtual(event.target.value)}
          />
        ) : null}

        {pergunta.kind === 'escala'
          ? [1, 2, 3, 4, 5].map((nota) => (
              <Opcao
                key={nota}
                marcada={String(atual) === String(nota)}
                onClick={() => onResponder(String(nota))}
              >
                {nota}
              </Opcao>
            ))
          : null}

        {pergunta.kind === 'unica'
          ? pergunta.options.map((opcao) => (
              <Opcao
                key={opcao.value}
                marcada={atual === opcao.value}
                onClick={() => onResponder(opcao.value)}
              >
                {opcao.label}
              </Opcao>
            ))
          : null}

        {pergunta.kind === 'multipla'
          ? pergunta.options.map((opcao) => {
              const marcadas = Array.isArray(atual) ? atual : []
              const marcada = marcadas.includes(opcao.value)
              return (
                <Opcao
                  key={opcao.value}
                  marcada={marcada}
                  onClick={() =>
                    setAtual(
                      marcada ? marcadas.filter((item) => item !== opcao.value) : [...marcadas, opcao.value],
                    )
                  }
                >
                  {opcao.label}
                </Opcao>
              )
            })
          : null}
      </div>

      <div className="mt-6 flex items-center gap-2">
        {pergunta.kind === 'unica' ? null : (
          <Button
            size="lg"
            disabled={pergunta.required && vazio}
            onClick={() => onResponder(atual)}
          >
            Continuar
          </Button>
        )}
        {primeiro ? null : (
          <Button size="lg" variant="ghost" onClick={onVoltar}>
            Voltar
          </Button>
        )}
      </div>
    </div>
  )
}

function Opcao({
  marcada,
  onClick,
  children,
}: {
  readonly marcada: boolean
  readonly onClick: () => void
  readonly children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={marcada}
      onClick={onClick}
      className={[
        'min-h-12 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
        marcada
          ? 'border-brand/50 bg-brand-dim/40 text-brand-ink'
          : 'border-line bg-surface text-ink hover:border-line-hi hover:bg-surface-hi',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function PassoContato({
  quiz,
  sessao,
  respostas,
  onVoltar,
  onPronto,
}: {
  readonly quiz: PublicQuiz
  readonly sessao: string
  readonly respostas: Record<string, Resposta>
  readonly onVoltar: () => void
  readonly onPronto: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const bruto = { name, email, phone }
  const erros = useMemo(() => leadErrors(bruto), [name, email, phone])
  const completo = isLeadReady(bruto)

  const enviar = useAsyncAction(async () => {
    saveCustomQuizAnswers(sessao, respostas, quiz.questions.length)
    const salvo = await saveCustomQuizLead(sessao, normalizeLead(bruto))
    if (!salvo) throw new Error('Não consegui enviar agora. Tenta de novo em instantes.')
    trackCustomQuiz(sessao, 'lead_captured', quiz.questions.length)
    trackCustomQuiz(sessao, 'quiz_completed', quiz.questions.length)
    onPronto()
  })

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void enviar.run()
      }}
    >
      <h2 className="text-xl font-semibold text-ink">Pra onde eu mando a resposta?</h2>

      {enviar.error ? <ErrorNote message={enviar.error} /> : null}

      <Field label="Nome" error={erros.name}>
        {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />}
      </Field>
      <Field label="E-mail" error={erros.email}>
        {(id) => (
          <TextInput id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        )}
      </Field>
      <Field label="WhatsApp" hint="Opcional, mas é por onde eu respondo mais rápido.">
        {(id) => (
          <TextInput
            id={id}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value.replace(/\D/g, '')) || e.target.value)}
            autoComplete="tel"
          />
        )}
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" size="lg" loading={enviar.running} disabled={!completo}>
          {quiz.cta_label ?? 'Enviar'}
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={onVoltar}>
          Voltar
        </Button>
      </div>

      <p className="text-xs text-ink-faint">
        Ao enviar, você concorda com a{' '}
        <Link to="/privacidade" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          Política de privacidade
        </Link>
        .
      </p>
    </form>
  )
}
