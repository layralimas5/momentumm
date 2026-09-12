import { Icon } from '@/presentation/components/ui/Icon'
import { MockCard, MockLabel, MockRow, MockTag } from './PhoneMockup'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * As três funções que existem no contrato `AiService`: montar o plano, ler o
 * progresso e sintetizar o review. A seção descreve o que a IA recebe e o que
 * devolve, porque é a estrutura (etapas, ações, ajustes) que faz a sugestão
 * virar prévia editável em vez de texto solto.
 */
const CAPABILITIES = [
  {
    title: 'Monta o plano a partir do objetivo',
    input: 'O que você quer, até quando e quantos minutos por dia tem de verdade.',
    output:
      'Etapas em ordem, hábito de apoio com versão mínima e as ações de cada etapa, já com data. Se o prazo não fecha, ela sugere outro e diz por quê.',
  },
  {
    title: 'Lê o progresso e aponta o gargalo',
    input: 'Momentum, dias ativos, taxa de hábitos e ações, objetivos parados, o que está planejado pra hoje e a sua capacidade.',
    output:
      'Padrões, gargalos, sinal de sobrecarga quando o dia pede mais do que você tem, e uma próxima ação concreta.',
  },
  {
    title: 'Sintetiza a semana no review',
    input: 'Execução, dias ativos, e o que você escreveu sobre conquistas, dificuldades e aprendizados.',
    output: 'Um parágrafo sobre a semana, e a recomendação que vira prioridade da próxima.',
  },
] as const

export function MomentumAi() {
  return (
    <Section id="ia" className="border-t border-line bg-surface-hi">
      <SectionHeading
        eyebrow="Momentumm AI"
        title="A IA que conhece o seu plano, não uma que responde qualquer coisa."
        description="Ela usa os seus objetivos, a sua rotina e o seu progresso pra planejar, interpretar resultados e sugerir ajustes. E devolve estrutura, não texto: cada sugestão vira uma prévia que você edita antes de salvar."
      />

      <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-14">
        <ol className="flex flex-col gap-4">
          {CAPABILITIES.map((capability, index) => (
            <Reveal key={capability.title} delay={index * 0.06}>
              <li className="rounded-card border border-line bg-surface p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-dim text-brand-hi">
                    <Icon name="ia" className="size-4.5" />
                  </span>
                  <h3 className="font-medium text-ink">{capability.title}</h3>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                      O que ela lê
                    </dt>
                    <dd className="mt-1 text-pretty text-sm text-ink-muted">{capability.input}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                      O que devolve
                    </dt>
                    <dd className="mt-1 text-pretty text-sm text-ink-muted">{capability.output}</dd>
                  </div>
                </dl>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.12}>
          <div aria-hidden="true" className="surface-brand edge-light rounded-card p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-hi">Prévia do plano</p>
            <p className="mt-2 text-sm font-medium text-ink">Terminar o TCC</p>
            <p className="text-xs text-ink-faint">Até 30 de novembro · 45 min por dia · 5 dias por semana</p>

            <MockLabel>Etapas</MockLabel>
            <ol className="space-y-1.5">
              {['Entrar no ritmo', 'Revisão bibliográfica', 'Rascunho', 'Revisão final', 'Entrega e defesa'].map(
                (step, index) => (
                  <li key={step} className="flex items-center gap-2 text-xs text-ink">
                    <span className="tabular grid size-5 place-items-center rounded-md bg-surface-hi text-[10px] text-ink-faint">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ),
              )}
            </ol>

            <MockLabel>Hábito de apoio</MockLabel>
            <MockCard>
              <p className="text-xs font-medium text-ink">Ler 20 páginas · todo dia · manhã</p>
              <p className="mt-1 text-[11px] text-ink-muted">
                Versão mínima: 5 páginas. Leitura diária alimenta o rascunho sem depender de sessão longa.
              </p>
            </MockCard>

            <MockLabel>Primeiras ações</MockLabel>
            <MockCard className="py-1">
              <ul>
                <MockRow label="Listar as 10 referências principais" meta="Etapa 1 · hoje · 30 min" />
                <MockRow label="Escrever o esboço da introdução" meta="Etapa 1 · quinta · 45 min" />
              </ul>
            </MockCard>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-flame/30 bg-flame-dim/40 px-3 py-2">
              <MockTag tone="warn">Aviso</MockTag>
              <p className="text-[11px] text-ink-muted">
                Com 45 min por dia, o prazo fica apertado. Sugestão: 14 de dezembro, ou reduzir o alvo da revisão.
              </p>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white">Salvar plano</span>
              <span className="text-xs text-ink-faint">Cada linha é editável antes disso</span>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.2}>
        <p className="mx-auto mt-10 max-w-2xl text-balance text-center text-sm text-ink-muted">
          A IA não é o produto. O produto é o ciclo que continua rodando depois que o plano
          existe. Ela entra pra montar o caminho e pra ler o que os seus dados mostram, com as
          mesmas regras de domínio de um plano feito na mão.
        </p>
      </Reveal>
    </Section>
  )
}
