import { useCallback, useEffect, useState } from 'react'
import type { MfaEnrollment, MfaFactor } from '@/domain/auth/auth-service'
import { MIN_PASSWORD_LENGTH } from '@/domain/auth/password'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader, Tag } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'

/**
 * Segurança da conta.
 *
 * Quatro coisas que a pessoa precisa conseguir fazer sozinha, sem abrir
 * suporte: trocar a senha, ligar o segundo fator, derrubar as sessões dos
 * outros dispositivos e apagar a conta.
 *
 * As três primeiras são o que transforma "fui invadida" em "resolvi". A
 * quarta é o que faz o produto respeitar quem quer sair — e ela apaga de
 * verdade, incluindo os arquivos.
 */
export function SecurityPanel() {
  const auth = useAuth()
  const [factors, setFactors] = useState<readonly MfaFactor[]>([])

  const load = useCallback(async () => {
    setFactors(await auth.listMfaFactors())
  }, [auth])

  useEffect(() => {
    void load()
  }, [load])

  // Modo demo não tem servidor de identidade: em vez de mostrar botões que
  // sempre falham, o painel diz o que está faltando.
  if (container.demo) {
    return (
      <div className="flex flex-col gap-5">
        <Panel>
          <PanelHeader title="Segurança da conta" icon="cadeado" />
          <p className="mt-4 text-sm text-ink-muted">
            No modo demo não existe conta de verdade: senha, verificação em duas etapas e sessões
            só aparecem com o Supabase configurado.
          </p>
        </Panel>
        <ExportBlock />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PasswordBlock />
      <MfaBlock factors={factors} onChanged={load} />
      <SessionsBlock />
      <ExportBlock />
      <DangerBlock />
    </div>
  )
}

/**
 * Os dados da conta, num JSON só.
 *
 * A montagem é do servidor (`export_my_data`, com a RLS de quem pede) e o
 * arquivo nasce no aparelho: nada passa por terceiro nem fica guardado em
 * lugar nenhum. O botão gera e baixa na hora, sem link permanente.
 */
function ExportBlock() {
  const [done, setDone] = useState(false)

  const download = useAsyncAction(async () => {
    const data = await container.profiles.exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `momentumm-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setDone(true)
  })

  return (
    <Panel>
      <PanelHeader
        title="Exportar meus dados"
        icon="arquivar"
        hint="Objetivos, planos, hábitos, ações, registros, reviews, momentos e a lista dos teus arquivos, em JSON. Só o que é teu: o que você vê de amigos fica com eles."
      />

      <Button className="mt-4" variant="secondary" loading={download.running} onClick={() => void download.run()}>
        <Icon name="arquivar" className="size-4" />
        Baixar arquivo
      </Button>

      <div aria-live="polite" className="min-h-5">
        {download.error ? <p className="mt-1 text-sm text-danger">{download.error}</p> : null}
        {done && !download.error ? (
          <p className="mt-1 text-sm text-ink-muted">Arquivo gerado. Ele fica só no teu aparelho.</p>
        ) : null}
      </div>
    </Panel>
  )
}

function PasswordBlock() {
  const { updatePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [done, setDone] = useState(false)

  const save = useAsyncAction(async () => {
    await updatePassword(current, next)
    setCurrent('')
    setNext('')
    setDone(true)
  })

  return (
    <Panel>
      <PanelHeader
        title="Senha"
        icon="cadeado"
        hint="Trocar a senha encerra as sessões dos outros dispositivos."
      />

      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          setDone(false)
          void save.run()
        }}
      >
        {/* A senha atual é pedida de propósito: sessão aberta num
            computador emprestado não pode virar conta perdida. */}
        <Field label="Senha atual">
          {(id) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              required
            />
          )}
        </Field>

        <Field label="Senha nova" hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              type="password"
              aria-describedby={describedBy}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={next}
              onChange={(event) => setNext(event.target.value)}
              required
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={save.running}>
            Trocar a senha
          </Button>
          {done ? <span className="text-sm text-positive">Senha atualizada.</span> : null}
        </div>

        <div aria-live="polite" className="min-h-5">
          {save.error ? <p className="text-sm text-danger">{save.error}</p> : null}
        </div>
      </form>
    </Panel>
  )
}

function MfaBlock({
  factors,
  onChanged,
}: {
  readonly factors: readonly MfaFactor[]
  readonly onChanged: () => Promise<void>
}) {
  const auth = useAuth()
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [code, setCode] = useState('')

  const active = factors.filter((factor) => factor.verified)

  const start = useAsyncAction(async () => {
    setEnrollment(await auth.startMfaEnrollment())
  })

  const confirm = useAsyncAction(async (factorId: string) => {
    await auth.confirmMfaEnrollment(factorId, code)
    setEnrollment(null)
    setCode('')
    await onChanged()
  })

  const remove = useAsyncAction(async (factorId: string) => {
    await auth.removeMfaFactor(factorId)
    await onChanged()
  })

  return (
    <Panel>
      <PanelHeader
        title="Verificação em duas etapas"
        icon="cadeado"
        hint="Um código de seis dígitos no app autenticador, além da senha."
        action={active.length > 0 ? <Tag tone="positive">Ativa</Tag> : undefined}
      />

      {/*
        A obrigatoriedade pra admin não é decidida aqui.

        Quem exige o segundo fator é o banco: `is_admin()` só responde
        verdadeiro em sessão aal2, e `assert_admin()` recusa o resto. Esta
        tela apenas conta isso — se a regra morasse no componente, bastaria
        chamar a API direto pra contorná-la.
      */}
      {auth.session?.isAdmin === false && active.length === 0 ? (
        <p className="mt-3 rounded-xl border border-flame/30 bg-flame-dim/30 px-3.5 py-3 text-sm text-ink">
          Contas com acesso administrativo só operam com a verificação ligada. Sem ela, o banco
          recusa qualquer ação crítica.
        </p>
      ) : null}

      {active.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {active.map((factor) => (
            <li
              key={factor.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-hi/40 px-3.5 py-2.5"
            >
              <span className="text-sm text-ink">{factor.friendlyName}</span>
              <Button
                size="sm"
                variant="danger"
                loading={remove.running}
                onClick={() => void remove.run(factor.id)}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {enrollment ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Escaneia o código no teu app autenticador e digita os seis dígitos que ele mostrar.
          </p>

          <div
            className="w-fit rounded-xl bg-white p-3"
            // O SVG vem do próprio GoTrue, não de conteúdo de usuário.
            dangerouslySetInnerHTML={{ __html: enrollment.qrCodeSvg }}
          />

          <p className="text-xs break-all text-ink-faint">
            Sem câmera? Digita a chave: <code className="text-ink">{enrollment.secret}</code>
          </p>

          <Field label="Código de seis dígitos">
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            )}
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button
              loading={confirm.running}
              onClick={() => void confirm.run(enrollment.factorId)}
            >
              Ativar
            </Button>
            <Button variant="ghost" onClick={() => setEnrollment(null)}>
              Cancelar
            </Button>
          </div>

          <div aria-live="polite" className="min-h-5">
            {confirm.error ? <p className="text-sm text-danger">{confirm.error}</p> : null}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button variant="secondary" loading={start.running} onClick={() => void start.run()}>
            <Icon name="cadeado" className="size-4" />
            {active.length > 0 ? 'Adicionar outro app' : 'Ativar verificação'}
          </Button>

          <div aria-live="polite" className="min-h-5">
            {start.error ? <p className="mt-1 text-sm text-danger">{start.error}</p> : null}
            {remove.error ? <p className="mt-1 text-sm text-danger">{remove.error}</p> : null}
          </div>
        </div>
      )}
    </Panel>
  )
}

function SessionsBlock() {
  const { signOut } = useAuth()
  const [confirming, setConfirming] = useState(false)

  const revoke = useAsyncAction(async () => {
    await signOut(true)
  })

  return (
    <Panel>
      <PanelHeader
        title="Sessões"
        icon="saida"
        hint="Se você entrou num computador que não é teu, é aqui que resolve."
      />

      <Button className="mt-4" variant="secondary" onClick={() => setConfirming(true)}>
        Encerrar em todos os dispositivos
      </Button>

      <div aria-live="polite" className="min-h-5">
        {revoke.error ? <p className="mt-1 text-sm text-danger">{revoke.error}</p> : null}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Encerrar todas as sessões?"
        description="Você vai precisar entrar de novo aqui e em qualquer outro aparelho."
        confirmLabel="Encerrar tudo"
        destructive
        onConfirm={() => {
          setConfirming(false)
          void revoke.run()
        }}
        onClose={() => setConfirming(false)}
      />
    </Panel>
  )
}

function DangerBlock() {
  const [confirming, setConfirming] = useState(false)

  const erase = useAsyncAction(async () => {
    await container.profiles.deleteAccount()
    window.location.assign('/')
  })

  return (
    <Panel>
      <PanelHeader
        title="Excluir a conta"
        icon="lixeira"
        hint="Apaga objetivos, hábitos, ações, registros, momentos e arquivos. Não dá pra desfazer."
      />

      <Button className="mt-4" variant="danger" onClick={() => setConfirming(true)}>
        Excluir minha conta
      </Button>

      <div aria-live="polite" className="min-h-5">
        {erase.error ? <p className="mt-1 text-sm text-danger">{erase.error}</p> : null}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Excluir a conta para sempre?"
        description="Tudo que você registrou é apagado agora, inclusive os arquivos. Não existe backup pra restaurar."
        confirmLabel="Excluir para sempre"
        destructive
        onConfirm={() => {
          setConfirming(false)
          void erase.run()
        }}
        onClose={() => setConfirming(false)}
      />
    </Panel>
  )
}
