import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { formatPhone, MAX_LEAD_EMAIL, MAX_LEAD_NAME, type LeadErrors, type QuizLead } from '@/domain/entities/quiz-lead'
import { Field, TextInput } from '@/presentation/components/ui/Field'

/**
 * A tela entre a última pergunta e o diagnóstico: por onde falar com a pessoa
 * depois.
 *
 * Dois campos obrigatórios e um opcional. Cada campo a mais aqui é gente
 * desistindo no pior lugar possível, então o WhatsApp pede licença em vez de
 * exigir: quem quiser deixar, deixa.
 *
 * A finalidade é dita na tela, não escondida num termo, e ela é a VERDADEIRA:
 * o contato serve pra o Momentumm falar com a pessoa depois. O plano aparece
 * na tela seguinte, não no e-mail — nenhum envio existe, e prometer um seria
 * a primeira promessa quebrada do produto, logo na porta de entrada. É o que
 * a LGPD chama de consentimento informado, e é o mínimo pra usar isso depois.
 */

interface QuizContactProps {
  readonly lead: QuizLead
  readonly warnings: LeadErrors
  readonly onChange: (changes: Partial<QuizLead>) => void
  readonly onSubmit: () => void
}

export function QuizContact({ lead, warnings, onChange, onSubmit }: QuizContactProps) {
  const reduced = useReducedMotion()

  return (
    <motion.form
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="flex flex-col"
    >
      <header className="mb-5">
        <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">Último passo</p>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-balance text-ink sm:text-2xl">
          Como eu falo com você depois?
        </h1>
        <p className="mt-2 text-sm text-pretty text-ink-muted">
          Teu diagnóstico e teu plano estão prontos, na próxima tela. Deixa teu contato pra eu
          poder te chamar depois e saber como o plano está indo.
        </p>
      </header>

      <div className="flex flex-col gap-3.5">
        <Field label="Nome ou apelido" error={warnings.name ?? null}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              value={lead.name}
              onChange={(event) => onChange({ name: event.target.value.slice(0, MAX_LEAD_NAME) })}
              aria-describedby={describedBy}
              autoComplete="given-name"
              enterKeyHint="next"
              autoFocus
              className="min-h-12 text-base"
            />
          )}
        </Field>

        <Field label="E-mail" error={warnings.email ?? null}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              type="email"
              inputMode="email"
              value={lead.email}
              onChange={(event) => onChange({ email: event.target.value.slice(0, MAX_LEAD_EMAIL) })}
              aria-describedby={describedBy}
              autoComplete="email"
              enterKeyHint="next"
              placeholder="voce@email.com"
              className="min-h-12 text-base"
            />
          )}
        </Field>

        <Field
          label="WhatsApp"
          hint="Opcional. É por aqui que eu aviso se o teu plano travar."
          error={warnings.phone ?? null}
        >
          {(id, describedBy) => (
            <TextInput
              id={id}
              type="tel"
              inputMode="numeric"
              value={lead.phone}
              onChange={(event) => onChange({ phone: formatPhone(event.target.value) })}
              aria-describedby={describedBy}
              autoComplete="tel-national"
              enterKeyHint="next"
              placeholder="(11) 91234-5678"
              className="min-h-12 text-base"
            />
          )}
        </Field>

      </div>

      <p className="mt-4 text-xs text-pretty text-ink-faint">
        Ao continuar, você aceita que o Momentumm entre em contato sobre o teu plano. Nada de
        lista de terceiros, e dá pra pedir a remoção quando quiser. Ver a{' '}
        <Link to="/privacidade" target="_blank" rel="noreferrer" className="text-brand-hi hover:underline">
          política de privacidade
        </Link>
        .
      </p>

      {/*
          O submit de verdade é o botão do rodapé da casca. Este existe só pra
          o Enter do teclado enviar o formulário, e sai da árvore de
          acessibilidade pra não anunciar o mesmo botão duas vezes.
      */}
      <button type="submit" tabIndex={-1} aria-hidden="true" className="sr-only">
        Enviar
      </button>
    </motion.form>
  )
}
