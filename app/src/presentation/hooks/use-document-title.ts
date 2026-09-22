import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { navItemFor } from '@/presentation/layouts/nav-items'

const SUFFIX = 'Momentumm'

/**
 * O título da aba acompanha a tela aberta.
 *
 * Sem isso o navegador guarda a mesma frase pra todas as rotas: o histórico
 * vira uma lista de linhas idênticas, quem trabalha com várias abas não acha a
 * do app pelo nome e o leitor de tela anuncia sempre a mesma coisa ao trocar
 * de página, que é o único aviso de que a navegação aconteceu.
 *
 * O nome vem de `navItemFor`, o mesmo lugar que nomeia a sidebar e a busca:
 * tela nova ganha título junto com a entrada de navegação, sem lista paralela
 * pra manter em dia.
 */
export function useDocumentTitle(): void {
  const { pathname } = useLocation()
  /*
    O título do index.html, guardado na primeira renderização pra voltar
    quando a pessoa sai do app. Fica num ref, e não numa constante de módulo,
    porque uma constante lê o documento na hora em que o chunk carrega, e essa
    hora depende do empacotador.
  */
  const fallback = useRef(document.title)

  useEffect(() => {
    const original = fallback.current
    const label = navItemFor(pathname)?.label
    document.title = label ? `${label} · ${SUFFIX}` : SUFFIX

    return () => {
      document.title = original
    }
  }, [pathname])
}
