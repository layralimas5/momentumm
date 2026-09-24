import { describe, expect, it } from 'vitest'
import { SENSITIVE_SETTINGS, SETTING_SCHEMAS, validateSetting } from './settings-schema'

describe('configurações do produto', () => {
  /*
    O painel espelha `public.validate_setting`, e é aqui que os dois se
    desencontram primeiro: uma chave que o banco já guarda e o painel não
    conhece cai no `.strict()` e faz a gravação ser recusada com "chave
    desconhecida" — mesmo quando o que foi editado é outro limite.
  */
  it('aceita as chaves do Juntos que a 0052 e a 0053 acrescentaram', () => {
    const free = {
      activeObjectives: 2,
      activeHabits: 5,
      activePlans: 1,
      actionsPerDay: 5,
      historyDays: 15,
      pairEncouragementsPerDay: 1,
      pairs: 1,
    }
    expect(validateSetting('plans.free', free).ok).toBe(true)
    expect(
      validateSetting('plans.pro', {
        activeObjectives: null,
        activeHabits: null,
        activePlans: null,
        actionsPerDay: null,
        historyDays: null,
        pairEncouragementsPerDay: null,
        pairs: null,
      }).ok,
    ).toBe(true)
  })

  it('aceita a forma esperada de cada chave', () => {
    expect(validateSetting('plans.free', { activeObjectives: 2, activeHabits: 5, activePlans: 1, actionsPerDay: 5, historyDays: 15 }).ok).toBe(true)
    expect(validateSetting('plans.pro', { activeObjectives: null, activeHabits: null, activePlans: null, actionsPerDay: null, historyDays: null }).ok).toBe(true)
    expect(
      validateSetting('ai.limits', {
        enabled: true,
        monthlyPerPlan: { free: 0, pro: 150 },
        dailySafetyLimit: 25,
        perMinute: 5,
        costAlertUsd: 50,
        costPerMillionInputUsd: null,
        costPerMillionOutputUsd: null,
        abuseBlockMinutes: 60,
        kinds: { plan: true },
      }).ok,
    ).toBe(true)
    expect(validateSetting('maintenance', { enabled: false, message: '' }).ok).toBe(true)
    expect(validateSetting('system.message', { enabled: true, text: 'Oi', tone: 'info' }).ok).toBe(true)
    expect(validateSetting('legal.versions', { termos: '2026-09-11', privacidade: '2026-09-11' }).ok).toBe(true)
    expect(validateSetting('features', { ai: true }).ok).toBe(true)
  })

  it('recusa chave desconhecida dentro do valor e chave de configuração inexistente', () => {
    expect(validateSetting('plans.free', { activeObjectives: 2, bonus: 1 }).ok).toBe(false)
    expect(validateSetting('features', { ai: 'sim' }).ok).toBe(false)
    expect(validateSetting('system.message', { enabled: true, text: 'x', tone: 'erro' }).ok).toBe(false)
    expect(validateSetting('legal.versions', { termos: '11/09/2026', privacidade: '2026-09-11' }).ok).toBe(false)
    expect(validateSetting('segredo', { x: 1 }).ok).toBe(false)
  })

  it('recusa tetos da IA não positivos', () => {
    const base = {
      enabled: true,
      monthlyPerPlan: { free: 0, pro: 150 },
      dailySafetyLimit: 0,
      perMinute: 5,
      costAlertUsd: 50,
      costPerMillionInputUsd: null,
      costPerMillionOutputUsd: null,
      abuseBlockMinutes: 60,
      kinds: {},
    }
    expect(validateSetting('ai.limits', base).ok).toBe(false)
  })

  it('toda chave sensível tem schema', () => {
    for (const key of SENSITIVE_SETTINGS) expect(SETTING_SCHEMAS[key]).toBeDefined()
  })
})
