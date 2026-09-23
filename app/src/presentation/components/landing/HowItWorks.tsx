import type { ReactNode } from 'react'
import { XP_RULES } from '@/domain/entities/evolution'
import { MockCard, MockLabel, MockProgress, MockTag } from './PhoneMockup'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * Como o produto funciona, demonstrado em quatro momentos.
 *
 * Cada passo mostra a tela, não o conceito: o que a pessoa escreve, o que o
 * app devolve, o que ela vê no dia seguinte e o que acontece quando conclui.
 * O exemplo é um só ("terminar o TCC até novembro") e atravessa os quatro,
 * porque trocar de exemplo a cada passo quebra justamente a ideia de que é
 * um ciclo só.
 *
 * Os números vêm do domínio sempre que existem lá (o XP da prioridade é o
 * mesmo de `XP_RULES`): landing que inventa número é landing que mente na
 * primeira vez que o produto muda.
 */
const ESTUDO = 'var(--color-axis-estudo)'

interface Step {
  readonly title: string
  readonly description: string
  readonly visual: ReactNode
}

const STEPS: readonly Step[] = [
  {
    title: 'Conte onde quer chegar',
    description: 'Com as suas palavras, do jeito que você contaria pra alguém.',
    visual: <GoalVisual />,
  },
  {
    title: 'Receba um plano possível',
    description:
      'Do tamanho do tempo que você tem de verdade, quebrado em etapas com prazo. Se não couber, o app diz antes de salvar.',
    visual: <PlanVisual />,
  },
  {
    title: 'Abra o Momentumm e saiba o que fazer hoje',
    description:
      'Uma ação principal, com uma versão mínima pra quando o dia apertar. Não a meta inteira: o próximo passo dela.',
    visual: <TodayVisual />,
  },
  {
    title: 'Faça e veja sua meta avançar',
    description: 'A ação fecha, o objetivo anda e o próximo passo já está escolhido.',
    visual: <ProgressVisual />,
  },
]

export function HowItWorks() {
  return (
    <Section id="como-funciona" className="border-t border-line bg-surface/30">
      <SectionHeading
        eyebrow="Como funciona"
        title={
          <>
            <span className="block">Você não precisa organizar sua vida inteira.</span>
            <span className="block text-brand-hi">Precisa saber qual é o próximo passo.</span>
          </>
        }
      />

      <ol className="mt-10 flex flex-col gap-8 sm:gap-14">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Reveal delay={0.05}>
              <div className="grid items-center gap-5 md:grid-cols-[1fr_1.1fr] md:gap-12">
                <div className="min-w-0">
                  <p className="tabular text-xs font-medium tracking-wide text-brand-hi uppercase">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-2 text-balance text-xl font-semibold text-ink sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-pretty text-ink-muted">{step.description}</p>
                </div>

                <div aria-hidden="true" className="min-w-0">
                  {step.visual}
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/**
 * Os quatro recortes são desenhados com as primitivas do dashboard
 * (`PhoneMockup`), não com HTML solto: quando o app muda de linguagem
 * visual, eles mudam junto em vez de virar uma landing datada.
 */
function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-canvas p-3.5 shadow-xl shadow-black/20 sm:p-5">
      {children}
    </div>
  )
}

function GoalVisual() {
  return (
    <Frame>
      <MockLabel>Qual é o seu objetivo?</MockLabel>
      <div className="rounded-2xl border border-brand/40 bg-surface px-4 py-3">
        <p className="text-sm text-ink">Quero terminar meu TCC até novembro.</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <MockTag tone="brand">Estudo</MockTag>
        <MockTag>45 min por dia</MockTag>
        <MockTag>5 dias por semana</MockTag>
      </div>
    </Frame>
  )
}

const STAGES = [
  { name: 'Entrar no ritmo', when: 'até 20/09' },
  { name: 'Revisão bibliográfica', when: 'até 12/10' },
  { name: 'Rascunho', when: 'até 8/11' },
  { name: 'Revisão final', when: 'até 22/11' },
  { name: 'Entrega e defesa', when: 'até 30/11' },
] as const

function PlanVisual() {
  return (
    <Frame>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">Terminar o TCC</p>
        <span className="text-[11px] text-ink-faint">até 30 de novembro</span>
      </div>

      <MockLabel>Etapas</MockLabel>
      <ol className="space-y-1.5">
        {STAGES.map((stage, index) => (
          <li key={stage.name} className="flex items-center gap-2.5 text-xs text-ink">
            <span className="tabular grid size-5 shrink-0 place-items-center rounded-md bg-surface-hi text-[10px] text-ink-faint">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">{stage.name}</span>
            <span className="shrink-0 text-[10px] text-ink-faint">{stage.when}</span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[11px] text-ink-faint">
        45 min por dia · 5 dias por semana · cabe no prazo
      </p>
    </Frame>
  )
}

function TodayVisual() {
  return (
    <Frame>
      <MockLabel>Hoje</MockLabel>
      <MockCard tone="brand">
        <p className="text-[10px] text-ink-faint">Etapa: Rascunho · Objetivo: Terminar o TCC</p>
        <p className="mt-1 text-sm font-medium text-ink">Escrever a seção de métodos</p>
        <p className="mt-1.5 text-[11px] text-ink-muted">
          Versão mínima: abrir o arquivo e escrever 200 palavras
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-medium text-white">
            Começar
          </span>
          <span className="text-[10px] text-ink-faint">45 min previstos</span>
        </div>
      </MockCard>

    </Frame>
  )
}

function ProgressVisual() {
  return (
    <Frame>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">Escrever a seção de métodos</p>
        <MockTag tone="positive">Concluída</MockTag>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="tabular rounded-full bg-positive/15 px-2.5 py-1 text-xs font-medium text-positive">
          +{XP_RULES.priority_done.points} XP
        </span>
        <span className="text-[11px] text-ink-faint">prioridade do dia fechada</span>
      </div>

      <MockLabel>Terminar o TCC</MockLabel>
      <div className="flex items-baseline justify-between">
        <span className="tabular text-lg font-semibold text-ink">58%</span>
        <span className="text-[10px] text-ink-faint">etapa 3 de 5</span>
      </div>
      <MockProgress value={0.58} color={ESTUDO} className="mt-1.5" />

      <p className="mt-3 text-[11px] text-ink-faint">
        Próxima ação: <span className="text-ink">Montar a tabela de resultados</span>
      </p>
    </Frame>
  )
}
