import type { ReactNode } from 'react'
import { XP_RULES } from '@/domain/entities/evolution'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { MockLabel, MockProgress, MockTag } from './PhoneMockup'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * Como o produto funciona, em três telas.
 *
 * Eram quatro. O passo "abra e saiba o que fazer hoje" saiu porque a seção
 * seguinte é exatamente essa tela, em tamanho grande: dizer duas vezes só
 * fazia a pessoa rolar mais pra ver a mesma coisa.
 *
 * O exemplo é um só ("terminar o TCC até novembro") e atravessa os três: é
 * ele que mostra que isso é um ciclo, não três recursos soltos.
 *
 * Os números vêm do domínio sempre que existem lá (o XP da prioridade é o
 * mesmo de `XP_RULES`): landing que inventa número mente na primeira vez que
 * o produto muda.
 */
const ESTUDO = 'var(--color-axis-estudo)'

interface Step {
  readonly title: string
  readonly description: string
  readonly visual: ReactNode
}

const STEPS: readonly Step[] = [
  {
    title: 'Diga onde quer chegar',
    description: 'Com as suas palavras. Sem categoria, sem planilha, sem método pra aprender.',
    visual: <GoalVisual />,
  },
  {
    title: 'Receba um plano que cabe na sua semana',
    description: 'Etapas com prazo, do tamanho do tempo que você tem. Se não couber, ele avisa antes de salvar.',
    visual: <PlanVisual />,
  },
  {
    title: 'Faça o passo de hoje e veja a meta andar',
    description: 'Um passo por dia, com versão mínima pro dia ruim. O próximo já vem escolhido.',
    visual: <ProgressVisual />,
  },
]

/** A amplitude vem aqui, depois da dor e do método. Nunca antes. */
const AREAS: readonly { readonly label: string; readonly icon: IconName }[] = [
  { label: 'Estudo', icon: 'formatura' },
  { label: 'Leitura', icon: 'livro' },
  { label: 'Treino', icon: 'halter' },
  { label: 'Concurso', icon: 'trofeu' },
  { label: 'Projeto pessoal', icon: 'objetivo' },
  { label: 'Idioma', icon: 'globo' },
]

export function HowItWorks() {
  return (
    <Section id="como-funciona" className="border-t border-line bg-surface/30">
      <SectionHeading
        eyebrow="Como funciona"
        title={
          <>
            <span className="block">Você não precisa organizar sua vida inteira.{' '}</span>
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

      <Reveal delay={0.1}>
        <p className="mt-12 text-center text-sm font-medium text-ink">
          Um método. Diferentes objetivos.
        </p>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {AREAS.map((area) => (
            <li
              key={area.label}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-muted"
            >
              <Icon name={area.icon} className="size-4 text-brand-hi" />
              {area.label}
            </li>
          ))}
        </ul>
      </Reveal>

      <HowToJsonLd />
    </Section>
  )
}

/**
 * Os mesmos três passos, em dados estruturados.
 *
 * É a parte da página que responde "como funciona o Momentumm?" quando a
 * pergunta é feita pra um modelo em vez de pra uma busca. Gerado da lista
 * `STEPS`: um passo que mudar na tela muda aqui junto, e a página nunca
 * afirma pro robô o que não afirma pra pessoa.
 */
function HowToJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Como funciona o Momentumm',
    description:
      'Como transformar uma meta em um plano possível e em um passo por dia no Momentumm.',
    inLanguage: 'pt-BR',
    totalTime: 'PT5M',
    step: STEPS.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.description,
    })),
  }

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}

/**
 * Os quatro recortes são desenhados com as primitivas do dashboard
 * (`PhoneMockup`), não com HTML solto: quando o app muda de linguagem
 * visual, eles mudam junto em vez de virar uma landing datada.
 */
function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="pulse-on-hover rounded-card border border-line bg-canvas p-3.5 shadow-xl shadow-black/20 sm:p-5">
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
