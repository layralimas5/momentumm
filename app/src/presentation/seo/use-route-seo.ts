import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { canonicalUrl, robotsContent, seoFor } from './route-seo'

/**
 * Escreve no `<head>` a metadata da rota aberta.
 *
 * Roda uma vez, no topo do roteador, e não em cada página: metadata é uma
 * consequência do endereço, não uma decisão de componente. Página nova declara
 * o que é em `route-seo.ts` e já nasce com title, description, canônico e
 * robots certos, sem ninguém lembrar de importar um hook.
 *
 * ## O que ele NÃO resolve
 *
 * Isto roda no navegador. O Googlebot renderiza JavaScript e vai ler o
 * resultado; os robôs de resposta por IA, em geral, não renderizam, e
 * continuam lendo o `index.html` cru. Pra eles, o que vale é o HTML servido e
 * o `llms.txt`. Corrigir isso de verdade é pré-renderizar as páginas públicas,
 * que é uma decisão de arquitetura, não um ajuste de tag.
 */
export function useRouteSeo(): void {
  const { pathname } = useLocation()

  useEffect(() => {
    const seo = seoFor(pathname)

    /*
      O título só é escrito aqui nas páginas públicas.

      Dentro do app quem manda é `useDocumentTitle`, que escreve "Hoje ·
      Momentumm" a partir da navegação. Os dois efeitos dependem do mesmo
      `pathname`, e o do roteador roda DEPOIS do da tela (React executa efeito
      de filho antes do de pai), então escrever aqui apagaria o nome da tela a
      cada troca de rota.
    */
    if (!seo.noindex) document.title = seo.title
    setMeta('name', 'description', seo.description)
    setMeta('name', 'robots', robotsContent(seo))
    setMeta('property', 'og:title', seo.title)
    setMeta('property', 'og:description', seo.description)
    setMeta('property', 'og:url', canonicalUrl(seo))
    setMeta('name', 'twitter:title', seo.title)
    setMeta('name', 'twitter:description', seo.description)
    setCanonical(canonicalUrl(seo))
  }, [pathname])
}

function setMeta(key: 'name' | 'property', value: string, content: string): void {
  const selector = `meta[${key}="${value}"]`
  let tag = document.head.querySelector<HTMLMetaElement>(selector)

  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(key, value)
    document.head.appendChild(tag)
  }

  tag.setAttribute('content', content)
}

function setCanonical(href: string): void {
  let tag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', 'canonical')
    document.head.appendChild(tag)
  }

  tag.setAttribute('href', href)
}
