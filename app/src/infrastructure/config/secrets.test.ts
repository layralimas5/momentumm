import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * O teste que impede um segredo de sair de casa.
 *
 * Ele existe porque a checagem "não commitei chave, né?" é feita por memória,
 * e memória falha na sexta-feira. Aqui a pergunta é feita por uma máquina em
 * toda rodada de teste, e ela olha os dois lugares que importam:
 *
 *   1. o CÓDIGO-FONTE, que é de onde um segredo consegue chegar ao bundle
 *   2. o BUNDLE, quando ele existe, porque é o arquivo que vai pro navegador
 *      e é lá que a checagem deixa de ser teórica
 *
 * ## Por que a chave publishable passa
 *
 * `VITE_SUPABASE_ANON_KEY` (as novas se chamam `sb_publishable_…`) É pública
 * por desenho: ela identifica o projeto e não carrega autorização nenhuma —
 * quem manda é a RLS. O que não pode aparecer é a `service_role`, que
 * ATRAVESSA a RLS e vale como acesso total ao banco.
 */

const ROOT = join(import.meta.dirname, '..', '..', '..')

/**
 * Cada padrão é uma forma real de vazamento, não uma palavra proibida.
 *
 * A `service_role` aparece por três caminhos: o JWT antigo (que declara
 * `"role":"service_role"` no payload), a chave nova (`sb_secret_…`) e o nome
 * da variável de ambiente que costuma carregá-la.
 */
const PADROES: readonly { readonly nome: string; readonly regex: RegExp }[] = [
  { nome: 'JWT com role service_role', regex: /"role"\s*:\s*"service_role"/ },
  { nome: 'chave secreta do Supabase (sb_secret_)', regex: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { nome: 'variável de service role preenchida', regex: /SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]{10,}/i },
  { nome: 'chave da OpenAI', regex: /\bsk-(proj-)?[A-Za-z0-9]{20,}/ },
  { nome: 'chave da Anthropic', regex: /\bsk-ant-[A-Za-z0-9-]{20,}/ },
  { nome: 'JWT longo embutido no código', regex: /\beyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\./ },
]

const EXTENSOES = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.sql', '.html', '.md']

/*
  O próprio scanner fica de fora — e é o ÚNICO arquivo que fica.

  Ele precisa escrever os padrões que procura, então casa com todos eles. A
  exceção é por caminho exato, não por "arquivo de teste": um segredo colado
  dentro de um teste vaza igual, e continua sendo pego.
*/
const AUTO_REFERENCIA = join('infrastructure', 'config', 'secrets.test.ts')

function varrer(diretorio: string, arquivos: string[] = []): string[] {
  let entradas: string[]
  try {
    entradas = readdirSync(diretorio)
  } catch {
    return arquivos
  }

  for (const entrada of entradas) {
    if (entrada === 'node_modules' || entrada === '.git') continue

    const caminho = join(diretorio, entrada)
    if (statSync(caminho).isDirectory()) {
      varrer(caminho, arquivos)
      continue
    }

    if (caminho.endsWith(AUTO_REFERENCIA)) continue
    if (EXTENSOES.some((ext) => entrada.endsWith(ext))) arquivos.push(caminho)
  }

  return arquivos
}

function ofensores(arquivos: readonly string[]): string[] {
  const achados: string[] = []

  for (const arquivo of arquivos) {
    const conteudo = readFileSync(arquivo, 'utf8')
    for (const padrao of PADROES) {
      if (padrao.regex.test(conteudo)) {
        achados.push(`${arquivo.replace(ROOT, '')}: ${padrao.nome}`)
      }
    }
  }

  return achados
}

describe('segredos no código-fonte', () => {
  it('nenhum arquivo de src carrega chave privada', () => {
    expect(ofensores(varrer(join(ROOT, 'src')))).toEqual([])
  })

  it('nenhuma migration ou script do Supabase carrega chave privada', () => {
    expect(ofensores(varrer(join(ROOT, 'supabase')))).toEqual([])
  })

  it('o .env.example não tem valor real, só o formato', () => {
    let exemplo = ''
    try {
      exemplo = readFileSync(join(ROOT, '.env.example'), 'utf8')
    } catch {
      // Sem arquivo de exemplo não há o que vazar.
      return
    }

    for (const padrao of PADROES) {
      expect(padrao.regex.test(exemplo), `${padrao.nome} no .env.example`).toBe(false)
    }
    // A service_role não pode nem aparecer como variável sugerida: o exemplo
    // é copiado como está, e uma linha vazia convida ao preenchimento.
    expect(/SERVICE_ROLE/i.test(exemplo)).toBe(false)
  })
})

describe('segredos no bundle', () => {
  /*
    Só roda quando `dist` existe.

    O bundle é gerado por `npm run build`, e um teste que exigisse build a
    cada `npm test` transformaria a suíte de domínio (dois segundos) numa
    espera de vinte. A verificação obrigatória é a de CÓDIGO-FONTE, acima:
    nada chega ao bundle sem passar por ela. Esta aqui é a confirmação de
    que a compilação não trouxe nada de fora — e o CI, que buildar antes de
    testar, executa as duas.
  */
  const dist = join(ROOT, 'dist')
  const existe = (() => {
    try {
      return statSync(dist).isDirectory()
    } catch {
      return false
    }
  })()

  it.runIf(existe)('o bundle publicado não contém service_role nem chave de IA', () => {
    const arquivos = varrer(dist)
    expect(arquivos.length, 'dist vazio: o build não gerou nada').toBeGreaterThan(0)
    expect(ofensores(arquivos)).toEqual([])
  })
})
