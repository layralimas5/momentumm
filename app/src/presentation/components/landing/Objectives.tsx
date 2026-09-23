import { motion, useReducedMotion } from 'framer-motion'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O ciclo que funciona, no mesmo desenho do ciclo que quebra.
 *
 * A seção do problema mostra cinco caixas terminando em "recomeça". Esta
 * mostra cinco caixas terminando em "continua", com a mesma tipografia e o
 * mesmo espaçamento de propósito: é a resposta visual àquela seção, e quem
 * rolou a página inteira reconhece a forma antes de ler as palavras.
 *
 * A amplitude ("serve pra qualquer objetivo") vem só aqui, no fim. Dita cedo
 * demais, ela dilui a promessa: a pessoa precisa se reconhecer no problema
 * antes de ouvir que o app também serve pra outra pessoa.
 */
const SYSTEM = [
  { label: 'Planeje', note: 'objetivo e etapas' },
  { label: 'Faça', note: 'a ação de hoje' },
  { label: 'Veja o progresso', note: 'o quanto andou' },
  { label: 'Ajuste', note: 'quando a rotina muda' },
  { label: 'Continue', note: 'sem voltar ao zero' },
] as const

const AREAS: readonly { readonly label: string; readonly icon: IconName }[] = [
  { label: 'Estudo', icon: 'formatura' },
  { label: 'Leitura', icon: 'livro' },
  { label: 'Treino', icon: 'halter' },
  { label: 'Concurso', icon: 'trofeu' },
  { label: 'Projeto pessoal', icon: 'objetivo' },
  { label: 'Idioma', icon: 'globo' },
]

export function Objectives() {
  const reduced = useReducedMotion()

  return (
    <Section id="objetivos" className="border-t border-line">
      <SectionHeading
        eyebrow="Um sistema para continuar"
        title="Um método. Diferentes objetivos."
        description="Objetivos, ações, hábitos, progresso e retomada trabalham juntos para ajudar você a continuar, não apenas para registrar o que você pretendia fazer."
      />

      <ol className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        {SYSTEM.map((step, index) => (
          <motion.li
            key={step.label}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            className="rounded-card border border-brand/30 bg-brand-dim/20 px-3 py-3 text-center last:col-span-2 sm:last:col-span-1"
          >
            <p className="text-sm font-medium text-ink">{step.label}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{step.note}</p>
          </motion.li>
        ))}
      </ol>

      <Reveal delay={0.3}>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {AREAS.map((area) => (
            <li
              key={area.label}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-muted"
            >
              <Icon name={area.icon} className="size-4 text-brand-hi" />
              {area.label}
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  )
}
