import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * A IA vendida pelo resultado, não pela tecnologia.
 *
 * Quem está decidindo se o app resolve o problema dela não quer saber quais
 * campos o modelo lê nem onde a chave fica: quer saber o que acontece na
 * quinta-feira em que o dia apertou. Por isso são três perguntas do dia a
 * dia, com a resposta em uma linha, e uma prova de que a última palavra é
 * sempre da pessoa.
 */
const CASES: readonly { readonly icon: IconName; readonly when: string; readonly what: string }[] = [
  {
    icon: 'relogio',
    when: 'Seu dia apertou?',
    what: 'Ajuda a adaptar a ação ao tempo que sobrou.',
  },
  {
    icon: 'plano',
    when: 'Seu plano travou?',
    what: 'Ajuda a identificar o gargalo que está segurando o objetivo.',
  },
  {
    icon: 'calendario',
    when: 'Terminou a semana?',
    what: 'Ajuda a escolher o próximo foco, com o que a semana mostrou.',
  },
]

export function MomentumAi() {
  return (
    <Section id="ia" className="border-t border-line bg-surface/30">
      <SectionHeading
        eyebrow="Momentumm AI"
        title="Uma IA que conhece sua meta antes de sugerir o próximo passo."
        description="Ela olha o seu objetivo, o seu plano e o seu tempo antes de abrir a boca. A sugestão vem com o botão que a executa."
      />

      {/*
        Três linhas, não três cards. Cada caso cabe numa pergunta e numa
        resposta; emoldurar isso em caixa com borda e sombra era dar peso de
        recurso a uma frase.
      */}
      <ul className="mx-auto mt-10 max-w-2xl divide-y divide-line border-y border-line">
        {CASES.map((item, index) => (
          <li key={item.when}>
            <Reveal delay={index * 0.06}>
              <div className="flex items-start gap-4 py-5">
                <Icon name={item.icon} className="mt-0.5 size-5 shrink-0 text-brand-hi" />
                <div className="min-w-0">
                  <h3 className="font-medium text-ink">{item.when}</h3>
                  <p className="mt-1 text-pretty text-sm text-ink-muted">{item.what}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>

      {/* A prova da frase: a sugestão chega como proposta, com os dois botões. */}
      <Reveal delay={0.2}>
        <div className="pulse-on-hover mx-auto mt-8 max-w-xl rounded-card border border-brand/30 bg-brand-dim/20 p-5 sm:p-6">
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-hi uppercase">
            <Icon name="ia" className="size-4" />
            Sugestão
          </p>
          <p className="mt-2.5 text-pretty text-ink">
            Mover “Revisar anotações” pra manhã de terça, logo depois da leitura. É o horário em que
            você conclui mais.
          </p>
          <div aria-hidden="true" className="mt-4 flex flex-wrap items-center gap-2.5">
            <span className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white">
              Aplicar
            </span>
            <span className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink-muted">
              Editar
            </span>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.28}>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-center text-lg font-medium text-ink">
          Nada muda sem você confirmar.
        </p>
      </Reveal>
    </Section>
  )
}
