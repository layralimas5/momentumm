import { TRIAL_DAYS } from '@/domain/billing/trial'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'
import { SITE } from './site'

/**
 * O que dá pra prometer e cumprir, em vez de número de usuário ou depoimento.
 * Cada card é uma garantia que o produto executa de verdade: teste sem
 * cartão, cancelamento sem ligação, dados exportáveis, suporte de quem fez.
 */
interface Guarantee {
  readonly icon: IconName
  readonly title: string
  readonly description: string
}

const GUARANTEES: readonly Guarantee[] = [
  {
    icon: 'raio',
    title: 'Sem cartão pra testar',
    description: `${TRIAL_DAYS} dias de PRO em toda conta nova. No fim, volta pro gratuito sozinho e nada é apagado.`,
  },
  {
    icon: 'saida',
    title: 'Cancela quando quiser',
    description: 'Um clique, sem ligação. O PRO continua até o fim do período já pago.',
  },
  {
    icon: 'cadeado',
    title: 'Seus dados são seus',
    description: 'Privado por padrão. Exporta tudo em JSON a qualquer hora e apaga a conta quando quiser.',
  },
  {
    icon: 'check',
    title: 'Regras testadas antes de ir pra tela',
    description: 'Score, plano e limites vivem em código com centenas de testes. O que a tela mostra é o que o banco calcula.',
  },
]

export function Trust() {
  return (
    <Section id="confianca" className="border-t border-line">
      <SectionHeading
        eyebrow="Por que confiar"
        title="O que sustenta a promessa."
        description="Sem contador de usuários nem depoimento de vitrine. O que dá pra verificar são as decisões do produto."
      />

      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {GUARANTEES.map((item, index) => (
          <Reveal key={item.title} delay={index * 0.05} className="h-full">
            <li className="pulse-on-hover flex h-full gap-4 rounded-card border border-line bg-surface p-6">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-dim text-brand-hi">
                <Icon name={item.icon} className="size-5" />
              </span>
              <div>
                <h3 className="font-medium text-ink">{item.title}</h3>
                <p className="mt-2 text-pretty text-sm text-ink-muted">{item.description}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ul>

      <Reveal delay={0.2}>
        <p className="mx-auto mt-8 max-w-2xl text-balance text-center text-sm text-ink-faint">
          Feito no Brasil, por uma pessoa. Suporte direto com quem construiu
          {SITE.contactEmail ? (
            <>
              :{' '}
              <a href={`mailto:${SITE.contactEmail}`} className="font-medium text-brand-hi underline-offset-2 hover:underline">
                {SITE.contactEmail}
              </a>
            </>
          ) : (
            ', pelo suporte dentro do app'
          )}
          .
        </p>
      </Reveal>
    </Section>
  )
}
