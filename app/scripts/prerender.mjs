/**
 * Grava o HTML das páginas públicas depois do build.
 *
 * ## Por que
 *
 * O app é uma SPA: o `index.html` entregue tem `<body><div id="root"></div>`, e
 * todo o conteúdo nasce de JavaScript. O Googlebot renderiza JS e chega lá; os
 * robôs de resposta por IA, em geral, não renderizam. O `robots.txt` convida
 * GPTBot, ClaudeBot e PerplexityBot nominalmente, e eles chegam numa página em
 * branco. Enquanto o conteúdo não existir em HTML, AEO e GEO não têm onde
 * acontecer.
 *
 * Este script abre cada rota pública num navegador de verdade, espera a tela
 * ficar pronta e grava o HTML resultante em `dist/<rota>/index.html`. O Netlify
 * serve arquivo existente antes de aplicar o redirect de SPA, então quem pedir
 * `/ferramentas` recebe HTML com conteúdo, e o app continua funcionando igual
 * a partir dali.
 *
 * ## Por que a partir dos componentes, e não de HTML escrito à mão
 *
 * Porque a landing vai mudar. Página estática escrita à mão envelhece no dia
 * seguinte e ninguém lembra de atualizar; aqui o HTML sai do mesmo React que
 * roda no navegador, então mexer na LP já muda o que o robô lê, sem passo
 * extra.
 *
 * ## O que ele NÃO faz
 *
 * Não hidrata. O React continua montando do zero por cima do HTML gravado, e
 * isso é de propósito: hidratar exige marcação idêntica entre servidor e
 * cliente, e esta página muda conforme a sessão (o CTA vira "Abrir o app" pra
 * quem já entrou). Uma divergência dessas vira erro no console de quem usa. O
 * ganho aqui é o robô ler conteúdo e a primeira pintura vir mais cedo, não
 * economizar JavaScript.
 *
 * ## Falha aqui não derruba o deploy
 *
 * Se o navegador não subir, o script avisa e sai com zero. O site volta a ser
 * a SPA de sempre, que é exatamente o que está no ar hoje. Perder pré-render é
 * um retrocesso de SEO; perder o build é o site fora do ar.
 */

import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')
const PORT = 4183

/**
 * As rotas que viram arquivo. São as mesmas do sitemap.
 *
 * Rota que exige sessão não entra: ela renderizaria uma tela de carregamento
 * ou um redirecionamento pro login, e gravar isso em HTML é publicar uma
 * página vazia com endereço bonito.
 */
const ROTAS = ['/', '/plano', '/ferramentas', '/termos', '/privacidade']

/** O seletor que prova que a tela montou, por rota. */
const PRONTO = 'h1, [data-prerender-ready]'

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
}

async function main() {
  if (!existsSync(DIST)) {
    console.warn('[prerender] dist não existe. Rode o build antes.')
    return
  }

  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    console.warn('[prerender] playwright indisponível, o site sai como SPA.')
    return
  }

  const server = await servir()

  let browser
  try {
    browser = await chromium.launch()
  } catch (cause) {
    console.warn(`[prerender] navegador não subiu (${cause.message}), o site sai como SPA.`)
    server.close()
    return
  }

  let gravadas = 0

  try {
    for (const rota of ROTAS) {
      const html = await capturar(browser, rota)
      if (!html) continue
      await gravar(rota, html)
      gravadas += 1
    }
  } finally {
    await browser.close()
    server.close()
  }

  console.log(`[prerender] ${gravadas} de ${ROTAS.length} páginas gravadas.`)
}

async function capturar(browser, rota) {
  /*
    Movimento reduzido: as animações de entrada vão direto pro estado final.
    Sem isto o retrato saía com o botão do hero no meio do fade, invisível no
    HTML que o celular pinta antes do JavaScript.
  */
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  })

  /*
    Nada de rede pra fora durante o pré-render.

    Sem isto, o build abriria sessão contra o Supabase de produção e registraria
    evento de funil a cada deploy: métrica suja vinda de um navegador que não é
    ninguém. Bloqueado, a página renderiza o estado de quem não está logado, que
    é exatamente o que o robô deve ver.
  */
  await page.route('**/*', (route) => {
    const url = route.request().url()
    const externo = !url.startsWith(`http://localhost:${PORT}`) && !url.startsWith('data:')
    return externo ? route.abort() : route.continue()
  })

  try {
    await page.goto(`http://localhost:${PORT}${rota}`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    })
    await page.waitForSelector(PRONTO, { timeout: 15_000 })
    // Um respiro pra animação de entrada assentar antes do retrato.
    await page.waitForTimeout(600)

    const html = await page.content()

    if (!html.includes('<h1')) {
      console.warn(`[prerender] ${rota} saiu sem h1, ignorada.`)
      return null
    }

    return html
  } catch (cause) {
    console.warn(`[prerender] ${rota} falhou (${cause.message}), ignorada.`)
    return null
  } finally {
    await page.close()
  }
}

async function gravar(rota, html) {
  const destino = rota === '/' ? join(DIST, 'index.html') : join(DIST, rota, 'index.html')
  await mkdir(join(destino, '..'), { recursive: true })
  await writeFile(destino, html, 'utf8')
  console.log(`[prerender] ${rota} → ${destino.replace(DIST, 'dist')} (${html.length} bytes)`)
}

/** Servidor mínimo do `dist`, com o mesmo fallback de SPA do Netlify. */
function servir() {
  return new Promise((ok) => {
    const server = createServer(async (req, res) => {
      const caminho = decodeURIComponent((req.url ?? '/').split('?')[0])
      const arquivo = join(DIST, caminho)

      const alvo =
        existsSync(arquivo) && extname(arquivo) !== '' ? arquivo : join(DIST, 'index.html')

      try {
        const corpo = await readFile(alvo)
        res.writeHead(200, { 'Content-Type': TIPOS[extname(alvo)] ?? 'application/octet-stream' })
        res.end(corpo)
      } catch {
        res.writeHead(404)
        res.end('')
      }
    })

    server.listen(PORT, () => ok(server))
  })
}

await main()
