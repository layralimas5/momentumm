import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FUNNEL_EVENTS, FUNNEL_STAGES, readAttribution } from './funnel-events'

const MIGRATIONS_DIR = resolve(__dirname, '../../../supabase/migrations')

function sqlArray(functionName: string): string[] {
  const marker = `function public.${functionName}()`
  const source = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'))
    .filter((content) => content.includes(marker))
    .at(-1)
  if (!source) throw new Error(`nenhuma migration define ${functionName}`)
  const start = source.lastIndexOf(marker)
  const body = source.slice(start, source.indexOf('$$;', start))
  return [...body.matchAll(/'([a-z_]+)'/g)].map((match) => match[1] ?? '').filter(Boolean)
}

describe('eventos do funil', () => {
  it('a lista do app é a mesma do banco', () => {
    expect([...FUNNEL_EVENTS].sort()).toEqual(sqlArray('quiz_event_names').sort())
  })

  it('toda etapa do painel é um evento conhecido', () => {
    for (const stage of FUNNEL_STAGES) expect(FUNNEL_EVENTS).toContain(stage.event)
  })

  it('lê UTMs e tema da URL, limpando o que não é seguro', () => {
    const params = new URLSearchParams(
      'utm_source=TikTok&utm_campaign=const%C3%A2ncia<script>&utm_content=carrossel01&tema=procrastinacao',
    )
    expect(readAttribution(params)).toEqual({
      source: 'tiktok',
      medium: null,
      campaign: 'constnciascript',
      content: 'carrossel01',
      theme: 'procrastinacao',
    })
  })

  it('tema desconhecido vira nulo', () => {
    expect(readAttribution(new URLSearchParams('tema=xyz')).theme).toBeNull()
  })
})
