import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * Prova de MÉTODO, não de pessoa. Depoimento inventado é o que mata a
 * confiança que a seção existe pra criar; enquanto não houver gente de
 * verdade pra citar, o que sustenta o pedido de cadastro são as decisões
 * verificáveis do produto. Quando existirem usuários, esta seção dá lugar a
 * eles.
 */
interface Proof {
  readonly icon: IconName
  readonly title: string
  readonly description: string
}

const PROOFS: readonly Proof[] = [
  {
    icon: 'cadeado',
    title: 'Privado por padrão, no banco',
    description:
      'Tudo nasce privado e a regra de quem vê o quê roda no banco de dados (Row Level Security), não só na tela. Verificação em duas etapas disponível.',
  },
  {
    icon: 'check',
    title: 'Regras testadas antes de ir pra tela',
    description:
      'Score, plano, progresso, dia adaptável e retomada são funções puras cobertas por mais de 600 testes automatizados. O número que você vê é o mesmo em toda tela.',
  },
  {
    icon: 'minimo',
    title: 'Nada de motivação vazia',
    description:
      'Sem padrão detectado, review e insight não escrevem nada. O app só fala quando tem o que dizer, e toda leitura vem com o botão que a resolve.',
  },
  {
    icon: 'raio',
    title: 'Funciona com você sozinho',
    description:
      'Feed vazio afasta gente. O ciclo inteiro entrega valor no primeiro dia, e o Círculo de amigos é camada opcional, nunca requisito.',
  },
]

/** Números que dá pra checar, no lugar de "milhares de usuários". */
const NUMBERS = [
  { value: '600+', label: 'testes automatizados nas regras' },
  { value: '10 s', label: 'de check-in por dia' },
  { value: '28 dias', label: 'de janela no Momentumm Score' },
] as const

export function Trust() {
  return (
    <Section id="confianca" className="bg-gradient-to-b from-brand-deep via-brand to-brand-hi">
      <SectionHeading
        tone="brand"
        eyebrow="Por que confiar"
        title="O que sustenta a promessa."
        description="Além do que as pessoas dizem, o que dá pra verificar são as decisões do produto."
      />

      <Reveal>
        <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3 text-center">
          {NUMBERS.map((item) => (
            <div key={item.label} className="rounded-card bg-black/20 px-3 py-4">
              <dd className="tabular text-2xl font-semibold text-white sm:text-3xl">
                {item.value}
              </dd>
              <dt className="mt-1 text-xs text-white/80 sm:text-sm">{item.label}</dt>
            </div>
          ))}
        </dl>
      </Reveal>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {PROOFS.map((proof, index) => (
          <Reveal key={proof.title} delay={index * 0.05} className="h-full">
            <li className="flex h-full gap-4 rounded-card border border-line bg-surface p-6">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-dim text-brand-hi">
                <Icon name={proof.icon} className="size-5" />
              </span>
              <div>
                <h3 className="font-medium text-ink">{proof.title}</h3>
                <p className="mt-2 text-pretty text-sm text-ink-muted">{proof.description}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}
