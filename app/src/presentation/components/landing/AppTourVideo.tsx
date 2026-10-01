import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * O passeio pelo app, gravado do produto de verdade (modo demo, sem dado de
 * ninguém): quiz, diagnóstico, plano, o passo do dia, o Feed, um clube, um
 * desafio e o Progresso. Uns 15 segundos, com a etapa escrita no
 * topo de cada trecho: rápido, mas dá pra saber o que cada tela faz.
 *
 * O vídeo pesa perto de 700 KB, então nada dele baixa com a página:
 * `preload="none"` e o download começa quando o celular chega perto da tela.
 * Fora da tela ele pausa, pra não gastar bateria de ninguém em loop invisível.
 *
 * Quem pediu menos movimento vê o pôster (a tela Hoje) parado. O vídeo mora
 * dentro da moldura do celular, que é decorativa (`aria-hidden`): o que ele
 * mostra está dito em texto nos recursos em volta.
 */
const POSTER = '/telas/tour-poster.webp'

export function AppTourVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const video = ref.current
    if (!video || reduced) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (entry.isIntersecting) {
          // Autoplay mudo pode ser recusado (modo economia de dados); o pôster segue na tela.
          video.play().catch(() => undefined)
        } else {
          video.pause()
        }
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [reduced])

  if (reduced) {
    return <img src={POSTER} alt="" width={540} height={1170} loading="lazy" decoding="async" className="block h-full w-full object-cover object-top" />
  }

  return (
    <video
      ref={ref}
      poster={POSTER}
      muted
      loop
      playsInline
      preload="none"
      width={540}
      height={1170}
      className="block h-full w-full object-cover object-top"
    >
      <source src="/telas/tour.webm" type="video/webm" />
      <source src="/telas/tour.mp4" type="video/mp4" />
    </video>
  )
}
