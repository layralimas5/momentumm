import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AdminQuiz, AdminQuizQuestion } from '@/domain/admin/admin-schemas'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { useAdmin } from '../admin-context'
import { ActionDialog } from '../components/ActionDialog'
import { AdminPage, Empty, QueryState, Section, StatusTag, formatDate } from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'

const KIND_LABELS: Readonly<Record<AdminQuizQuestion['kind'], string>> = {
  unica: 'Escolha uma',
  multipla: 'Escolhe várias',
  texto: 'Escreve a resposta',
  escala: 'Nota de 1 a 5',
}

const PURPOSE_HINTS = {
  contato: 'Termina numa mensagem e no contato. Não exige conta nem gera plano.',
  plano: 'Termina virando plano no app. Exige que a pessoa crie conta.',
} as const

/** Uma pergunta em branco, pronta pra escrever. */
function perguntaNova(indice: number): AdminQuizQuestion {
  return {
    key: `pergunta_${indice}`,
    kind: 'unica',
    title: '',
    hint: null,
    required: true,
    options: [
      { value: 'opcao_1', label: '' },
      { value: 'opcao_2', label: '' },
    ],
  }
}

/**
 * Os funis de entrada.
 *
 * Cada funil é um quiz com perguntas próprias numa URL própria. O original
 * (`/criar-meu-plano`) aparece aqui pra comparação, mas não se edita: as
 * perguntas dele vivem no código, junto do diagnóstico que monta o plano.
 */
export function AdminQuizzesPage() {
  const admin = useAdmin()
  const query = useAdminQuery(() => container.admin.listQuizzes(), 'quizzes')
  const [editing, setEditing] = useState<AdminQuiz | 'novo' | null>(null)
  const podeEditar = admin.can('settings.write') || admin.role === 'admin'

  return (
    <AdminPage
      title="Funis de quiz"
      description="Cada funil é um quiz com perguntas próprias, numa URL própria. Publicar põe no ar; o que estiver em rascunho ninguém alcança."
      action={
        podeEditar ? <Button size="sm" onClick={() => setEditing('novo')}>Criar funil</Button> : undefined
      }
    >
      <QueryState loading={query.loading && !query.data} error={query.error} onRetry={() => void query.reload()} />

      {query.data?.length === 0 ? (
        <Empty title="Nenhum funil ainda" description="Cria o primeiro e ele nasce medido, com os contatos caindo na mesma lista." />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {(query.data ?? []).map((quiz) => (
          <QuizCard
            key={quiz.id}
            quiz={quiz}
            podeEditar={podeEditar}
            onEdit={() => setEditing(quiz)}
            onChanged={() => void query.reload()}
          />
        ))}
      </div>

      {editing ? (
        <QuizEditor
          quiz={editing === 'novo' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void query.reload() }}
        />
      ) : null}
    </AdminPage>
  )
}

function QuizCard({
  quiz,
  podeEditar,
  onEdit,
  onChanged,
}: {
  readonly quiz: AdminQuiz
  readonly podeEditar: boolean
  readonly onEdit: () => void
  readonly onChanged: () => void
}) {
  const [alvo, setAlvo] = useState<'rascunho' | 'publicado' | 'arquivado' | null>(null)
  const url = quiz.built_in ? '/criar-meu-plano' : `/quiz/${quiz.slug}`
  const conversao = quiz.sessions === 0 ? null : Math.round((quiz.leads / quiz.sessions) * 100)

  return (
    <Section
      title={quiz.name}
      hint={`momentumm.com.br${url}`}
      action={
        <div className="flex items-center gap-2">
          {quiz.state === 'publicado' ? <StatusTag tone="positive">No ar</StatusTag> : null}
          {quiz.state === 'rascunho' ? <StatusTag tone="warn">Rascunho</StatusTag> : null}
          {quiz.state === 'arquivado' ? <StatusTag>Arquivado</StatusTag> : null}
          {quiz.built_in ? <StatusTag>Original</StatusTag> : null}
        </div>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-ink">
        <span>
          <strong className="tabular">{quiz.sessions.toLocaleString('pt-BR')}</strong>{' '}
          <span className="text-ink-faint">entraram</span>
        </span>
        <span>
          <strong className="tabular">{quiz.leads.toLocaleString('pt-BR')}</strong>{' '}
          <span className="text-ink-faint">deixaram contato</span>
        </span>
        {conversao === null ? null : (
          <span className="text-ink-muted">
            <strong className="tabular">{conversao}%</strong> de conversão
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-ink-faint">
        {quiz.purpose === 'plano' ? PURPOSE_HINTS.plano : PURPOSE_HINTS.contato}
        {quiz.built_in ? null : ` · ${quiz.questions.length} pergunta(s)`}
        {' · atualizado em '}
        {formatDate(quiz.updated_at)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to={`/admin/funil?quiz=${quiz.slug}`}
          className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-ink-muted hover:bg-surface hover:text-ink"
        >
          Ver o funil
        </Link>
        {quiz.built_in ? null : (
          <>
            {podeEditar ? (
              <Button size="sm" variant="secondary" onClick={onEdit}>Editar</Button>
            ) : null}
            {podeEditar && quiz.state !== 'publicado' ? (
              <Button size="sm" onClick={() => setAlvo('publicado')}>Publicar</Button>
            ) : null}
            {podeEditar && quiz.state === 'publicado' ? (
              <Button size="sm" variant="ghost" onClick={() => setAlvo('rascunho')}>Tirar do ar</Button>
            ) : null}
          </>
        )}
      </div>

      <ActionDialog
        open={alvo !== null}
        title={alvo === 'publicado' ? 'Publicar o funil' : 'Tirar o funil do ar'}
        description={
          alvo === 'publicado'
            ? `A partir de agora momentumm.com.br${url} responde pra qualquer pessoa.`
            : 'A URL para de responder. Os contatos que já entraram continuam na lista.'
        }
        confirmLabel={alvo === 'publicado' ? 'Publicar' : 'Tirar do ar'}
        destructive={alvo !== 'publicado'}
        onConfirm={async (reason) => {
          if (!alvo) return
          await container.admin.setQuizState(quiz.slug, alvo, reason)
          onChanged()
        }}
        onClose={() => setAlvo(null)}
      />
    </Section>
  )
}

function QuizEditor({
  quiz,
  onClose,
  onSaved,
}: {
  readonly quiz: AdminQuiz | null
  readonly onClose: () => void
  readonly onSaved: () => void
}) {
  const [slug, setSlug] = useState(quiz?.slug ?? '')
  const [name, setName] = useState(quiz?.name ?? '')
  const [purpose, setPurpose] = useState<'plano' | 'contato'>(quiz?.purpose ?? 'contato')
  const [headline, setHeadline] = useState(quiz?.headline ?? '')
  const [subheadline, setSubheadline] = useState(quiz?.subheadline ?? '')
  const [outro, setOutro] = useState(quiz?.outro ?? '')
  const [questions, setQuestions] = useState<AdminQuizQuestion[]>(
    quiz?.questions.length ? [...quiz.questions] : [perguntaNova(1)],
  )
  const [confirm, setConfirm] = useState(false)

  const trocar = (indice: number, mudanca: Partial<AdminQuizQuestion>) => {
    setQuestions((atual) => atual.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)))
  }

  const slugValido = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)
  const problema =
    !slugValido
      ? 'O endereço precisa ter ao menos 3 letras minúsculas, números ou hífen.'
      : name.trim().length < 2
        ? 'Dá um nome ao funil.'
        : questions.length === 0
          ? 'Um funil precisa de pelo menos uma pergunta.'
          : questions.some((q) => q.title.trim().length < 3)
            ? 'Toda pergunta precisa de um enunciado.'
            : questions.some((q) => (q.kind === 'unica' || q.kind === 'multipla') && q.options.filter((o) => o.label.trim()).length < 2)
              ? 'Pergunta de escolha precisa de pelo menos duas opções escritas.'
              : null

  return (
    <Section
      title={quiz ? `Editando ${quiz.name}` : 'Novo funil'}
      hint="A pessoa responde na ordem em que as perguntas aparecem aqui."
      action={<Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do funil" hint="Só pra você, no painel.">
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Endereço" hint={`momentumm.com.br/quiz/${slug || '...'}`}>
          {(id) => (
            <TextInput
              id={id}
              value={slug}
              disabled={quiz !== null}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            />
          )}
        </Field>
        <Field label="O que ele faz" hint={PURPOSE_HINTS[purpose]}>
          {(id) => (
            <Select id={id} value={purpose} onChange={(e) => setPurpose(e.target.value as 'plano' | 'contato')}>
              <option value="contato">Captar contato</option>
              <option value="plano">Gerar plano no app</option>
            </Select>
          )}
        </Field>
        <Field label="Título da abertura" hint="Vazio usa o texto padrão.">
          {(id) => <TextInput id={id} value={headline} onChange={(e) => setHeadline(e.target.value)} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Subtítulo da abertura">
            {(id) => <TextInput id={id} value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />}
          </Field>
        </div>
        {purpose === 'contato' ? (
          <div className="sm:col-span-2">
            <Field label="Mensagem do fim" hint="O que a pessoa lê depois de deixar o contato.">
              {(id) => <TextInput id={id} value={outro} onChange={(e) => setOutro(e.target.value)} />}
            </Field>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {questions.map((pergunta, indice) => (
          <div key={indice} className="rounded-card border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-ink-faint">Pergunta {indice + 1}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={indice === 0}
                  onClick={() => setQuestions((a) => {
                    const copia = [...a]
                    const anterior = copia[indice - 1]
                    const atual = copia[indice]
                    if (!anterior || !atual) return a
                    copia[indice - 1] = atual
                    copia[indice] = anterior
                    return copia
                  })}
                >
                  Subir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setQuestions((a) => a.filter((_, i) => i !== indice))}
                >
                  Remover
                </Button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="O que você pergunta">
                  {(id) => (
                    <TextInput
                      id={id}
                      value={pergunta.title}
                      onChange={(e) => trocar(indice, { title: e.target.value })}
                    />
                  )}
                </Field>
              </div>
              <Field label="Tipo de resposta">
                {(id) => (
                  <Select
                    id={id}
                    value={pergunta.kind}
                    onChange={(e) => trocar(indice, { kind: e.target.value as AdminQuizQuestion['kind'] })}
                  >
                    {Object.entries(KIND_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Chave da resposta" hint="Como ela aparece na ficha do contato.">
                {(id) => (
                  <TextInput
                    id={id}
                    value={pergunta.key}
                    onChange={(e) => trocar(indice, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                  />
                )}
              </Field>
            </div>

            {pergunta.kind === 'unica' || pergunta.kind === 'multipla' ? (
              <div className="mt-3 flex flex-col gap-2">
                {pergunta.options.map((opcao, indiceOpcao) => (
                  <div key={indiceOpcao} className="flex items-center gap-2">
                    <TextInput
                      value={opcao.label}
                      placeholder={`Opção ${indiceOpcao + 1}`}
                      aria-label={`Opção ${indiceOpcao + 1} da pergunta ${indice + 1}`}
                      onChange={(e) => trocar(indice, {
                        options: pergunta.options.map((o, i) =>
                          i === indiceOpcao
                            ? { value: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30) || `opcao_${i + 1}`, label: e.target.value }
                            : o,
                        ),
                      })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => trocar(indice, { options: pergunta.options.filter((_, i) => i !== indiceOpcao) })}
                    >
                      Tirar
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => trocar(indice, {
                      options: [...pergunta.options, { value: `opcao_${pergunta.options.length + 1}`, label: '' }],
                    })}
                  >
                    Mais uma opção
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}

        <div>
          <Button variant="secondary" onClick={() => setQuestions((a) => [...a, perguntaNova(a.length + 1)])}>
            Mais uma pergunta
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="mt-4 min-h-5 text-sm">
        {problema ? <span className="text-danger">{problema}</span> : <span className="text-positive">Pronto pra salvar.</span>}
      </div>

      <div className="mt-2 flex gap-2">
        <Button disabled={problema !== null} onClick={() => setConfirm(true)}>Salvar funil</Button>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>

      <ActionDialog
        open={confirm}
        title={quiz ? 'Salvar as mudanças' : 'Criar o funil'}
        description={
          quiz
            ? 'As perguntas são substituídas pelas que estão na tela. Quem já respondeu mantém o que respondeu.'
            : 'O funil nasce em rascunho. Publicar é um passo separado.'
        }
        confirmLabel="Salvar"
        onConfirm={async (reason) => {
          await container.admin.saveQuiz({
            slug,
            name: name.trim(),
            purpose,
            questions: questions.map((q) => ({
              ...q,
              title: q.title.trim(),
              options: q.kind === 'unica' || q.kind === 'multipla' ? q.options.filter((o) => o.label.trim()) : [],
            })),
            reason,
            headline: headline.trim() || undefined,
            subheadline: subheadline.trim() || undefined,
            outro: outro.trim() || undefined,
          })
          onSaved()
        }}
        onClose={() => setConfirm(false)}
      />
    </Section>
  )
}
