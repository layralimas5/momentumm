import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

const QUESTIONS = [
  {
    question: 'O Momentumm é mais um app de hábitos?',
    answer:
      'Não. App de hábito pergunta se você fez ou não fez. Aqui você registra quanto fez, em que eixo e quando, e isso vira histórico, meta e sequência. A unidade é a atividade, não o check.',
  },
  {
    question: 'Tudo que eu registro fica público?',
    answer:
      'Você escolhe. Cada registro pode ser público, visível só pra quem te segue ou totalmente privado. A regra é aplicada no banco de dados, não só na tela.',
  },
  {
    question: 'E se eu perder um dia?',
    answer:
      'A sequência quebra só quando um dia inteiro passa sem nenhum registro, e o app avisa antes disso. Seu recorde pessoal fica guardado de qualquer jeito.',
  },
  {
    question: 'Posso registrar outras coisas além de leitura e treino?',
    answer:
      'Hoje são quatro eixos: leitura, estudo, treino e meditação. Eixos novos entram sem reescrever o app, então escrita, sono e outros chegam conforme a comunidade pedir.',
  },
  {
    question: 'Quanto custa?',
    answer:
      'Registrar nas quatro áreas, sequência, recorde e uma meta ativa são grátis e continuam grátis. O PRO abre o histórico completo, as metas ilimitadas, as estatísticas e a comunidade.',
  },
] as const

export function Faq() {
  return (
    <Section id="faq" className="border-t border-line bg-surface/30">
      <SectionHeading title="O que você precisa saber antes de começar" />

      <div className="mx-auto mt-12 max-w-2xl">
        {QUESTIONS.map((item, index) => (
          <Reveal key={item.question} delay={index * 0.04}>
            <details className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-medium text-ink marker:hidden">
                {item.question}
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="size-5 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="pb-5 text-pretty text-sm text-ink-muted">{item.answer}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
