import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addDays, parseDayKey, type DayKey } from './day'
import {
  ACHIEVEMENTS,
  EMPTY_EVOLUTION,
  LEVELS,
  levelOf,
  levelSpecOf,
  nextUnlock,
  profileTitleOf,
  summarizeEvolution,
  unlockStatusOf,
  UNLOCKS,
  XP_RULES,
  type EvolutionSnapshot,
} from './evolution'
import { applyEvolutionEvent, type EvolutionEvent } from './evolution-engine'

const MONDAY = parseDayKey('2026-09-14')

let counter = 0
const context = { userId: 'u1', now: new Date('2026-09-14T12:00:00'), newId: () => `id-${++counter}` }

function run(events: readonly EvolutionEvent[], from: EvolutionSnapshot = EMPTY_EVOLUTION) {
  let snapshot = from
  let awarded = 0
  const unlocked: string[] = []
  for (const event of events) {
    const result = applyEvolutionEvent(snapshot, event, context)
    snapshot = result.snapshot
    awarded += result.awarded.length
    unlocked.push(...result.unlocked.map((item) => item.key))
  }
  return { snapshot, awarded, unlocked }
}

function task(id: string, day: DayKey, main = false, priorities = { total: 0, done: 0 }): EvolutionEvent {
  return { type: 'task_done', taskId: id, day, isMainPriority: main, priorities }
}

function habit(id: string, day: DayKey): EvolutionEvent {
  return { type: 'habit_done', habitId: id, day }
}

// ---------------------------------------------------------------------------
// níveis
// ---------------------------------------------------------------------------

describe('levelOf', () => {
  it('as cinco faixas do produto', () => {
    expect(levelOf(0)).toMatchObject({ level: 1, name: 'Começo', xpInLevel: 0, xpToNext: 100 })
    expect(levelOf(99).level).toBe(1)
    expect(levelOf(100)).toMatchObject({ level: 2, name: 'Movimento' })
    expect(levelOf(299).level).toBe(2)
    expect(levelOf(300).level).toBe(3)
    expect(levelOf(699).level).toBe(3)
    expect(levelOf(700).level).toBe(4)
    expect(levelOf(1499).level).toBe(4)
    expect(levelOf(1500)).toMatchObject({ level: 5, name: 'Consistência' })
    expect(levelOf(2999).level).toBe(5)
    expect(levelOf(3000).level).toBe(6)
  })

  it('a barra sai da fração do nível, não do total', () => {
    const progress = levelOf(1240)
    expect(progress).toMatchObject({ level: 4, minXp: 700, nextMinXp: 1500, span: 800 })
    expect(progress.xpInLevel).toBe(540)
    expect(progress.xpToNext).toBe(260)
    expect(progress.percent).toBe(67)
  })

  it('continua sozinho depois da tabela', () => {
    expect(levelSpecOf(11)).toMatchObject({ level: 11, minXp: 23000, name: 'Legado II' })
    expect(levelOf(23000).level).toBe(11)
    expect(levelOf(28000).level).toBe(12)
  })

  it('XP negativo é zero: o nível nunca cai abaixo do primeiro', () => {
    expect(levelOf(-50).level).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// concessão
// ---------------------------------------------------------------------------

describe('applyEvolutionEvent', () => {
  it('uma ação comum concede XP uma vez só', () => {
    const { snapshot, awarded } = run([task('t1', MONDAY), task('t1', MONDAY), task('t1', MONDAY)])
    expect(awarded).toBe(1)
    expect(snapshot.xpTotal).toBe(XP_RULES.task_done.points)
  })

  it('prioridade vale 10 e não soma os 5 da ação comum', () => {
    const { snapshot } = run([task('t1', MONDAY, true)])
    expect(snapshot.xpTotal).toBe(10)
    expect(snapshot.transactions.map((item) => item.kind)).toEqual(['priority_done'])
  })

  it('desmarcar e marcar de novo não gera XP infinito: a chave é da ação', () => {
    const first = run([task('t1', MONDAY, true)])
    // Desmarcar não passa pelo motor (XP nunca diminui). Marcar de novo, mesmo
    // agora como ação comum, bate na mesma chave.
    const second = run([task('t1', MONDAY, false)], first.snapshot)
    expect(second.awarded).toBe(0)
    expect(second.snapshot.xpTotal).toBe(10)
  })

  it('hábitos respeitam o teto diário', () => {
    const events = Array.from({ length: 8 }, (_, index) => habit(`h${index}`, MONDAY))
    const { snapshot } = run(events)
    const habitXp = snapshot.transactions
      .filter((item) => item.kind === 'habit_done')
      .reduce((total, item) => total + item.points, 0)
    expect(habitXp).toBe(XP_RULES.habit_done.dailyCap)
  })

  it('ações comuns respeitam o teto diário, e o teto zera no dia seguinte', () => {
    const today = Array.from({ length: 12 }, (_, index) => task(`t${index}`, MONDAY))
    const { snapshot } = run(today)
    const taskXp = (day: DayKey) =>
      snapshot.transactions
        .filter((item) => item.kind === 'task_done' && item.day === day)
        .reduce((total, item) => total + item.points, 0)
    expect(taskXp(MONDAY)).toBe(XP_RULES.task_done.dailyCap)

    const tomorrow = addDays(MONDAY, 1)
    const next = run([task('t99', tomorrow)], snapshot)
    expect(next.awarded).toBeGreaterThan(0)
  })

  it('review, marco e objetivo concedem o valor de cada um', () => {
    const { snapshot } = run([
      { type: 'review_done', weekStart: MONDAY, day: MONDAY },
      { type: 'stage_done', stageId: 's1', day: MONDAY },
      { type: 'objective_done', objectiveId: 'o1', day: MONDAY },
    ])
    const byKind = Object.fromEntries(snapshot.transactions.map((item) => [item.kind, item.points]))
    expect(byKind['review_done']).toBe(25)
    expect(byKind['stage_done']).toBe(50)
    expect(byKind['objective_done']).toBe(100)
  })

  it('o mesmo marco ou objetivo não concede duas vezes', () => {
    const { snapshot } = run([
      { type: 'stage_done', stageId: 's1', day: MONDAY },
      { type: 'stage_done', stageId: 's1', day: addDays(MONDAY, 1) },
      { type: 'objective_done', objectiveId: 'o1', day: MONDAY },
      { type: 'objective_done', objectiveId: 'o1', day: addDays(MONDAY, 2) },
    ])
    expect(snapshot.transactions.filter((item) => item.kind === 'stage_done')).toHaveLength(1)
    expect(snapshot.transactions.filter((item) => item.kind === 'objective_done')).toHaveLength(1)
  })

  it('o XP nunca diminui: nenhuma transação nasce negativa', () => {
    const { snapshot } = run([task('t1', MONDAY), habit('h1', MONDAY)])
    expect(snapshot.transactions.every((item) => item.points > 0)).toBe(true)
  })

  it('o nível muda sozinho ao cruzar a faixa', () => {
    // 2 marcos = 100 XP, exatamente o começo do nível 2.
    const { snapshot, unlocked } = run([
      { type: 'stage_done', stageId: 's1', day: MONDAY },
      { type: 'stage_done', stageId: 's2', day: MONDAY },
    ])
    // 100 dos marcos + 20 da conquista "Primeiro Marco".
    expect(snapshot.xpTotal).toBe(120)
    expect(snapshot.level).toBe(2)
    expect(unlocked).toContain('em_movimento')
  })

  it('todas as prioridades do dia fechadas valem o bônus, com pelo menos duas', () => {
    const one = run([task('t1', MONDAY, true, { total: 1, done: 1 })])
    expect(one.snapshot.transactions.some((item) => item.kind === 'priorities_day')).toBe(false)

    const two = run([
      task('t1', MONDAY, true, { total: 2, done: 1 }),
      task('t2', MONDAY, false, { total: 2, done: 2 }),
    ])
    expect(two.snapshot.transactions.some((item) => item.kind === 'priorities_day')).toBe(true)
    expect(two.snapshot.xpTotal).toBe(10 + 5 + 15)
  })

  it('retomada: voltar depois de dois dias parado vale 20, uma vez', () => {
    const first = run([task('t1', MONDAY)])
    const back = addDays(MONDAY, 3)
    const second = run([task('t2', back), task('t3', back)], first.snapshot)
    const comebacks = second.snapshot.transactions.filter((item) => item.kind === 'comeback')
    expect(comebacks).toHaveLength(1)
    expect(second.unlocked).toContain('de_volta_ao_jogo')
  })

  it('primeiro dia da conta não é retomada', () => {
    const { snapshot } = run([task('t1', MONDAY)])
    expect(snapshot.transactions.some((item) => item.kind === 'comeback')).toBe(false)
  })

  it('cinco dias com movimento na semana valem o bônus e a conquista Momentum', () => {
    const events = [0, 1, 2, 3, 4].map((offset) => habit('h1', addDays(MONDAY, offset)))
    const { snapshot, unlocked } = run(events)
    expect(snapshot.transactions.filter((item) => item.kind === 'week_consistent')).toHaveLength(1)
    expect(unlocked).toContain('momentum')

    // O sexto dia não repete o bônus da mesma semana.
    const more = run([habit('h1', addDays(MONDAY, 5))], snapshot)
    expect(more.snapshot.transactions.filter((item) => item.kind === 'week_consistent')).toHaveLength(1)
  })

  it('conquistas não duplicam e trazem o XP delas uma vez', () => {
    const first = run([{ type: 'review_done', weekStart: MONDAY, day: MONDAY }])
    expect(first.unlocked).toEqual(['primeira_semana'])
    expect(first.snapshot.xpTotal).toBe(25 + 20)

    const second = run(
      [{ type: 'review_done', weekStart: addDays(MONDAY, 7), day: addDays(MONDAY, 7) }],
      first.snapshot,
    )
    expect(second.unlocked).toEqual([])
    expect(second.snapshot.achievements).toHaveLength(1)
    expect(second.snapshot.xpTotal).toBe(25 + 20 + 25)
  })

  it('Pegou Ritmo pede sete dias diferentes com prioridade fechada', () => {
    const events = Array.from({ length: 7 }, (_, index) =>
      task(`p${index}`, addDays(MONDAY, index * 2), true),
    )
    const { unlocked } = run(events)
    expect(unlocked).toContain('pegou_ritmo')
  })

  it('o histórico diz de onde cada XP veio', () => {
    const { snapshot } = run([task('t1', MONDAY, true), habit('h1', MONDAY)])
    expect(snapshot.transactions.map((item) => [item.kind, item.sourceType, item.sourceId])).toEqual([
      ['priority_done', 'task', 't1'],
      ['habit_done', 'habit', 'h1'],
    ])
  })
})

// ---------------------------------------------------------------------------
// desbloqueios
// ---------------------------------------------------------------------------

describe('desbloqueios', () => {
  it('respeitam nível e plano ao mesmo tempo', () => {
    const aurora = UNLOCKS.find((item) => item.key === 'moldura_aurora')
    if (!aurora) throw new Error('moldura_aurora sumiu')
    expect(unlockStatusOf(aurora, 3, 'free')).toBe('falta_ambos')
    expect(unlockStatusOf(aurora, 7, 'free')).toBe('falta_pro')
    expect(unlockStatusOf(aurora, 3, 'pro')).toBe('falta_nivel')
    expect(unlockStatusOf(aurora, 7, 'pro')).toBe('liberado')
  })

  it('o título mais alto liberado é o que aparece', () => {
    expect(profileTitleOf(1, 'free')).toBeNull()
    expect(profileTitleOf(3, 'free')).toBe('Em ritmo')
    expect(profileTitleOf(6, 'free')).toBe('Constante')
    expect(profileTitleOf(9, 'free')).toBe('Constante')
    expect(profileTitleOf(9, 'pro')).toBe('Mestre do ritmo')
  })

  it('o próximo desbloqueio é o primeiro ainda trancado', () => {
    expect(nextUnlock(1, 'free')?.key).toBe('share_lista')
    expect(nextUnlock(2, 'free')?.key).toBe('titulo_em_ritmo')
  })
})

// ---------------------------------------------------------------------------
// leitura da tela
// ---------------------------------------------------------------------------

describe('summarizeEvolution', () => {
  it('separa a semana atual da anterior e ranqueia as fontes', () => {
    const lastWeek = addDays(MONDAY, -1)
    const { snapshot } = run([
      task('a', lastWeek, true),
      task('b', MONDAY, true),
      task('c', MONDAY),
      habit('h', MONDAY),
    ])
    const summary = summarizeEvolution(snapshot, addDays(MONDAY, 2), 'free')
    expect(summary.previousWeekXp).toBe(10)
    expect(summary.weekXp).toBe(10 + 5 + 3)
    expect(summary.weekSources[0]?.kind).toBe('priority_done')
    expect(summary.weeksInEvolution).toBe(2)
    expect(summary.activeDays).toBe(2)
    expect(summary.achievements).toHaveLength(ACHIEVEMENTS.length)
  })
})

// ---------------------------------------------------------------------------
// paridade com o banco
// ---------------------------------------------------------------------------

describe('a migration 0031 aplica os mesmos números do domínio', () => {
  const sql = readFileSync(
    join(import.meta.dirname, '..', '..', '..', 'supabase', 'migrations', '0031_evolution.sql'),
    'utf-8',
  )

  it('regras de XP', () => {
    for (const rule of Object.values(XP_RULES)) {
      const cap = rule.dailyCap === null ? 'null' : String(rule.dailyCap)
      const pattern = new RegExp(`\\('${rule.kind}',\\s*${rule.points},\\s*${cap},`)
      expect(sql, rule.kind).toMatch(pattern)
    }
  })

  it('níveis', () => {
    for (const level of LEVELS) {
      const pattern = new RegExp(`\\(${level.level},\\s*'${level.name}',\\s*${level.minXp}\\)`)
      expect(sql, level.name).toMatch(pattern)
    }
  })

  it('conquistas', () => {
    for (const spec of ACHIEVEMENTS) {
      const pattern = new RegExp(`\\('${spec.key}',\\s*${spec.xp},`)
      expect(sql, spec.key).toMatch(pattern)
    }
  })
})
