/* A politica cobre o que o app de fato carrega? Checagem estatica do dist. */
import fs from 'node:fs'
import path from 'node:path'

const toml = fs.readFileSync('../netlify.toml', 'utf8')
const politica = toml.match(/Content-Security-Policy(?:-Report-Only)? = "(.+)"/)[1]
const diretivas = Object.fromEntries(
  politica.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [nome, ...valores] = d.split(/\s+/)
    return [nome, valores]
  }),
)

const html = fs.readFileSync('dist/index.html', 'utf8')
let falhas = 0
const ok = (t) => console.log('  ok   ' + t)
const nao = (t) => { falhas += 1; console.log('  FALHA ' + t) }

// script inline executavel quebraria script-src 'self'
const inlineJs = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(([, attrs]) => !/type=["']application\/ld\+json["']/.test(attrs))
  .filter(([, , corpo]) => corpo.trim().length > 0)
inlineJs.length === 0
  ? ok("nenhum script inline: script-src 'self' basta")
  : nao(`${inlineJs.length} script(s) inline exigiriam 'unsafe-inline' ou hash`)

// <style> no HTML
const temStyle = new RegExp('<style[\s>]').test(html)
if (temStyle) nao('<style> no HTML: confirmar style-src')
else ok('nenhum <style> no HTML')

// origens externas referenciadas no bundle
const assets = fs.readdirSync('dist/assets').filter((f) => f.endsWith('.js'))
const origens = new Set()
for (const f of assets) {
  const js = fs.readFileSync(path.join('dist/assets', f), 'utf8')
  for (const m of js.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) origens.add(m[1].toLowerCase())
}
/*
  Dominios que aparecem como TEXTO no bundle e nunca viram requisicao:
  namespace de SVG, link de documentacao dentro de mensagem de erro de
  biblioteca, schema.org do JSON-LD e o wa.me que abre em aba nova (navegacao,
  nao fetch). A checagem e estatica, entao a lista existe pra separar o que e
  string do que seria carregado.
*/
const permitidas = new Set([
  'www.momentumm.com.br', 'momentumm.com.br', 'schema.org',
  'wa.me', 'react.dev', 'www.w3.org', 'github.com', 'reactrouter.com',
])
const externas = [...origens].filter((o) => !permitidas.has(o) && !o.endsWith('.supabase.co'))
externas.length === 0
  ? ok('o bundle so referencia o proprio dominio e o supabase')
  : nao('origens fora da politica: ' + externas.join(', '))

// as diretivas que importam existem
for (const nome of ['default-src', 'script-src', 'connect-src', 'img-src', 'frame-ancestors', 'object-src', 'base-uri']) {
  diretivas[nome] ? ok(`${nome} definida`) : nao(`${nome} ausente`)
}
diretivas['script-src']?.includes("'unsafe-inline'")
  ? nao("script-src tem 'unsafe-inline', o que anula boa parte da protecao")
  : ok("script-src sem 'unsafe-inline'")

console.log(falhas === 0 ? '\npolitica coerente com o build' : `\n${falhas} ponto(s) a resolver`)
process.exit(falhas > 0 ? 1 : 0)
