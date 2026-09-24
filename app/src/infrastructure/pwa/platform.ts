/**
 * Onde o app está rodando, do ponto de vista de instalação.
 *
 * Três perguntas e nada mais: é iPhone/iPad? já está instalado? o navegador
 * sabe instalar sozinho? Tudo o que a tela decide sobre "instalar o Momentumm"
 * sai daqui, e nenhuma delas é uma promessa: `standalone` é o único estado que
 * o navegador confirma de verdade, e é o que usamos pra parar de oferecer.
 */

/** iPhone e iPad, inclusive o iPad que se apresenta como Mac (iPadOS 13+). */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iPadComoMac = ua.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document
  return /iPhone|iPad|iPod/.test(ua) || iPadComoMac
}

/**
 * O app está aberto como app, não como aba.
 *
 * `display-mode: standalone` responde no Android e no iOS moderno;
 * `navigator.standalone` é o legado do Safari, que continua sendo a única
 * resposta em parte dos iPhones.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const porMedia =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches)
  const porSafari = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return porMedia || porSafari
}

/** Safari no iPhone/iPad, com o site ainda aberto no navegador. */
export function needsIosInstructions(): boolean {
  return isIos() && !isStandalone()
}
