import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * Os diferenciais são os recursos que existem porque o produto assume que o
 * dia real é diferente do dia ideal. Cada um é uma decisão de domínio, não
 * uma feature de catálogo.
 */
interface Benefit {
  readonly icon: IconName
  readonly title: string
  readonly description: string
}

const BENEFITS: readonly Benefit[] = [
  {
    icon: 'raio',
    title: 'Uma prioridade por dia',
    description:
      'Não uma lista. A ação que mais move o objetivo, com o tempo previsto e o botão de foco na frente.',
  },
  {
    icon: 'minimo',
    title: 'Versão mínima de tudo',
    description:
      'Hábito e ação têm uma versão pra dia ruim. Ela preserva a sequência e mantém o plano vivo sem exigir o dia inteiro.',
  },
  {
    icon: 'relogio',
    title: 'Dia Adaptável',
    description:
      'Você diz quanto tempo tem e o app reorganiza: mantém, reduz ou reagenda cada item, sem empilhar tudo em amanhã. Nada é gravado sem você confirmar.',
  },
  {
    icon: 'desfazer',
    title: 'Modo Retomada',
    description:
      'Quando dois ou mais sinais de queda aparecem, ele oferece até três passos pequenos, ordenados por avanço por minuto. Nenhuma sequência é encerrada.',
  },
  {
    icon: 'progresso',
    title: 'Previsão pelo ritmo real',
    description:
      'Com duas semanas de história, cada objetivo ganha uma data condicional: "mantendo esse ritmo, fecha em...". Sem história suficiente, a previsão se cala.',
  },
  {
    icon: 'cadeado',
    title: 'Privado por padrão',
    description:
      'Tudo nasce privado e a regra é aplicada no banco de dados, não só na tela. O app entrega valor com você sozinho; o Círculo de amigos é camada, não requisito.',
  },
]

export function Benefits() {
  return (
    <Section id="diferenciais" className="border-t border-line">
      <SectionHeading
        eyebrow="Diferenciais"
        title="Feito pra o dia real, não pra o dia ideal."
        description="Cada recurso abaixo existe porque o plano perfeito não sobrevive a uma semana comum. O Momentumm assume isso desde o começo."
      />

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map((benefit, index) => (
          <Reveal key={benefit.title} delay={index * 0.05} className="h-full">
            <li className="pulse-on-hover flex h-full flex-col rounded-card border border-line bg-surface p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-dim text-brand-hi">
                <Icon name={benefit.icon} className="size-5" />
              </span>
              <h3 className="mt-4 font-medium text-ink">{benefit.title}</h3>
              <p className="mt-2 text-pretty text-sm text-ink-muted">{benefit.description}</p>
            </li>
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}
