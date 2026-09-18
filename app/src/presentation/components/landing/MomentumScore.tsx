import { Reveal } from './Reveal'
import { PhoneShowcase } from './PhoneShowcase'
import { Section, SectionHeading } from './Section'

/**
 * Os pesos e as regras vêm do domínio (`momentum.ts`): 35/30/20/15, janela de
 * 28 dias com a última semana valendo o triplo, impacto em vez de quantidade,
 * retomada medida pelo tempo até voltar. Se a calibragem mudar lá, muda aqui.
 */

const RULES = [
  {
    title: 'Olha 28 dias, com a semana atual pesando o triplo',
    description:
      'Sete dias sozinhos viram termômetro de humor: uma gripe apaga um mês. Um mês sozinho não reage ao que você mudou hoje. Com o peso, a semana atual responde por metade do score.',
  },
  {
    title: 'Falhar um dia custa pouco e nunca zera',
    description:
      'Um dia vazio é um dia sem crédito, não um zero na conta. Com 28 dias na janela, o pior dia possível tira poucos pontos.',
  },
  {
    title: 'Conta impacto, não quantidade',
    description:
      'A prioridade do dia vale 3, a ação de objetivo vale 2, a tarefa comum vale 1. Hábito tem teto: cinco marcações fáceis nunca passam a ação que destrava a etapa.',
  },
  {
    title: 'Voltar rápido devolve a nota',
    description:
      'Retomar em até dois dias devolve nota cheia no fator de retomada. A volta mais recente pesa o dobro das anteriores: a pergunta é "você consegue voltar?", e a resposta que vale é a de agora.',
  },
] as const

const LEVELS = ['Desacelerando', 'Retomando', 'Constante', 'Avançando'] as const

export function MomentumScore() {
  return (
    <Section id="momentum-score" className="border-t border-line">
      <SectionHeading
        eyebrow="Momentumm Score"
        title="Um número que mede ritmo, não o seu valor."
        description="De 0 a 100, o Momentumm diz se você está avançando, constante, retomando ou desacelerando. Ele compara você com você, e é desenhado pra uma falha isolada não apagar um mês de trabalho."
      />

      <div className="mt-12 flex flex-col gap-12">
        <PhoneShowcase />

        <div className="grid gap-4 sm:grid-cols-2">
          {RULES.map((rule, index) => (
            <Reveal key={rule.title} delay={index * 0.06}>
              <div className="pulse-on-hover h-full rounded-card border border-line bg-surface p-5">
                <h3 className="font-medium text-ink">{rule.title}</h3>
                <p className="mt-2 text-pretty text-sm text-ink-muted">{rule.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal delay={0.2}>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-faint">
          <span>Quatro classificações:</span>
          {LEVELS.map((level) => (
            <span key={level} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted">
              {level}
            </span>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-sm text-ink-faint">
          Abaixo de sete dias de história, o app diz que o número ainda está se formando, em vez
          de vender precisão que não existe.
        </p>
      </Reveal>
    </Section>
  )
}
