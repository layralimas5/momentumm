import {
  MockCard,
  MockLabel,
  MockMomentum,
  MockProgress,
  MockRow,
  MockTag,
  PhoneMockup,
} from './PhoneMockup'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * A tela que a pessoa abre todo dia, em tamanho grande e sem legenda.
 *
 * Aqui a tela é o argumento: se precisar de três parágrafos explicando a
 * interface, a interface está errada. A ordem dentro do celular é a mesma do
 * app (estado do dia, prioridade, hábitos, semana), porque a promessa da
 * seção é "abra e saiba o que importa", e uma ordem diferente da real seria
 * uma promessa que o app não cumpre na primeira abertura.
 *
 * É um componente, não uma captura: a tela Hoje está sendo redesenhada, e
 * captura velha envelhece na página. Quando a nova subir, trocar por
 * `/telas/hoje.webp` (ver `PhoneMockup`, `flush`).
 */
const ESTUDO = 'var(--color-axis-estudo)'
const TREINO = 'var(--color-axis-treino)'

export function Today() {
  return (
    <Section id="hoje" className="border-t border-line bg-surface/30">
      <div className="mx-auto max-w-2xl">
        <SectionHeading
          eyebrow="A tela de todo dia"
          title="Abra o Momentumm e saiba o que importa hoje."
          description="Nada de encarar a meta inteira todo dia. Você abre e encontra o próximo passo que cabe na sua rotina de hoje."
        />

        <Reveal className="mt-12">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 top-1/2 h-56 -translate-y-1/2 rounded-full bg-brand/20 blur-3xl"
            />
            <PhoneMockup className="relative" tall>
              <TodayScreen />
            </PhoneMockup>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

function TodayScreen() {
  return (
    <>
      <header className="mb-3">
        <p className="text-[11px] text-ink-faint">Terça, 9 de setembro</p>
        <p className="text-base font-semibold text-ink">Boa tarde, Marina</p>
      </header>

      <MockMomentum value={72} level="Constante" delta={4} streak={12} />

      <MockLabel>Como você está chegando hoje?</MockLabel>
      <div className="flex gap-1.5">
        <MockTag tone="brand">Energia 3/5</MockTag>
        <MockTag>Capacidade moderada</MockTag>
      </div>

      <MockLabel>Sua prioridade de hoje</MockLabel>
      <MockCard tone="brand">
        <p className="text-[10px] text-ink-faint">Objetivo: Terminar o TCC · Etapa: Rascunho</p>
        <p className="mt-1 text-sm font-medium text-ink">Escrever a seção de métodos</p>
        <p className="mt-1.5 text-[11px] text-ink-muted">
          Versão mínima: abrir o arquivo e escrever 200 palavras
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-medium text-white">
            Começar
          </span>
          <span className="text-[10px] text-ink-faint">45 min previstos</span>
        </div>
      </MockCard>

      <MockLabel>Hábitos de hoje · 2 de 3</MockLabel>
      <MockCard className="py-1">
        <ul>
          <MockRow label="Ler 20 páginas" done color={ESTUDO} />
          <MockRow label="Caminhar 20 min" done color={TREINO} />
          <MockRow label="Revisar anotações" meta="Versão mínima: 5 min" />
        </ul>
      </MockCard>

      {/* A semana fecha a tela numa linha: um card aqui estourava a moldura. */}
      <MockLabel>Sua semana</MockLabel>
      <div className="flex items-center gap-2.5">
        <MockProgress value={0.71} className="flex-1" />
        <span className="tabular shrink-0 text-[10px] text-ink-faint">5 de 7 dias</span>
      </div>
    </>
  )
}
