import type { ReactNode } from 'react'
import {
  MockCard,
  MockHeader,
  MockLabel,
  MockMomentum,
  MockProgress,
  MockRow,
  MockSparkline,
  MockTag,
} from './PhoneMockup'

/**
 * As seis telas do ciclo, desenhadas com as mesmas primitivas do dashboard.
 *
 * Um exemplo só atravessa todas elas ("Terminar o TCC", eixo estudo): o
 * argumento da página é que objetivo, plano, dia, progresso e review são a
 * mesma coisa vista de ângulos diferentes, e trocar de exemplo a cada tela
 * quebraria justamente isso. Nada aqui mostra um recurso que o app não tem.
 */

const ESTUDO = 'var(--color-axis-estudo)'
const TREINO = 'var(--color-axis-treino)'

export function TodayScreen() {
  return (
    <>
      <MockHeader title="Boa tarde, Marina" subtitle="Terça, 9 de setembro" />

      <MockMomentum value={72} level="Constante" delta={4} streak={12} />

      <MockLabel>Como você está chegando hoje?</MockLabel>
      <div className="flex gap-1.5">
        <MockTag tone="brand">Energia 3/5</MockTag>
        <MockTag>Capacidade moderada</MockTag>
      </div>

      <MockLabel>Prioridade principal</MockLabel>
      <MockCard tone="brand">
        <p className="text-[10px] text-ink-faint">
          Ação prioritária · Etapa: Rascunho · Objetivo: Terminar o TCC
        </p>
        <p className="mt-1 text-sm font-medium text-ink">Escrever a seção de métodos</p>
        <p className="mt-1.5 text-[11px] text-ink-muted">
          Versão mínima: abrir o arquivo e escrever 200 palavras
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-medium text-white">
            Começar foco · 25 min
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
    </>
  )
}

export function ObjectivesScreen() {
  return (
    <>
      <MockHeader title="Objetivos" subtitle="Onde você quer chegar" />

      <MockCard>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">Terminar o TCC</p>
          <MockTag tone="brand">Em andamento</MockTag>
        </div>
        <p className="mt-1 text-[10px] text-ink-faint">Estudo · até 30 de novembro</p>
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="tabular text-lg font-semibold text-ink">58%</span>
          <span className="text-[10px] text-ink-faint">etapa 3 de 5</span>
        </div>
        <MockProgress value={0.58} color={ESTUDO} className="mt-1.5" />
        <p className="mt-2 text-[10px] text-ink-muted">
          Mantendo esse ritmo, fecha em 7 de novembro.
        </p>
        <p className="mt-1.5 text-[10px] text-ink-faint">
          Próxima ação: <span className="text-ink">Escrever a seção de métodos</span>
        </p>
      </MockCard>

      <MockCard className="mt-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">Correr 10 km sem parar</p>
          <MockTag tone="warn">Parado há 8 dias</MockTag>
        </div>
        <p className="mt-1 text-[10px] text-ink-faint">Treino · até 15 de dezembro</p>
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="tabular text-lg font-semibold text-ink">31%</span>
          <span className="text-[10px] text-ink-faint">etapa 2 de 4</span>
        </div>
        <MockProgress value={0.31} color={TREINO} className="mt-1.5" />
        <p className="mt-2 text-[10px] text-ink-faint">
          Próxima ação: <span className="text-ink">Corrida leve de 3 km</span>
        </p>
        <span className="mt-2 inline-block rounded-md border border-line px-2 py-0.5 text-[10px] text-ink-muted">
          Trazer pra hoje
        </span>
      </MockCard>
    </>
  )
}

export function HabitsScreen() {
  return (
    <>
      <MockHeader title="Hábitos" subtitle="A repetição que segura o plano" />

      <MockCard>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Ler 20 páginas</p>
          <MockTag tone="positive">12 dias</MockTag>
        </div>
        <p className="mt-1 text-[10px] text-ink-faint">
          Todo dia · manhã · Objetivo: Terminar o TCC
        </p>
        <WeekDots done={[true, true, true, true, true, false, true]} color={ESTUDO} />
        <p className="mt-2 text-[10px] text-ink-muted">Versão mínima: 5 páginas</p>
      </MockCard>

      <MockCard className="mt-2.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Caminhar 20 min</p>
          <MockTag tone="positive">5 dias</MockTag>
        </div>
        <p className="mt-1 text-[10px] text-ink-faint">Seg, qua, sex · Objetivo: Correr 10 km</p>
        <WeekDots done={[true, false, true, false, true, false, false]} color={TREINO} />
        <p className="mt-2 text-[10px] text-ink-muted">Versão mínima: 8 min</p>
      </MockCard>

      <MockCard className="mt-2.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Revisar anotações</p>
          <MockTag>Adiado ontem</MockTag>
        </div>
        <p className="mt-1 text-[10px] text-ink-faint">Todo dia · noite</p>
        <WeekDots done={[true, true, false, true, true, false, false]} color={ESTUDO} skipped={[5]} />
        <p className="mt-2 text-[10px] text-ink-muted">
          Adiar não quebra a sequência. Ela conta dias cumpridos, não dias perfeitos.
        </p>
      </MockCard>
    </>
  )
}

function WeekDots({
  done,
  color,
  skipped = [],
}: {
  done: readonly boolean[]
  color: string
  skipped?: readonly number[]
}) {
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
  return (
    <ul className="mt-2.5 flex gap-1.5">
      {days.map((day, index) => {
        const isDone = done[index] ?? false
        const isSkipped = skipped.includes(index)
        return (
          <li key={`${day}-${index}`} className="flex flex-col items-center gap-1">
            <span
              className="size-4 rounded-full border border-line-hi"
              style={
                isDone
                  ? { backgroundColor: color, borderColor: color }
                  : isSkipped
                    ? { borderStyle: 'dashed' }
                    : undefined
              }
            />
            <span className="text-[9px] text-ink-faint">{day}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function PlanScreen() {
  return (
    <>
      <MockHeader title="Plano" subtitle="Terminar o TCC · 58%" />

      <StageRow name="Entrar no ritmo" weight={20} status="concluida" />
      <StageRow name="Revisão bibliográfica" weight={20} status="concluida" />
      <StageRow name="Rascunho" weight={30} status="em-andamento" bottleneck>
        <ul className="mt-1.5">
          <MockRow label="Escrever a seção de métodos" meta="Hoje · 45 min · prioridade" />
          <MockRow label="Montar a tabela de resultados" meta="Quinta · 60 min" />
          <MockRow label="Enviar rascunho pra orientadora" meta="Sexta · 15 min" />
        </ul>
      </StageRow>
      <StageRow name="Revisão final" weight={20} status="nao-iniciada" />
      <StageRow name="Entrega e defesa" weight={10} status="nao-iniciada" />

      <p className="mt-2.5 text-[10px] text-ink-faint">
        Os pesos das etapas somam 100. O progresso sobe pela hierarquia: ação, etapa, objetivo.
      </p>
    </>
  )
}

function StageRow({
  name,
  weight,
  status,
  bottleneck = false,
  children,
}: {
  name: string
  weight: number
  status: 'concluida' | 'em-andamento' | 'nao-iniciada'
  bottleneck?: boolean
  children?: ReactNode
}) {
  const tag =
    status === 'concluida' ? (
      <MockTag tone="positive">Concluída</MockTag>
    ) : status === 'em-andamento' ? (
      <MockTag tone="brand">Em andamento</MockTag>
    ) : (
      <MockTag>Não iniciada</MockTag>
    )

  return (
    <MockCard className="mt-2 first:mt-0" tone={bottleneck ? 'brand' : 'plain'}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-ink">{name}</p>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="tabular text-[10px] text-ink-faint">{weight}%</span>
          {tag}
        </span>
      </div>
      {bottleneck ? (
        <p className="mt-1 text-[10px] text-flame">Está segurando o objetivo</p>
      ) : null}
      {children}
    </MockCard>
  )
}

export function ProgressScreen() {
  return (
    <>
      <MockHeader title="Progresso" subtitle="Se o ritmo está de pé" />

      <MockCard>
        <div className="flex items-baseline justify-between">
          <span className="flex items-baseline gap-1.5">
            <span className="text-gradient-brand tabular text-3xl font-semibold leading-none">72</span>
            <MockTag tone="brand">Constante</MockTag>
          </span>
          <span className="tabular text-[10px] text-positive">+4 nesta semana</span>
        </div>
        <MockSparkline points={[58, 60, 64, 61, 66, 68, 65, 70, 69, 71, 70, 73, 72, 72]} />
        <p className="text-[10px] text-ink-muted">
          A execução das prioridades foi o que mais subiu. Onde há mais espaço: retomada.
        </p>
      </MockCard>

      <MockLabel>Fatores do score</MockLabel>
      <MockCard className="space-y-2">
        <Factor label="Consistência recente" weight="35%" value={0.8} />
        <Factor label="Execução das prioridades" weight="30%" value={0.86} />
        <Factor label="Progresso nos objetivos" weight="20%" value={0.58} />
        <Factor label="Capacidade de retomada" weight="15%" value={0.6} />
      </MockCard>

      <MockLabel>Últimos 7 dias</MockLabel>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Hábitos" value="17/21" />
        <Stat label="Ações" value="9/11" />
        <Stat label="Minutos" value="312" />
      </div>
    </>
  )
}

function Factor({ label, weight, value }: { label: string; weight: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-ink-muted">{label}</span>
        <span className="tabular text-ink-faint">{weight}</span>
      </div>
      <MockProgress value={value} className="mt-1" />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <MockCard className="min-w-0 p-2">
      <p className="text-[10px] text-ink-faint">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold leading-tight text-ink">{value}</p>
    </MockCard>
  )
}

export function ReviewScreen() {
  return (
    <>
      <MockHeader title="Review semanal" subtitle="1 a 7 de setembro" />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Execução" value="82%" />
        <Stat label="Dias ativos" value="6/7" />
        <Stat label="Momentum" value="+4" />
      </div>

      <MockLabel>Onde evoluiu</MockLabel>
      <MockCard>
        <p className="text-[11px] text-ink">
          Rascunho saiu de 20% pra 45%. As três prioridades da semana foram concluídas.
        </p>
      </MockCard>

      <MockLabel>Onde o ritmo caiu</MockLabel>
      <MockCard>
        <p className="text-[11px] text-ink">
          "Revisar anotações" foi adiado 3 vezes, sempre à noite. O treino não teve avanço.
        </p>
      </MockCard>

      <MockLabel>O app sugere</MockLabel>
      <MockCard tone="brand">
        <p className="text-[11px] text-ink">
          Mover "Revisar anotações" pra manhã, logo depois da leitura. Trazer a corrida leve pra
          quarta, que é o dia mais vazio.
        </p>
        <span className="mt-2 inline-block rounded-lg bg-brand px-2.5 py-1 text-[10px] font-medium text-white">
          Aplicar na próxima semana
        </span>
      </MockCard>
    </>
  )
}

/**
 * O dia ruim: a tela que nenhum concorrente consegue mostrar. Energia baixa,
 * capacidade mínima e a revisão do Dia Adaptável com os três vereditos reais
 * (`ADAPTIVE_VERDICTS`: manter, reduzir, reagendar). É o mockup do hero.
 */
export function AdaptiveDayScreen() {
  return (
    <>
      <MockHeader title="Boa noite, Marina" subtitle="Quinta, 11 de setembro" />

      <MockMomentum value={69} level="Constante" delta={-3} streak={14} />

      <MockLabel>Como você está chegando hoje?</MockLabel>
      <div className="flex gap-1.5">
        <MockTag tone="warn">Energia 2/5</MockTag>
        <MockTag>Capacidade mínima</MockTag>
      </div>

      <MockLabel>Vamos proteger seu Momentum</MockLabel>
      <MockCard tone="brand">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Budget label="Você tem" value="40 min" />
          <Budget label="Estava montado" value="95 min" />
          <Budget label="Fica em" value="38 min" highlight />
        </div>

        <ul className="mt-3 space-y-2">
          <Verdict
            label="Seção de métodos"
            verdict="Versão mínima"
            detail="Protegido · 200 palavras"
            tone="brand"
          />
          <Verdict label="Ler 20 páginas" verdict="Versão mínima" detail="Hábito · 5 páginas · 8 min" tone="brand" />
          <Verdict label="Caminhar" verdict="Mantém" detail="Hábito · mínima · 8 min" tone="positive" />
          <Verdict label="Tabela de resultados" verdict="Fica pra depois" detail="Segunda, dia mais vazio" tone="neutral" />
        </ul>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="whitespace-nowrap rounded-lg bg-brand px-2.5 py-1 text-[11px] font-medium text-white">
            Confirmar 3 mudanças
          </span>
          <span className="text-[10px] leading-tight text-ink-faint">Nenhuma sequência é encerrada</span>
        </div>
      </MockCard>
    </>
  )
}

function Budget({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-canvas/60 px-1.5 py-1.5">
      <p className="text-[9px] text-ink-faint">{label}</p>
      <p className={`tabular text-xs font-semibold ${highlight ? 'text-brand-hi' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function Verdict({
  label,
  verdict,
  detail,
  tone,
}: {
  label: string
  verdict: string
  detail: string
  tone: 'brand' | 'positive' | 'neutral'
}) {
  return (
    <li className="flex items-start justify-between gap-2">
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-ink">{label}</span>
        <span className="block truncate text-[10px] text-ink-faint">{detail}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap">
        <MockTag tone={tone}>{verdict}</MockTag>
      </span>
    </li>
  )
}
