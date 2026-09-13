import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { featureForRoute, PRODUCT_EVENTS, PRODUCT_FEATURES } from './product-events'

/**
 * A lista de eventos e recursos existe em dois lugares: aqui e no banco
 * (`product_event_names()`, `product_feature_names()` em 0024). Se elas
 * divergem, o app grava eventos que o servidor recusa — sem erro na tela,
 * porque analytics não sobe erro. Este teste lê a migration e compara.
 */
function sqlArray(source: string, functionName: string): string[] {
  const start = source.indexOf(`function public.${functionName}()`)
  const body = source.slice(start, source.indexOf('$$;', start))
  return [...body.matchAll(/'([a-z_]+)'/g)].map((match) => match[1] ?? '').filter(Boolean)
}

describe('eventos de produto', () => {
  const migration = readFileSync(
    resolve(__dirname, '../../../supabase/migrations/0024_product_events_errors.sql'),
    'utf8',
  )

  it('a lista de eventos do app é a mesma do banco', () => {
    expect([...PRODUCT_EVENTS].sort()).toEqual(sqlArray(migration, 'product_event_names').sort())
  })

  it('a lista de recursos do app é a mesma do banco', () => {
    expect([...PRODUCT_FEATURES].sort()).toEqual(sqlArray(migration, 'product_feature_names').sort())
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
