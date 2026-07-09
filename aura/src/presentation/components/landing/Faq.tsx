import { Plus } from 'lucide-react'
import { Section, SectionHeading } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'

const faqs = [
  {
    q: 'Quanto custa?',
    a: 'As 10 primeiras pessoas garantem R$ 14,90/mês travado pra sempre. Depois disso: mensal R$ 29,90, trimestral R$ 69,90 (≈ R$ 23,30/mês) ou anual R$ 179,90 (≈ R$ 14,99/mês).',
  },
  {
    q: 'Como funciona o pagamento e o acesso?',
    a: 'Você escolhe o plano, paga com segurança na página de checkout e recebe o acesso por e-mail assim que a compra é confirmada. Simples e rápido.',
  },
  {
    q: 'E se eu não conseguir manter o hábito?',
    a: 'O Aura não te julga. Ele guarda seu progresso e fica te esperando. Você volta quando quiser, do ponto onde parou.',
  },
  {
    q: 'Preciso entender de tecnologia?',
    a: 'Não. Você cria uma meta, adiciona um livro e já vê tudo organizado. Foi feito pra ser simples.',
  },
  {
    q: 'Meus dados ficam seguros?',
    a: 'Cada conta enxerga só os próprios dados, isolados por usuária. Sua jornada é só sua.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Pode, sem burocracia. O preço de fundadora continua seu enquanto a assinatura estiver ativa.',
  },
]

export function Faq() {
  return (
    <Section id="faq">
      <Reveal>
        <SectionHeading eyebrow="Dúvidas" title="Perguntas frequentes" />
      </Reveal>

      <Reveal className="mx-auto mt-12 max-w-2xl divide-y divide-white/10">
        {faqs.map((faq) => (
          <details key={faq.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
              {faq.q}
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition-transform duration-200 group-open:rotate-45">
                <Plus className="h-4 w-4" />
              </span>
            </summary>
            <p className="mt-3 leading-relaxed text-zinc-400">{faq.a}</p>
          </details>
        ))}
      </Reveal>
    </Section>
  )
}
