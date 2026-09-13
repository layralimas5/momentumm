import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { featureForRoute, PRODUCT_EVENTS, PRODUCT_FEATURES } from './product-events'

/**
 * A lista de eventos e recursos existe em dois lugares: aqui e no banco
 * (`product_event_names()`, `product_feature_names()`, criadas na 0024 e
 * redefinidas por migrations posteriores quando um recurso novo entra). Se
 * elas divergem, o app grava eventos que o servidor recusa — sem erro na
 * tela, porque analytics não sobe erro. Este teste lê a ÚLTIMA definição
 * nas migrations e compara.
 */
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

describe('eventos de produto', () => {

  it('a lista de eventos do app é a mesma do banco', () => {
    expect([...PRODUCT_EVENTS].sort()).toEqual(sqlArray('product_event_names').sort())
  })

  it('a lista de recursos do app é a mesma do banco', () => {
    expect([...PRODUCT_FEATURES].sort()).toEqual(sqlArray('product_feature_names').sort())
  })

  it('a rota vira recurso sem carregar o id', () => {
    expect(featureForRoute('/app')).toBe('hoje')
    expect(featureForRoute('/app/objetivos/8f1c-2a')).toBe('objetivos')
    expect(featureForRoute('/app/desafios/123')).toBe('desafios')
    expect(featureForRoute('/app/circulo/abc')).toBe('circulo')
    expect(featureForRoute('/admin')).toBeNull()
    expect(featureForRoute('/')).toBeNull()
  })
})
