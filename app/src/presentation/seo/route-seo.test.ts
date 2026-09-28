import { describe, expect, it } from 'vitest'
import { canonicalUrl, robotsContent, seoFor } from './route-seo'

describe('seoFor', () => {
  it('dá canônico próprio a cada página pública', () => {
    expect(canonicalUrl(seoFor('/'))).toBe('https://www.momentumm.com.br/')
    expect(canonicalUrl(seoFor('/plano'))).toBe('https://www.momentumm.com.br/plano')
    expect(canonicalUrl(seoFor('/ferramentas'))).toBe('https://www.momentumm.com.br/ferramentas')
    expect(canonicalUrl(seoFor('/termos'))).toBe('https://www.momentumm.com.br/termos')
    expect(canonicalUrl(seoFor('/privacidade'))).toBe('https://www.momentumm.com.br/privacidade')
  })

  it('não repete título entre as páginas públicas', () => {
    const titulos = ['/', '/plano', '/ferramentas', '/termos', '/privacidade'].map(
      (path) => seoFor(path).title,
    )

    expect(new Set(titulos).size).toBe(titulos.length)
  })

  it('libera a indexação só das públicas', () => {
    for (const path of ['/', '/plano', '/ferramentas', '/termos', '/privacidade']) {
      expect(seoFor(path).noindex, path).toBe(false)
      expect(robotsContent(seoFor(path))).toContain('index, follow')
    }
  })

  /*
    O caso que motivou o arquivo: o `index.html` mandava `index, follow` pra
    toda rota, inclusive as que só existem com sessão. O `robots.txt` pede pra
    não rastrear, mas rastrear e indexar são coisas diferentes, e um link
    externo pro app bastaria pra ele entrar no índice como tela de login.
  */
  it('fecha o app, o painel e as telas de conta', () => {
    for (const path of [
      '/app',
      '/app/rotina',
      '/app/perfil',
      '/admin',
      '/admin/usuarios',
      '/entrar',
      '/nova-senha',
    ]) {
      expect(seoFor(path).noindex, path).toBe(true)
      expect(robotsContent(seoFor(path))).toBe('noindex, nofollow')
    }
  })

  it('fecha convite por token, que é o endereço de uma pessoa só', () => {
    for (const path of ['/juntos/abc123', '/convite/xyz', '/clube/token']) {
      expect(seoFor(path).noindex, path).toBe(true)
    }
  })

  it('aponta os apelidos do quiz pro mesmo canônico', () => {
    expect(canonicalUrl(seoFor('/criar-meu-plano'))).toBe('https://www.momentumm.com.br/plano')
    expect(canonicalUrl(seoFor('/plano/lp-hero'))).toBe('https://www.momentumm.com.br/plano')
    expect(seoFor('/plano/lp-hero').noindex).toBe(false)
  })

  it('ignora a barra do fim, que não cria página nova', () => {
    expect(seoFor('/ferramentas/')).toEqual(seoFor('/ferramentas'))
    expect(seoFor('/')).toEqual(seoFor('/'))
  })

  /*
    O padrão é fechado de propósito. Rota nova que deva ser indexada precisa
    entrar na lista de propósito, e é essa fricção que impede uma tela de conta
    de vazar pro índice por esquecimento.
  */
  it('trata rota desconhecida como privada', () => {
    expect(seoFor('/uma-rota-que-nao-existe').noindex).toBe(true)
  })
})
