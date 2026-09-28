import { useEffect, useMemo, useState } from 'react'
import { container } from '@/infrastructure/container'

/**
 * O caminho do bucket virando uma URL que o `<img>` abre.
 *
 * Toda imagem da camada social mora num bucket PRIVADO: o que a linha guarda é
 * um caminho, e o servidor decide, a cada pedido, se aquele arquivo pode ser
 * lido por quem está perguntando. É o que faz a foto de um perfil fechado
 * parar de abrir no segundo em que o acesso acaba, mesmo que a URL já tenha
 * circulado.
 *
 * ## O cache, e por que ele tem prazo
 *
 * O link vale dez minutos no servidor. Guardar aqui por NOVE é o que evita
 * assinar a mesma foto de novo a cada rolagem do feed, sem correr o risco de
 * entregar um link que expira no meio da imagem carregando. A margem é o ponto
 * inteiro: um cache com o mesmo prazo do link produz imagem quebrada em vez de
 * imagem lenta.
 *
 * O cache é de MÓDULO, não de componente. Abrir o perfil, voltar pro feed e
 * abrir o comentário são três telas mostrando a mesma foto, e três caches
 * assinariam três vezes.
 *
 * No modo demo o "caminho" já é a própria imagem (data URL) e isto atravessa
 * sem pedir nada a ninguém.
 *
 * ## Dois buckets
 *
 * A camada social vive em `social-media`, onde a leitura é liberada pela
 * publicação que aponta pro arquivo. O álbum manual do calendário (0060) vive
 * em `user-media`, onde só o dono lê. São regras diferentes, então são buckets
 * diferentes, e quem assina é o repositório de cada um. O cache separa os dois
 * pela origem: o mesmo nome de arquivo nos dois lugares é outro arquivo.
 */

/** De onde o arquivo vem. `album` é a foto do dia guardada sem publicar. */
export type MediaSource = 'social' | 'album'

const CACHE_MS = 9 * 60 * 1000

interface Entry {
  readonly url: string
  readonly until: number
}

const cache = new Map<string, Entry>()
/** Assinaturas em voo, pra a mesma foto em dois cards não virar dois pedidos. */
const inFlight = new Map<string, Promise<string>>()

function keyOf(path: string, source: MediaSource): string {
  return `${source}:${path}`
}

function cached(path: string, source: MediaSource): string | null {
  const key = keyOf(path, source)
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.until < Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.url
}

export async function signedUrl(path: string, source: MediaSource = 'social'): Promise<string> {
  if (isInline(path)) return path

  const hit = cached(path, source)
  if (hit) return hit

  const key = keyOf(path, source)
  const running = inFlight.get(key)
  if (running) return running

  const promise = sign(path, source)
    .then((url) => {
      cache.set(key, { url, until: Date.now() + CACHE_MS })
      return url
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, promise)
  return promise
}

async function sign(path: string, source: MediaSource): Promise<string> {
  if (source === 'social') return container.social.mediaUrl(path)

  /*
    O álbum é do dono, e a política do `user-media` (0014) compara a pasta com
    `auth.uid()`. O id vem do próprio caminho: ele COMEÇA pelo dono, e é essa a
    chave de autorização. Ler o id de outro lugar só criaria um segundo lugar
    onde ele pode estar errado.
  */
  const owner = path.split('/')[0] ?? ''
  return container.media.signedUrl(owner, path)
}

/**
 * Várias fotos de uma vez.
 *
 * Em rajada, e não uma por vez: o card do feed tem um carrossel, o calendário
 * abre trinta células, e trinta esperas em série fariam a última imagem
 * aparecer segundos depois da primeira. O que já está em cache nem vira
 * pedido.
 *
 * Falha em uma não derruba as outras: a que falhou fica sem URL e o componente
 * mostra o estado de "imagem indisponível". Foto quebrada é pior que foto
 * ausente, e uma tela em branco por causa de um link vencido é pior que as
 * duas.
 */
export function useSignedUrls(
  paths: readonly string[],
  source: MediaSource = 'social',
): ReadonlyMap<string, string> {
  const key = `${source}|${paths.join('|')}`
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => initialFrom(paths, source))

  useEffect(() => {
    let alive = true
    const pending = paths.filter((path) => !cached(path, source) && !isInline(path))
    if (pending.length === 0) {
      setUrls(initialFrom(paths, source))
      return
    }

    void Promise.all(
      pending.map(async (path) => {
        try {
          return [path, await signedUrl(path, source)] as const
        } catch {
          return null
        }
      }),
    ).then((pairs) => {
      if (!alive) return
      const next = new Map(initialFrom(paths, source))
      for (const pair of pairs) if (pair) next.set(pair[0], pair[1])
      setUrls(next)
    })

    return () => {
      alive = false
    }
    // `key` representa a lista: sem ele, um array novo a cada render reassinaria
    // tudo em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return urls
}

/** Uma foto só, pro caso em que não há lista. */
export function useSignedUrl(path: string | null, source: MediaSource = 'social'): string | null {
  const paths = useMemo(() => (path ? [path] : []), [path])
  const urls = useSignedUrls(paths, source)
  return path ? (urls.get(path) ?? null) : null
}

function isInline(path: string): boolean {
  return path.startsWith('data:') || path.startsWith('blob:')
}

function initialFrom(paths: readonly string[], source: MediaSource): Map<string, string> {
  const map = new Map<string, string>()
  for (const path of paths) {
    if (isInline(path)) {
      map.set(path, path)
      continue
    }
    const hit = cached(path, source)
    if (hit) map.set(path, hit)
  }
  return map
}
