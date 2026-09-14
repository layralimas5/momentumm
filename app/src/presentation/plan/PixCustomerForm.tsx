import { useState, type FormEvent } from 'react'
import type { PixCustomer } from '@/domain/billing/billing-service'
import { formatCpf, isValidCpf, normalizeCpf } from '@/domain/billing/cpf'
import { Button } from '@/presentation/components/ui/Button'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { ErrorNote } from '@/presentation/components/ui/States'

/**
 * O que o Pix pede antes de gerar o QR: nome e CPF, porque o Asaas só abre
 * assinatura pra um cliente com dono. O cartão coleta isso no checkout
 * dele; aqui a pessoa não sai do app, então o formulário é nosso.
 */
export function PixCustomerForm({
  initialName,
  submitLabel,
  loading,
  error,
  onSubmit,
  onBack,
}: {
  readonly initialName: string
  readonly submitLabel: string
  readonly loading: boolean
  readonly error: string | null
  readonly onSubmit: (customer: PixCustomer) => void
  readonly onBack: () => void
}) {
  const [name, setName] = useState(initialName)
  const [cpf, setCpf] = useState('')
  const [touched, setTouched] = useState(false)

  const nameError = touched && name.trim().length < 3 ? 'Coloca o nome como está no CPF.' : null
  const cpfError = touched && !isValidCpf(cpf) ? 'Esse CPF não fecha. Confere os números.' : null
  const valid = name.trim().length >= 3 && isValidCpf(cpf)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!valid) return
    onSubmit({ name: name.trim(), cpf: normalizeCpf(cpf) })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome completo" error={nameError}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={nameError ? true : undefined}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={120}
              required
            />
          )}
        </Field>
        <Field label="CPF" hint="Só pra emitir a cobrança. Fica no Asaas, não aqui." error={cpfError}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={cpfError ? true : undefined}
              value={cpf}
              onChange={(event) => setCpf(formatCpf(event.target.value))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              maxLength={14}
              required
            />
          )}
        </Field>
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" loading={loading} className="w-full sm:w-fit">
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} disabled={loading} className="w-full sm:w-fit">
          Voltar
        </Button>
      </div>
    </form>
  )
}
